const { getSetting } = require('./settingsManager');
const billingManager = require('./billing');
const { logger } = require('./logger');

class WhatsAppNotificationManager {
    constructor() {
        this.sock = null;
        this.templates = {
            invoice_created: {
                title: 'Tagihan Baru',
                template: `📋 *TAGIHAN BARU*

Halo {customer_name},

Tagihan bulanan Anda telah dibuat:

📄 *No. Invoice:* {invoice_number}
💰 *Jumlah:* Rp {amount}
📅 *Jatuh Tempo:* {due_date}
📦 *Paket:* {package_name} ({package_speed})
📝 *Catatan:* {notes}

Silakan lakukan pembayaran sebelum tanggal jatuh tempo untuk menghindari denda keterlambatan.

Terima kasih atas kepercayaan Anda.`
            },
            due_date_reminder: {
                title: 'Peringatan Jatuh Tempo',
                template: `⚠️ *PERINGATAN JATUH TEMPO*

Halo {customer_name},

Tagihan Anda akan jatuh tempo dalam {days_remaining} hari:

📄 *No. Invoice:* {invoice_number}
💰 *Jumlah:* Rp {amount}
📅 *Jatuh Tempo:* {due_date}
📦 *Paket:* {package_name} ({package_speed})

Silakan lakukan pembayaran segera untuk menghindari denda keterlambatan.

Terima kasih.`
            },
            payment_received: {
                title: 'Pembayaran Diterima',
                template: `✅ *PEMBAYARAN DITERIMA*

Halo {customer_name},

Terima kasih! Pembayaran Anda telah kami terima:

📄 *No. Invoice:* {invoice_number}
💰 *Jumlah:* Rp {amount}
💳 *Metode Pembayaran:* {payment_method}
📅 *Tanggal Pembayaran:* {payment_date}
🔢 *No. Referensi:* {reference_number}

Layanan internet Anda akan tetap aktif. Terima kasih atas kepercayaan Anda.`
            },
            service_disruption: {
                title: 'Gangguan Layanan',
                template: `🚨 *GANGGUAN LAYANAN*

Halo Pelanggan Setia,

Kami informasikan bahwa sedang terjadi gangguan pada jaringan internet:

📡 *Jenis Gangguan:* {disruption_type}
📍 *Area Terdampak:* {affected_area}
⏰ *Perkiraan Selesai:* {estimated_resolution}
📞 *Hotline:* {support_phone}

Kami sedang bekerja untuk mengatasi masalah ini secepat mungkin. Mohon maaf atas ketidaknyamanannya.

Terima kasih atas pengertian Anda.`
            },
            service_announcement: {
                title: 'Pengumuman Layanan',
                template: `📢 *PENGUMUMAN LAYANAN*

Halo Pelanggan Setia,

{announcement_content}

Terima kasih atas perhatian Anda.`
            }
        };
    }

    setSock(sockInstance) {
        this.sock = sockInstance;
    }

    // Format phone number for WhatsApp
    formatPhoneNumber(number) {
        let cleaned = number.replace(/\D/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.slice(1);
        }
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        return cleaned;
    }

    // Replace template variables with actual data
    replaceTemplateVariables(template, data) {
        let message = template;
        for (const [key, value] of Object.entries(data)) {
            const placeholder = `{${key}}`;
            message = message.replace(new RegExp(placeholder, 'g'), value || '');
        }
        return message;
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID').format(amount);
    }

