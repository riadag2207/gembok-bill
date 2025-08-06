const express = require('express');
const router = express.Router();
const billingManager = require('../config/billing');
const fs = require('fs');

// Load settings
function loadSettings() {
    try {
        return JSON.parse(fs.readFileSync('settings.json', 'utf8'));
    } catch (error) {
        console.error('Error loading settings:', error);
        return {};
    }
}

// Create online payment
router.post('/create', async (req, res) => {
    try {
        const { invoice_id, gateway } = req.body;
        
        if (!invoice_id) {
            return res.status(400).json({
                success: false,
                message: 'Invoice ID is required'
            });
        }

        const result = await billingManager.createOnlinePayment(invoice_id, gateway);
        
        res.json({
            success: true,
            message: 'Payment created successfully',
            data: result
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create payment'
        });
    }
});

// Payment webhook handlers
router.post('/webhook/midtrans', async (req, res) => {
    try {
        const result = await billingManager.handlePaymentWebhook(req.body, 'midtrans');
        res.status(200).json(result);
    } catch (error) {
        console.error('Midtrans webhook error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/webhook/xendit', async (req, res) => {
    try {
        const result = await billingManager.handlePaymentWebhook(req.body, 'xendit');
        res.status(200).json(result);
    } catch (error) {
        console.error('Xendit webhook error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/webhook/tripay', async (req, res) => {
    try {
        const result = await billingManager.handlePaymentWebhook(req.body, 'tripay');
        res.status(200).json(result);
    } catch (error) {
        console.error('Tripay webhook error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Payment callback pages
router.get('/finish', (req, res) => {
    const settings = loadSettings();
    res.render('payment/finish', {
        title: 'Payment Finish',
        appSettings: settings,
        status: req.query.status || 'success',
        order_id: req.query.order_id,
        transaction_status: req.query.transaction_status
    });
});

router.get('/error', (req, res) => {
    const settings = loadSettings();
    res.render('payment/error', {
        title: 'Payment Error',
        appSettings: settings,
        error_message: req.query.error_message || 'Payment failed'
    });
});

router.get('/pending', (req, res) => {
    const settings = loadSettings();
    res.render('payment/pending', {
        title: 'Payment Pending',
        appSettings: settings,
        order_id: req.query.order_id
    });
});

// Get payment transactions
router.get('/transactions', async (req, res) => {
    try {
        const { invoice_id } = req.query;
        const transactions = await billingManager.getPaymentTransactions(invoice_id);
        
        res.json({
            success: true,
            data: transactions
        });
    } catch (error) {
        console.error('Error getting transactions:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get gateway status
router.get('/gateway-status', async (req, res) => {
    try {
        const status = await billingManager.getGatewayStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting gateway status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router; 