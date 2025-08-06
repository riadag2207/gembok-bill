const fs = require('fs');
const crypto = require('crypto');

class PaymentGatewayManager {
    constructor() {
        this.settings = this.loadSettings();
        this.gateways = {
            midtrans: new MidtransGateway(this.settings.payment_gateway.midtrans),
            xendit: new XenditGateway(this.settings.payment_gateway.xendit),
            tripay: new TripayGateway(this.settings.payment_gateway.tripay)
        };
        this.activeGateway = this.settings.payment_gateway.active;
    }

    loadSettings() {
        try {
            return JSON.parse(fs.readFileSync('settings.json', 'utf8'));
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }

    getActiveGateway() {
        return this.activeGateway;
    }

    async createPayment(invoice, gateway = null) {
        const selectedGateway = gateway || this.activeGateway;
        
        if (!this.gateways[selectedGateway]) {
            throw new Error(`Gateway ${selectedGateway} not found`);
        }

        if (!this.settings.payment_gateway[selectedGateway].enabled) {
            throw new Error(`Gateway ${selectedGateway} is not enabled`);
        }

        try {
            const result = await this.gateways[selectedGateway].createPayment(invoice);
            return {
                ...result,
                gateway: selectedGateway
            };
        } catch (error) {
            console.error(`Error creating payment with ${selectedGateway}:`, error);
            throw error;
        }
    }

    async handleWebhook(payload, gateway) {
        if (!this.gateways[gateway]) {
            throw new Error(`Gateway ${gateway} not found`);
        }

        try {
            const result = await this.gateways[gateway].handleWebhook(payload);
            return {
                ...result,
                gateway: gateway
            };
        } catch (error) {
            console.error(`Error handling webhook from ${gateway}:`, error);
            throw error;
        }
    }

    getGatewayStatus() {
        const status = {};
        Object.keys(this.gateways).forEach(gateway => {
            status[gateway] = {
                enabled: this.settings.payment_gateway[gateway].enabled,
                active: gateway === this.activeGateway
            };
        });
        return status;
    }
}

class MidtransGateway {
    constructor(config) {
        this.config = config;
        this.midtransClient = require('midtrans-client');
        this.snap = new this.midtransClient.Snap({
            isProduction: config.production,
            serverKey: config.server_key,
            clientKey: config.client_key
        });
    }

    async createPayment(invoice) {
        const parameter = {
            transaction_details: {
                order_id: `INV-${invoice.invoice_number}`,
                gross_amount: parseInt(invoice.amount)
            },
            customer_details: {
                first_name: invoice.customer_name,
                phone: invoice.customer_phone || '',
                email: invoice.customer_email || ''
            },
            item_details: [{
                id: invoice.package_id || 'PACKAGE-001',
                price: parseInt(invoice.amount),
                quantity: 1,
                name: invoice.package_name || 'Internet Package'
            }],
            callbacks: {
                finish: `${this.config.base_url || 'http://localhost:3003'}/payment/finish`,
                error: `${this.config.base_url || 'http://localhost:3003'}/payment/error`,
                pending: `${this.config.base_url || 'http://localhost:3003'}/payment/pending`
            }
        };

        const transaction = await this.snap.createTransaction(parameter);
        
        return {
            payment_url: transaction.redirect_url,
            token: transaction.token,
            order_id: parameter.transaction_details.order_id
        };
    }

    async handleWebhook(payload) {
        // Verify signature
        const expectedSignature = crypto
            .createHash('sha512')
            .update(payload.order_id + payload.status_code + payload.gross_amount + this.config.server_key)
            .digest('hex');

        if (payload.signature_key !== expectedSignature) {
            throw new Error('Invalid signature');
        }

        return {
            order_id: payload.order_id,
            status: payload.transaction_status,
            amount: payload.gross_amount,
            payment_type: payload.payment_type,
            fraud_status: payload.fraud_status
        };
    }
}

class XenditGateway {
    constructor(config) {
        this.config = config;
        const { Xendit } = require('xendit-node');
        this.xenditClient = new Xendit({
            secretKey: config.api_key
        });
    }

    async createPayment(invoice) {
        const invoiceData = {
            externalID: `INV-${invoice.invoice_number}`,
            amount: parseInt(invoice.amount),
            description: `Pembayaran ${invoice.package_name}`,
            customer: {
                givenNames: invoice.customer_name,
                email: invoice.customer_email || 'customer@example.com',
                mobileNumber: invoice.customer_phone || ''
            },
            successRedirectURL: `${this.config.base_url || 'http://localhost:3003'}/payment/success`,
            failureRedirectURL: `${this.config.base_url || 'http://localhost:3003'}/payment/failed`
        };

        const xenditInvoice = await this.xenditClient.Invoice.createInvoice(invoiceData);
        
        return {
            payment_url: xenditInvoice.invoice_url,
            token: xenditInvoice.id,
            order_id: invoiceData.externalID
        };
    }

    async handleWebhook(payload) {
        // Verify webhook signature
        const signature = crypto
            .createHmac('sha256', this.config.callback_token)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (payload.signature !== signature) {
            throw new Error('Invalid signature');
        }

        return {
            order_id: payload.external_id,
            status: payload.status,
            amount: payload.amount,
            payment_type: payload.payment_channel,
            invoice_id: payload.id
        };
    }
}

class TripayGateway {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.production ? 'https://tripay.co.id' : 'https://tripay.co.id/api-sandbox';
    }

    async createPayment(invoice) {
        const orderData = {
            method: 'BRIVA',
            merchant_ref: `INV-${invoice.invoice_number}`,
            amount: parseInt(invoice.amount),
            customer_name: invoice.customer_name,
            customer_email: invoice.customer_email || 'customer@example.com',
            customer_phone: invoice.customer_phone || '',
            order_items: [{
                name: invoice.package_name || 'Internet Package',
                price: parseInt(invoice.amount),
                quantity: 1
            }],
            callback_url: `${this.config.base_url || 'http://localhost:3003'}/webhook/tripay`,
            return_url: `${this.config.base_url || 'http://localhost:3003'}/payment/finish`
        };

        const signature = crypto
            .createHmac('sha256', this.config.private_key)
            .update(JSON.stringify(orderData))
            .digest('hex');

        const response = await fetch(`${this.baseUrl}/transaction/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...orderData,
                signature: signature
            })
        });

        const result = await response.json();
        
        if (result.success) {
            return {
                payment_url: result.data.checkout_url,
                token: result.data.reference,
                order_id: orderData.merchant_ref
            };
        } else {
            throw new Error(result.message || 'Failed to create payment');
        }
    }

    async handleWebhook(payload) {
        // Verify signature
        const signature = crypto
            .createHmac('sha256', this.config.private_key)
            .update(JSON.stringify(payload))
            .digest('hex');

        if (payload.signature !== signature) {
            throw new Error('Invalid signature');
        }

        return {
            order_id: payload.merchant_ref,
            status: payload.status,
            amount: payload.amount,
            payment_type: payload.payment_method,
            reference: payload.reference
        };
    }
}

module.exports = PaymentGatewayManager; 