    // Format date
    formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Send notification with header and footer
    async sendNotification(phoneNumber, message, options = {}) {
        try {
            if (!this.sock) {
                logger.error('WhatsApp sock not initialized');
                return { success: false, error: 'WhatsApp not connected' };
            }

            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;

            // Add header and footer
            const companyHeader = getSetting('company_header', '📱 ALIJAYA DIGITAL NETWORK 📱\n\n');
            const footerSeparator = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            const footerInfo = footerSeparator + getSetting('footer_info', 'Powered by Alijaya Digital Network');
            
            const fullMessage = `${companyHeader}${message}${footerInfo}`;

            await this.sock.sendMessage(jid, { text: fullMessage }, options);
            
            logger.info(`WhatsApp notification sent to ${phoneNumber}`);
            return { success: true };
        } catch (error) {
            logger.error(`Error sending WhatsApp notification to ${phoneNumber}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Send invoice created notification
    async sendInvoiceCreatedNotification(customerId, invoiceId) {
        try {
                    const customer = await billingManager.getCustomerById(customerId);
        const invoice = await billingManager.getInvoiceById(invoiceId);
        const packageData = await billingManager.getPackageById(invoice.package_id);

        if (!customer || !invoice || !packageData) {
            logger.error('Missing data for invoice notification');
            return { success: false, error: 'Missing data' };
        }

        const data = {
            customer_name: customer.name,
            invoice_number: invoice.invoice_number,
            amount: this.formatCurrency(invoice.amount),
            due_date: this.formatDate(invoice.due_date),
            package_name: packageData.name,
            package_speed: packageData.speed,
            notes: invoice.notes || 'Tagihan bulanan'
        };

            const message = this.replaceTemplateVariables(
                this.templates.invoice_created.template,
                data
            );

            return await this.sendNotification(customer.phone, message);
        } catch (error) {
            logger.error('Error sending invoice created notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send due date reminder
    async sendDueDateReminder(invoiceId) {
        try {
                    const invoice = await billingManager.getInvoiceById(invoiceId);
        const customer = await billingManager.getCustomerById(invoice.customer_id);
        const packageData = await billingManager.getPackageById(invoice.package_id);

        if (!customer || !invoice || !packageData) {
            logger.error('Missing data for due date reminder');
            return { success: false, error: 'Missing data' };
        }

        const dueDate = new Date(invoice.due_date);
        const today = new Date();
        const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

        const data = {
            customer_name: customer.name,
            invoice_number: invoice.invoice_number,
            amount: this.formatCurrency(invoice.amount),
            due_date: this.formatDate(invoice.due_date),
            days_remaining: daysRemaining,
            package_name: packageData.name,
            package_speed: packageData.speed
        };

            const message = this.replaceTemplateVariables(
                this.templates.due_date_reminder.template,
                data
            );

            return await this.sendNotification(customer.phone, message);
        } catch (error) {
            logger.error('Error sending due date reminder:', error);
            return { success: false, error: error.message };
        }
    }

    // Send payment received notification
    async sendPaymentReceivedNotification(paymentId) {
        try {
            const payment = await billingManager.getPaymentById(paymentId);
            const invoice = await billingManager.getInvoiceById(payment.invoice_id);
            const customer = await billingManager.getCustomerById(invoice.customer_id);

            if (!payment || !invoice || !customer) {
                logger.error('Missing data for payment notification');
                return { success: false, error: 'Missing data' };
            }

            const data = {
                customer_name: customer.name,
                invoice_number: invoice.invoice_number,
                amount: this.formatCurrency(payment.amount),
                payment_method: payment.payment_method,
                payment_date: this.formatDate(payment.payment_date),
                reference_number: payment.reference_number || 'N/A'
            };

            const message = this.replaceTemplateVariables(
                this.templates.payment_received.template,
                data
            );

            return await this.sendNotification(customer.phone, message);
        } catch (error) {
            logger.error('Error sending payment received notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send service disruption notification
    async sendServiceDisruptionNotification(disruptionData) {
        try {
            const customers = await billingManager.getCustomers();
            const activeCustomers = customers.filter(c => c.status === 'active' && c.phone);

            const data = {
                disruption_type: disruptionData.type || 'Gangguan Jaringan',
                affected_area: disruptionData.area || 'Seluruh Area',
                estimated_resolution: disruptionData.estimatedTime || 'Sedang dalam penanganan',
                support_phone: getSetting('support_phone', '081947215703')
            };

            const message = this.replaceTemplateVariables(
                this.templates.service_disruption.template,
                data
            );

            let successCount = 0;
            let errorCount = 0;

            for (const customer of activeCustomers) {
                const result = await this.sendNotification(customer.phone, message);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            return {
                success: true,
                sent: successCount,
                failed: errorCount,
                total: activeCustomers.length
            };
        } catch (error) {
            logger.error('Error sending service disruption notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send service announcement
    async sendServiceAnnouncement(announcementData) {
        try {
            const customers = await billingManager.getCustomers();
            const activeCustomers = customers.filter(c => c.status === 'active' && c.phone);

            const data = {
                announcement_content: announcementData.content || 'Tidak ada konten pengumuman'
            };

            const message = this.replaceTemplateVariables(
                this.templates.service_announcement.template,
                data
            );

            let successCount = 0;
            let errorCount = 0;

            for (const customer of activeCustomers) {
                const result = await this.sendNotification(customer.phone, message);
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            return {
                success: true,
                sent: successCount,
                failed: errorCount,
                total: activeCustomers.length
            };
        } catch (error) {
            logger.error('Error sending service announcement:', error);
            return { success: false, error: error.message };
        }
    }

    // Get all templates
    getTemplates() {
        return this.templates;
    }

    // Update template
    updateTemplate(templateKey, newTemplate) {
        if (this.templates[templateKey]) {
            this.templates[templateKey] = newTemplate;
            return true;
        }
        return false;
    }

    // Test notification to specific number
    async testNotification(phoneNumber, templateKey, testData = {}) {
        try {
            if (!this.templates[templateKey]) {
                return { success: false, error: 'Template not found' };
            }

            const message = this.replaceTemplateVariables(
                this.templates[templateKey].template,
                testData
            );

            return await this.sendNotification(phoneNumber, message);
        } catch (error) {
            logger.error('Error sending test notification:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new WhatsAppNotificationManager(); 