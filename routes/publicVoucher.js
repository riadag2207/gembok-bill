const express = require('express');
const router = express.Router();
const { getHotspotProfiles } = require('../config/mikrotik');
const { getSettingsWithCache } = require('../config/settingsManager');
const billingManager = require('../config/billing');
const logger = require('../config/logger');

// Helper function untuk mendapatkan customer_id voucher publik
async function getVoucherCustomerId() {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data/billing.db');

    return new Promise((resolve, reject) => {
        db.get('SELECT id FROM customers WHERE username = ?', ['voucher_public'], (err, row) => {
            if (err) {
                reject(err);
            } else if (row) {
                resolve(row.id);
            } else {
                // Jika tidak ada, buat customer voucher baru dengan ID yang aman (1021)
                db.run(`
                    INSERT INTO customers (id, username, name, phone, email, address, package_id, status, join_date, 
                                          pppoe_username, pppoe_profile, auto_suspension, billing_day, 
                                          latitude, longitude, created_by_technician_id, static_ip, mac_address, assigned_ip)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    1021, // ID yang aman, jauh dari range billing (1000+)
                    'voucher_public', 'Voucher Publik', '0000000000', 'voucher@public.com', 'Sistem Voucher Publik',
                    1, 'active', new Date().toISOString(), 'voucher_public', 'voucher', 0, 1,
                    0, 0, null, null, null, null
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                    db.close();
                });
            }
        });
    });
}

// Helper function untuk mengambil setting voucher online
async function getVoucherOnlineSettings() {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data/billing.db');

    return new Promise((resolve, reject) => {
        // Coba ambil dari tabel voucher_online_settings jika ada
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='voucher_online_settings'", (err, row) => {
            if (err) {
                console.error('Error checking voucher_online_settings table:', err);
                resolve({}); // Return empty object jika error
                return;
            }

            if (row) {
                // Tabel ada, ambil data
                db.all('SELECT * FROM voucher_online_settings', (err, rows) => {
                    if (err) {
                        console.error('Error getting voucher online settings:', err);
                        resolve({});
                        return;
                    }

                    const settings = {};
                    rows.forEach(row => {
                        settings[row.package_id] = {
                            profile: row.profile,
                            enabled: row.enabled === 1
                        };
                    });

                    db.close();
                    resolve(settings);
                });
            } else {
                // Tabel belum ada, buat default settings
                console.log('voucher_online_settings table not found, using default settings');
                db.close();
                resolve({
                    '3k': { profile: '3k', enabled: true },
                    '5k': { profile: '5k', enabled: true },
                    '10k': { profile: '10k', enabled: true },
                    '15k': { profile: '15k', enabled: true },
                    '25k': { profile: '25k', enabled: true },
                    '50k': { profile: '50k', enabled: true }
                });
            }
        });
    });
}

// Test route
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Voucher router works!' });
});

// GET: API untuk payment methods (sama dengan invoice)
router.get('/api/payment-methods', async (req, res) => {
    try {
        const PaymentGatewayManager = require('../config/paymentGateway');
        const paymentGateway = new PaymentGatewayManager();
        
        const methods = await paymentGateway.getAvailablePaymentMethods();
        
        res.json({
            success: true,
            methods: methods
        });
    } catch (error) {
        console.error('Error getting payment methods:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting payment methods',
            error: error.message
        });
    }
});

// GET: Halaman voucher publik
router.get('/', async (req, res) => {
    try {
        // Ambil profile hotspot
        const profilesResult = await getHotspotProfiles();
        let profiles = [];
        if (profilesResult.success && Array.isArray(profilesResult.data)) {
            profiles = profilesResult.data;
        }

        // Ambil settings
        const settings = getSettingsWithCache();

        // Ambil settings voucher online dari database
        const voucherSettings = await getVoucherOnlineSettings();

        // Data paket voucher berdasarkan setting online
        const allPackages = [
            {
                id: '3k',
                name: '3rb - 1 Hari',
                duration: '1 hari',
                price: 3000,
                profile: voucherSettings['3k']?.profile || '3k',
                description: 'Akses WiFi 1 hari penuh',
                color: 'primary',
                enabled: voucherSettings['3k']?.enabled !== false
            },
            {
                id: '5k',
                name: '5rb - 2 Hari',
                duration: '2 hari',
                price: 5000,
                profile: voucherSettings['5k']?.profile || '5k',
                description: 'Akses WiFi 2 hari penuh',
                color: 'success',
                enabled: voucherSettings['5k']?.enabled !== false
            },
            {
                id: '10k',
                name: '10rb - 5 Hari',
                duration: '5 hari',
                price: 10000,
                profile: voucherSettings['10k']?.profile || '10k',
                description: 'Akses WiFi 5 hari penuh',
                color: 'info',
                enabled: voucherSettings['10k']?.enabled !== false
            },
            {
                id: '15k',
                name: '15rb - 8 Hari',
                duration: '8 hari',
                price: 15000,
                profile: voucherSettings['15k']?.profile || '15k',
                description: 'Akses WiFi 8 hari penuh',
                color: 'warning',
                enabled: voucherSettings['15k']?.enabled !== false
            },
            {
                id: '25k',
                name: '25rb - 15 Hari',
                duration: '15 hari',
                price: 25000,
                profile: voucherSettings['25k']?.profile || '25k',
                description: 'Akses WiFi 15 hari penuh',
                color: 'danger',
                enabled: voucherSettings['25k']?.enabled !== false
            },
            {
                id: '50k',
                name: '50rb - 30 Hari',
                duration: '30 hari',
                price: 50000,
                profile: voucherSettings['50k']?.profile || '50k',
                description: 'Akses WiFi 30 hari penuh',
                color: 'secondary',
                enabled: voucherSettings['50k']?.enabled !== false
            }
        ];

        // Filter hanya paket yang enabled
        const voucherPackages = allPackages.filter(pkg => pkg.enabled);

        res.render('publicVoucher', {
            title: 'Beli Voucher Hotspot',
            voucherPackages,
            profiles,
            settings,
            error: req.query.error,
            success: req.query.success
        });

    } catch (error) {
        console.error('Error rendering public voucher page:', error);
        res.render('publicVoucher', {
            title: 'Beli Voucher Hotspot',
            voucherPackages: [],
            profiles: [],
            settings: {},
            error: 'Gagal memuat halaman voucher: ' + error.message,
            success: null
        });
    }
});

// POST: Proses pembelian voucher
router.post('/purchase', async (req, res) => {
    try {
        const { packageId, customerPhone, customerName, quantity = 1, gateway = 'tripay', method = 'BRIVA' } = req.body;

        if (!packageId || !customerPhone || !customerName) {
            return res.status(400).json({
                success: false,
                message: 'Data tidak lengkap'
            });
        }

        // Ambil settings voucher online dari database
        const voucherSettings = await getVoucherOnlineSettings();

        // Data paket voucher berdasarkan setting online
        const allPackages = [
            {
                id: '3k',
                name: '3rb - 1 Hari',
                duration: '1 hari',
                price: 3000,
                profile: voucherSettings['3k']?.profile || '3k',
                description: 'Akses WiFi 1 hari penuh',
                color: 'primary',
                enabled: voucherSettings['3k']?.enabled !== false
            },
            {
                id: '5k',
                name: '5rb - 2 Hari',
                duration: '2 hari',
                price: 5000,
                profile: voucherSettings['5k']?.profile || '5k',
                description: 'Akses WiFi 2 hari penuh',
                color: 'success',
                enabled: voucherSettings['5k']?.enabled !== false
            },
            {
                id: '10k',
                name: '10rb - 5 Hari',
                duration: '5 hari',
                price: 10000,
                profile: voucherSettings['10k']?.profile || '10k',
                description: 'Akses WiFi 5 hari penuh',
                color: 'info',
                enabled: voucherSettings['10k']?.enabled !== false
            },
            {
                id: '15k',
                name: '15rb - 8 Hari',
                duration: '8 hari',
                price: 15000,
                profile: voucherSettings['15k']?.profile || '15k',
                description: 'Akses WiFi 8 hari penuh',
                color: 'warning',
                enabled: voucherSettings['15k']?.enabled !== false
            },
            {
                id: '25k',
                name: '25rb - 15 Hari',
                duration: '15 hari',
                price: 25000,
                profile: voucherSettings['25k']?.profile || '25k',
                description: 'Akses WiFi 15 hari penuh',
                color: 'danger',
                enabled: voucherSettings['25k']?.enabled !== false
            },
            {
                id: '50k',
                name: '50rb - 30 Hari',
                duration: '30 hari',
                price: 50000,
                profile: voucherSettings['50k']?.profile || '50k',
                description: 'Akses WiFi 30 hari penuh',
                color: 'secondary',
                enabled: voucherSettings['50k']?.enabled !== false
            }
        ];

        // Filter hanya paket yang enabled
        const voucherPackages = allPackages.filter(pkg => pkg.enabled);
        const selectedPackage = voucherPackages.find(pkg => pkg.id === packageId);
        if (!selectedPackage) {
            return res.status(400).json({
                success: false,
                message: 'Paket voucher tidak ditemukan'
            });
        }

        const totalAmount = selectedPackage.price * parseInt(quantity);

        // 1. Simpan data purchase tanpa generate voucher dulu
        // Voucher akan di-generate setelah payment success untuk menghindari voucher terbuang
        console.log('Saving voucher purchase for package:', packageId, 'quantity:', quantity);
        
        // 2. Simpan data voucher ke tabel voucher_purchases (tanpa voucher_data dulu)
        const voucherDataString = JSON.stringify([]); // Kosong dulu, akan diisi setelah payment success
        console.log('Voucher purchase data to save (vouchers will be generated after payment success)');

        const voucherPurchase = await saveVoucherPurchase({
            invoiceId: null, // akan diupdate setelah invoice dibuat
            customerName: customerName,
            customerPhone: customerPhone,
            amount: totalAmount,
            description: `Voucher Hotspot ${selectedPackage.name} x${quantity}`,
            packageId: packageId,
            quantity: parseInt(quantity),
            profile: selectedPackage.profile,
            voucherData: voucherDataString, // Simpan voucher yang sudah di-generate
            status: 'pending'
        });

        console.log('Saved voucher purchase with ID:', voucherPurchase.id);
        console.log('Voucher purchase saved, vouchers will be generated after payment success');

        try {
            // 3. Buat invoice secara manual untuk menghindari constraint issues
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database('./data/billing.db');

            const invoiceId = `INV-VCR-${Date.now()}-${voucherPurchase.id}`;
            const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            // Insert invoice secara manual dengan package_id yang sesuai dengan voucher package
            let invoiceDbId;
            const voucherCustomerId = await getVoucherCustomerId();
            await new Promise((resolve, reject) => {
                const sql = `INSERT INTO invoices (customer_id, invoice_number, amount, status, created_at, due_date, notes, package_id, package_name)
                           VALUES (?, ?, ?, 'pending', datetime('now'), ?, ?, ?, ?)`;
                db.run(sql, [voucherCustomerId, invoiceId, totalAmount, dueDate, `Voucher Hotspot ${selectedPackage.name} x${quantity}`, 1, selectedPackage.name], function(err) {
                    if (err) reject(err);
                    else {
                        invoiceDbId = this.lastID;
                        resolve(this.lastID);
                    }
                });
            });

            // Update voucher purchase dengan invoice_id
            await new Promise((resolve, reject) => {
                db.run('UPDATE voucher_purchases SET invoice_id = ? WHERE id = ?', [invoiceId, voucherPurchase.id], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });

            console.log('Invoice created manually:', invoiceId, 'DB ID:', invoiceDbId);
            db.close();

            // 4. Buat payment gateway transaction menggunakan Tripay
            console.log('Creating payment for invoice DB ID:', invoiceDbId);

            // Gunakan method yang sama dengan invoice bulanan, tapi dengan paymentType voucher
            const paymentResult = await billingManager.createOnlinePaymentWithMethod(invoiceDbId, gateway, method, 'voucher');
            console.log('Payment result:', paymentResult);

            if (!paymentResult || !paymentResult.payment_url) {
                throw new Error('Gagal membuat payment URL');
            }

            res.json({
                success: true,
                message: 'Pembelian voucher berhasil dibuat',
                data: {
                    purchaseId: voucherPurchase.id,
                    invoiceId: invoiceId,
                    paymentUrl: paymentResult.payment_url,
                    amount: totalAmount,
                    package: selectedPackage,
                    note: 'Voucher akan di-generate setelah pembayaran berhasil'
                }
            });
        } catch (paymentError) {
            console.error('Payment creation error:', paymentError);
            // Jika payment gagal, update status voucher menjadi failed
            try {
                const sqlite3 = require('sqlite3').verbose();
                const db = new sqlite3.Database('./data/billing.db');
                await new Promise((resolve, reject) => {
                    db.run('UPDATE voucher_purchases SET status = ? WHERE id = ?', ['failed', voucherPurchase.id], function(err) {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                db.close();
            } catch (updateError) {
                console.error('Failed to update voucher status:', updateError);
            }

            throw paymentError;
        }

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal memproses pembelian voucher: ' + error.message
        });
    }
});

// GET: Halaman sukses pembelian voucher
router.get('/success/:purchaseId', async (req, res) => {
    try {
        const { purchaseId } = req.params;
        
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');

        const purchase = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM voucher_purchases WHERE id = ?', [purchaseId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!purchase) {
            return res.render('voucherError', {
                title: 'Voucher Tidak Ditemukan',
                error: 'Voucher tidak ditemukan',
                message: 'Purchase ID tidak valid atau voucher sudah expired'
            });
        }

        let vouchers = [];
        if (purchase.voucher_data) {
            try {
                vouchers = JSON.parse(purchase.voucher_data);
            } catch (e) {
                console.error('Error parsing voucher data:', e);
            }
        }

        db.close();

        res.render('voucherSuccess', {
            title: 'Voucher Berhasil Dibeli',
            purchase,
            vouchers,
            success: true
        });

    } catch (error) {
        console.error('Error rendering voucher success page:', error);
        res.render('voucherError', {
            title: 'Error',
            error: 'Gagal memuat halaman voucher',
            message: error.message
        });
    }
});

// GET: Halaman hasil pembayaran dari payment gateway
router.get('/finish', async (req, res) => {
    try {
        const { order_id, transaction_status } = req.query;
        
        if (!order_id) {
            return res.render('voucherError', {
                title: 'Error',
                error: 'Order ID tidak ditemukan',
                message: 'Parameter order_id tidak ditemukan dalam URL'
            });
        }

        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');

        // Cari purchase berdasarkan invoice_id
        const invoiceId = order_id.replace('INV-', '');
        const purchase = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM voucher_purchases WHERE invoice_id = ?', [invoiceId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!purchase) {
            return res.render('voucherError', {
                title: 'Voucher Tidak Ditemukan',
                error: 'Voucher tidak ditemukan',
                message: 'Purchase dengan order ID tersebut tidak ditemukan'
            });
        }

        let vouchers = [];
        if (purchase.voucher_data) {
            try {
                vouchers = JSON.parse(purchase.voucher_data);
            } catch (e) {
                console.error('Error parsing voucher data:', e);
            }
        }

        db.close();

        // Tentukan status berdasarkan transaction_status
        let status = 'pending';
        if (transaction_status === 'settlement' || transaction_status === 'capture') {
            status = 'success';
        } else if (transaction_status === 'expire' || transaction_status === 'cancel') {
            status = 'failed';
        }

        res.render('voucherFinish', {
            title: 'Hasil Pembayaran Voucher',
            purchase,
            vouchers,
            status,
            transaction_status,
            order_id
        });

    } catch (error) {
        console.error('Error rendering voucher finish page:', error);
        res.render('voucherError', {
            title: 'Error',
            error: 'Gagal memuat halaman hasil pembayaran',
            message: error.message
        });
    }
});

// Helper function untuk format pesan voucher WhatsApp
function formatVoucherMessage(vouchers, purchase) {
    let message = `🛒 *VOUCHER HOTSPOT BERHASIL DIBELI*\n\n`;
    message += `👤 Nama: ${purchase.customer_name}\n`;
    message += `📱 No HP: ${purchase.customer_phone}\n`;
    message += `💰 Total: Rp ${purchase.amount.toLocaleString('id-ID')}\n\n`;

    message += `🎫 *DETAIL VOUCHER:*\n\n`;

    vouchers.forEach((voucher, index) => {
        message += `${index + 1}. *${voucher.username}*\n`;
        message += `   Password: ${voucher.password}\n`;
        message += `   Profile: ${voucher.profile}\n\n`;
    });

    message += `🌐 *CARA PENGGUNAAN:*\n`;
    message += `1. Hubungkan ke WiFi hotspot\n`;
    message += `2. Buka browser ke http://192.168.88.1\n`;
    message += `3. Masukkan Username & Password di atas\n`;
    message += `4. Klik Login\n\n`;

    message += `⏰ *MASA AKTIF:* Sesuai paket yang dipilih\n\n`;
    message += `📞 *BANTUAN:* Hubungi admin jika ada kendala\n\n`;
    message += `Terima kasih telah menggunakan layanan kami! 🚀`;

    return message;
}

// Helper function untuk format pesan voucher dengan link success page
function formatVoucherMessageWithSuccessPage(vouchers, purchase, successUrl) {
    let message = `🛒 *VOUCHER HOTSPOT BERHASIL DIBELI*\n\n`;
    message += `👤 Nama: ${purchase.customer_name}\n`;
    message += `📱 No HP: ${purchase.customer_phone}\n`;
    message += `💰 Total: Rp ${purchase.amount.toLocaleString('id-ID')}\n\n`;

    message += `🎫 *DETAIL VOUCHER:*\n\n`;

    vouchers.forEach((voucher, index) => {
        message += `${index + 1}. *${voucher.username}*\n`;
        message += `   Password: ${voucher.password}\n`;
        message += `   Profile: ${voucher.profile}\n\n`;
    });

    message += `🌐 *LIHAT DETAIL LENGKAP:*\n`;
    message += `${successUrl}\n\n`;

    message += `🌐 *CARA PENGGUNAAN:*\n`;
    message += `1. Hubungkan ke WiFi hotspot\n`;
    message += `2. Buka browser ke http://192.168.88.1\n`;
    message += `3. Masukkan Username & Password di atas\n`;
    message += `4. Klik Login\n\n`;

    message += `⏰ *MASA AKTIF:* Sesuai paket yang dipilih\n\n`;

    message += `📞 *BANTUAN:* Hubungi admin jika ada kendala\n\n`;
    message += `Terima kasih telah menggunakan layanan kami! 🚀`;

    return message;
}

// Function untuk handle voucher webhook (bisa dipanggil dari universal webhook)
async function handleVoucherWebhook(body, headers) {
    try {
        console.log('Received voucher payment webhook:', body);

        // Gunakan PaymentGatewayManager untuk konsistensi
        const PaymentGatewayManager = require('../config/paymentGateway');
        const paymentGateway = new PaymentGatewayManager();
        
        // Tentukan gateway berdasarkan payload
        let gateway = 'tripay'; // Default ke tripay
        if (body.transaction_status) {
            gateway = 'midtrans';
        } else if (body.status === 'PAID' || body.status === 'EXPIRED' || body.status === 'FAILED') {
            gateway = 'tripay';
        } else if (body.status === 'settled' || body.status === 'expired' || body.status === 'failed') {
            gateway = 'xendit';
        }

        console.log(`Processing webhook with gateway: ${gateway}`);

        // Process webhook menggunakan PaymentGatewayManager
        const webhookResult = await paymentGateway.handleWebhook({ body, headers }, gateway);
        console.log('Webhook result:', webhookResult);

        const { order_id, status, amount, payment_type } = webhookResult;

        if (!order_id) {
            console.log('No order_id found in webhook payload');
            return {
                success: false,
                message: 'Order ID tidak ditemukan dalam webhook payload'
            };
        }

        // Cari purchase berdasarkan order_id
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database('./data/billing.db');

        let purchase;
        try {
            // Coba cari berdasarkan invoice_id terlebih dahulu
            const invoiceId = order_id.replace('INV-', '');
            purchase = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM voucher_purchases WHERE invoice_id = ?', [invoiceId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        } catch (error) {
            console.error('Error finding purchase by invoice_id:', error);
            // Fallback: cari berdasarkan order_id langsung
            purchase = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM voucher_purchases WHERE invoice_id = ?', [order_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }

        if (!purchase) {
            console.log(`Purchase dengan order_id ${order_id} tidak ditemukan di database`);
            return {
                success: false,
                message: 'Voucher tidak ditemukan',
                details: `Purchase dengan order_id ${order_id} tidak ditemukan. Kemungkinan sudah expired atau order_id tidak valid.`,
                suggestions: [
                    'Periksa kembali link pembayaran yang benar',
                    'Pastikan pembayaran dilakukan dalam batas waktu yang ditentukan',
                    'Hubungi admin jika mengalami kesulitan'
                ]
            };
        }

        // Cek status pembayaran menggunakan status yang sudah dinormalisasi
        if (status === 'success' || status === 'settlement' || status === 'capture') {
            console.log('Payment successful for purchase ID:', purchase.id);

            // Generate voucher SETELAH payment success untuk menghindari voucher terbuang
            let generatedVouchers = [];
            try {
                console.log('Generating vouchers after payment success...');
                generatedVouchers = await generateHotspotVouchersWithRetry({
                    profile: purchase.voucher_profile,
                    count: purchase.voucher_quantity,
                    packageId: purchase.voucher_package,
                    customerName: purchase.customer_name,
                    customerPhone: purchase.customer_phone
                });

                if (generatedVouchers && generatedVouchers.length > 0) {
                    console.log('Vouchers generated successfully:', generatedVouchers.length);
                } else {
                    console.log('No vouchers generated');
                }
            } catch (voucherError) {
                console.error('Error generating vouchers:', voucherError);
                // Log error tapi jangan gagalkan webhook
            }

            // Update status purchase menjadi completed
            await new Promise((resolve, reject) => {
                const updateSql = `UPDATE voucher_purchases 
                                 SET status = 'completed', 
                                     voucher_data = ?, 
                                     updated_at = datetime('now')
                                 WHERE id = ?`;
                db.run(updateSql, [JSON.stringify(generatedVouchers), purchase.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Kirim voucher via WhatsApp jika ada nomor HP
            if (purchase.customer_phone) {
                try {
                    const { sendMessage } = require('../config/sendMessage');
                    const successUrl = `${process.env.APP_BASE_URL || 'https://alijaya.gantiwifi.online'}/voucher/success/${purchase.id}`;
                    const voucherText = formatVoucherMessageWithSuccessPage(generatedVouchers, purchase, successUrl);
                    const deliveryResult = await sendVoucherWithRetry(purchase.customer_phone, voucherText);
                    
                    // Log delivery result
                    await logVoucherDelivery(purchase.id, purchase.customer_phone, deliveryResult.success, deliveryResult.message);
                    
                    if (deliveryResult.success) {
                        console.log('Voucher sent successfully via WhatsApp');
                    } else {
                        console.log('Failed to send voucher via WhatsApp:', deliveryResult.message);
                    }
                } catch (whatsappError) {
                    console.error('Error sending voucher via WhatsApp:', whatsappError);
                    await logVoucherDelivery(purchase.id, purchase.customer_phone, false, whatsappError.message);
                }
            }

            db.close();
            return {
                success: true,
                message: 'Voucher berhasil dibuat dan dikirim',
                purchase_id: purchase.id,
                vouchers_generated: generatedVouchers.length,
                whatsapp_sent: purchase.customer_phone ? true : false
            };

        } else if (status === 'failed' || status === 'expired' || status === 'cancelled') {
            console.log('Payment failed/expired for purchase ID:', purchase.id);
            
            // Update status menjadi failed
            await new Promise((resolve, reject) => {
                db.run('UPDATE voucher_purchases SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', 
                       [status, purchase.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            db.close();
            return {
                success: false,
                message: `Pembayaran ${status}`,
                purchase_id: purchase.id
            };

        } else {
            console.log('Payment status unknown:', status);
            db.close();
            return {
                success: false,
                message: 'Status pembayaran tidak dikenali',
                status: status,
                purchase_id: purchase.id
            };
        }

    } catch (error) {
        console.error('Voucher webhook error:', error);
        return {
            success: false,
            message: 'Error processing voucher webhook: ' + error.message
        };
    }
}

// Webhook handler untuk voucher payment success
router.post('/payment-webhook', async (req, res) => {
    try {
        const result = await handleVoucherWebhook(req.body, req.headers);
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Voucher webhook route error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error: ' + error.message
        });
    }
});

// Helper functions yang diperlukan
async function generateHotspotVouchersWithRetry(purchaseData, maxRetries = 3) {
    const { generateHotspotVouchers } = require('../config/mikrotik');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to generate vouchers for purchase:`, purchaseData);
            
            const result = await generateHotspotVouchers(
                purchaseData.count || 1,
                `vcr-${Date.now()}-`,
                purchaseData.profile || 'default',
                'all',
                '',
                '',
                'alphanumeric'
            );
            
            if (result.success && result.vouchers && result.vouchers.length > 0) {
                console.log(`Successfully generated ${result.vouchers.length} vouchers on attempt ${attempt}`);
                return result.vouchers;
            } else {
                console.log(`Attempt ${attempt} failed:`, result.message);
                if (attempt === maxRetries) {
                    throw new Error(`Failed to generate vouchers after ${maxRetries} attempts: ${result.message}`);
                }
            }
        } catch (error) {
            console.error(`Attempt ${attempt} error:`, error.message);
            if (attempt === maxRetries) {
                throw error;
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function generateHotspotVouchers(count, prefix, profile, comment, limitUptime, limitBytes, passwordType) {
    const { generateHotspotVouchers } = require('../config/mikrotik');
    return await generateHotspotVouchers(count, prefix, profile, comment, limitUptime, limitBytes, passwordType);
}

async function sendVoucherWithRetry(phone, message, maxRetries = 3) {
    const { sendMessage } = require('../config/sendMessage');
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to send voucher to ${phone}`);
            const result = await sendMessage(phone, message);
            
            if (result.success) {
                console.log(`Successfully sent voucher to ${phone} on attempt ${attempt}`);
                return { success: true, message: 'Voucher sent successfully' };
            } else {
                console.log(`Attempt ${attempt} failed:`, result.message);
                if (attempt === maxRetries) {
                    return { success: false, message: `Failed to send voucher after ${maxRetries} attempts: ${result.message}` };
                }
            }
        } catch (error) {
            console.error(`Attempt ${attempt} error:`, error.message);
            if (attempt === maxRetries) {
                return { success: false, message: `Failed to send voucher after ${maxRetries} attempts: ${error.message}` };
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function logVoucherDelivery(purchaseId, phone, success, message) {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data/billing.db');
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO voucher_delivery_logs (purchase_id, customer_phone, success, message, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `, [purchaseId, phone, success ? 1 : 0, message], (err) => {
            if (err) reject(err);
            else resolve();
            db.close();
        });
    });
}

async function saveVoucherPurchase(purchaseData) {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data/billing.db');
    
    return new Promise((resolve, reject) => {
        db.run(`
            INSERT INTO voucher_purchases (invoice_id, customer_name, customer_phone, voucher_package, 
                                         voucher_profile, voucher_quantity, amount, description, 
                                         voucher_data, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `, [
            purchaseData.invoiceId,
            purchaseData.customerName,
            purchaseData.customerPhone,
            purchaseData.packageId,
            purchaseData.profile,
            purchaseData.quantity,
            purchaseData.amount,
            purchaseData.description,
            purchaseData.voucherData,
            purchaseData.status || 'pending'
        ], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
            db.close();
        });
    });
}

async function cleanupFailedVoucher(purchaseId) {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./data/billing.db');
    
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM voucher_purchases WHERE id = ?', [purchaseId], (err) => {
            if (err) reject(err);
            else resolve();
            db.close();
        });
    });
}

// Export functions for testing
module.exports = {
    router,
    handleVoucherWebhook,
    generateHotspotVouchersWithRetry,
    generateHotspotVouchers,
    sendVoucherWithRetry,
    logVoucherDelivery,
    saveVoucherPurchase,
    cleanupFailedVoucher
};
