const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');
const { addTagToDevice, findDeviceByPPPoE } = require('./genieacs');

class BillingManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/billing.db');
        this.initDatabase();
    }

    initDatabase() {
        // Pastikan direktori data ada
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                logger.error('Error opening billing database:', err);
            } else {
                logger.info('Billing database connected');
                this.createTables();
            }
        });
    }

    createTables() {
        const tables = [
            // Tabel paket internet
            `CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                speed TEXT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabel pelanggan
            `CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                pppoe_username TEXT,
                email TEXT,
                address TEXT,
                package_id INTEGER,
                status TEXT DEFAULT 'active',
                join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (package_id) REFERENCES packages (id)
            )`,

            // Tabel tagihan
            `CREATE TABLE IF NOT EXISTS invoices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                package_id INTEGER NOT NULL,
                invoice_number TEXT UNIQUE NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                due_date DATE NOT NULL,
                status TEXT DEFAULT 'unpaid',
                payment_date DATETIME,
                payment_method TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers (id),
                FOREIGN KEY (package_id) REFERENCES packages (id)
            )`,

            // Tabel pembayaran
            `CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                payment_method TEXT NOT NULL,
                reference_number TEXT,
                notes TEXT,
                FOREIGN KEY (invoice_id) REFERENCES invoices (id)
            )`
        ];

        tables.forEach(table => {
            this.db.run(table, (err) => {
                if (err) {
                    logger.error('Error creating table:', err);
                }
            });
        });

        // Tambahkan kolom pppoe_username jika belum ada
        this.db.run("ALTER TABLE customers ADD COLUMN pppoe_username TEXT", (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                logger.error('Error adding pppoe_username column:', err);
            } else if (!err) {
                logger.info('Successfully added pppoe_username column to customers table');
            }
        });
    }

    // Paket Management
    async createPackage(packageData) {
        return new Promise((resolve, reject) => {
            const { name, speed, price, description } = packageData;
            const sql = `INSERT INTO packages (name, speed, price, description) VALUES (?, ?, ?, ?)`;
            
            this.db.run(sql, [name, speed, price, description], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...packageData });
                }
            });
        });
    }

    async getPackages() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC`;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getPackageById(id) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM packages WHERE id = ?`;
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updatePackage(id, packageData) {
        return new Promise((resolve, reject) => {
            const { name, speed, price, description } = packageData;
            const sql = `UPDATE packages SET name = ?, speed = ?, price = ?, description = ? WHERE id = ?`;
            
            this.db.run(sql, [name, speed, price, description, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, ...packageData });
                }
            });
        });
    }

    async deletePackage(id) {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE packages SET is_active = 0 WHERE id = ?`;
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, deleted: true });
                }
            });
        });
    }

    // Customer Management
    async createCustomer(customerData) {
        return new Promise(async (resolve, reject) => {
            const { username, name, phone, pppoe_username, email, address, package_id, status } = customerData;
            const sql = `INSERT INTO customers (username, name, phone, pppoe_username, email, address, package_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [username, name, phone, pppoe_username, email, address, package_id, status || 'active'], async function(err) {
                if (err) {
                    reject(err);
                } else {
                    const customer = { id: this.lastID, ...customerData };
                    
                    // Jika ada nomor telepon dan PPPoE username, coba tambahkan tag ke GenieACS
                    if (phone && pppoe_username) {
                        try {
                            // Cari device berdasarkan PPPoE Username
                            const device = await findDeviceByPPPoE(pppoe_username);
                            
                            if (device) {
                                // Tambahkan tag nomor telepon ke device
                                await addTagToDevice(device._id, phone);
                                logger.info(`Successfully added phone tag ${phone} to device ${device._id} for customer ${username} (PPPoE: ${pppoe_username})`);
                            } else {
                                logger.warn(`No device found with PPPoE Username ${pppoe_username} for customer ${username}`);
                            }
                        } catch (genieacsError) {
                            logger.error(`Error adding phone tag to GenieACS for customer ${username}:`, genieacsError.message);
                            // Jangan reject, karena customer sudah berhasil dibuat di billing
                        }
                    } else if (phone && username) {
                        // Fallback: coba dengan username jika pppoe_username tidak ada
                        try {
                            const device = await findDeviceByPPPoE(username);
                            
                            if (device) {
                                await addTagToDevice(device._id, phone);
                                logger.info(`Successfully added phone tag ${phone} to device ${device._id} for customer ${username} (using username as PPPoE)`);
                            } else {
                                logger.warn(`No device found with PPPoE Username ${username} for customer ${username}`);
                            }
                        } catch (genieacsError) {
                            logger.error(`Error adding phone tag to GenieACS for customer ${username}:`, genieacsError.message);
                        }
                    }
                    
                    resolve(customer);
                }
            });
        });
    }

    async getCustomers() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, p.name as package_name, p.price as package_price,
                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid' 
                               AND i.due_date < date('now')
                           ) THEN 'overdue'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid'
                           ) THEN 'unpaid'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'paid'
                           ) THEN 'paid'
                           ELSE 'no_invoice'
                       END as payment_status
                FROM customers c 
                LEFT JOIN packages p ON c.package_id = p.id 
                ORDER BY c.name ASC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getCustomerByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, p.name as package_name, p.price as package_price, p.speed as package_speed
                FROM customers c 
                LEFT JOIN packages p ON c.package_id = p.id 
                WHERE c.username = ?
            `;
            
            this.db.get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getCustomerById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, p.name as package_name, p.price as package_price, p.speed as package_speed
                FROM customers c 
                LEFT JOIN packages p ON c.package_id = p.id 
                WHERE c.id = ?
            `;
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getCustomerByPhone(phone) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, p.name as package_name, p.price as package_price, p.speed as package_speed,
                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid' 
                               AND i.due_date < date('now')
                           ) THEN 'overdue'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'unpaid'
                           ) THEN 'unpaid'
                           WHEN EXISTS (
                               SELECT 1 FROM invoices i 
                               WHERE i.customer_id = c.id 
                               AND i.status = 'paid'
                           ) THEN 'paid'
                           ELSE 'no_invoice'
                       END as payment_status
                FROM customers c 
                LEFT JOIN packages p ON c.package_id = p.id 
                WHERE c.phone = ?
            `;
            
            this.db.get(sql, [phone], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateCustomer(username, customerData) {
        return new Promise(async (resolve, reject) => {
            const { name, phone, pppoe_username, email, address, package_id, status } = customerData;
            
            // Dapatkan data customer lama untuk membandingkan nomor telepon
            try {
                const oldCustomer = await this.getCustomerByUsername(username);
                const oldPhone = oldCustomer ? oldCustomer.phone : null;
                const oldPPPoE = oldCustomer ? oldCustomer.pppoe_username : null;
                
                const sql = `UPDATE customers SET name = ?, phone = ?, pppoe_username = ?, email = ?, address = ?, package_id = ?, status = ? WHERE username = ?`;
                
                this.db.run(sql, [name, phone, pppoe_username, email, address, package_id, status, username], async function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Jika nomor telepon atau PPPoE username berubah, update tag di GenieACS
                        if (phone && (phone !== oldPhone || pppoe_username !== oldPPPoE)) {
                            try {
                                const { findDeviceByPPPoE, addTagToDevice, removeTagFromDevice } = require('./genieacs');
                                
                                // Hapus tag lama jika ada
                                if (oldPhone && oldPPPoE) {
                                    try {
                                        const oldDevice = await findDeviceByPPPoE(oldPPPoE);
                                        if (oldDevice) {
                                            await removeTagFromDevice(oldDevice._id, oldPhone);
                                            logger.info(`Removed old phone tag ${oldPhone} from device ${oldDevice._id} for customer ${username}`);
                                        }
                                    } catch (error) {
                                        logger.warn(`Error removing old phone tag for customer ${username}:`, error.message);
                                    }
                                }
                                
                                // Tambahkan tag baru
                                const pppoeToUse = pppoe_username || username; // Fallback ke username jika pppoe_username kosong
                                const device = await findDeviceByPPPoE(pppoeToUse);
                                
                                if (device) {
                                    await addTagToDevice(device._id, phone);
                                    logger.info(`Successfully updated phone tag to ${phone} for device ${device._id} and customer ${username} (PPPoE: ${pppoeToUse})`);
                                } else {
                                    logger.warn(`No device found with PPPoE Username ${pppoeToUse} for customer ${username}`);
                                }
                            } catch (genieacsError) {
                                logger.error(`Error updating phone tag in GenieACS for customer ${username}:`, genieacsError.message);
                                // Jangan reject, karena customer sudah berhasil diupdate di billing
                            }
                        }
                        
                        resolve({ username, ...customerData });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async deleteCustomer(username) {
        return new Promise(async (resolve, reject) => {
            try {
                // Dapatkan data customer sebelum dihapus
                const customer = await this.getCustomerByUsername(username);
                if (!customer) {
                    reject(new Error('Customer not found'));
                    return;
                }

                const sql = `DELETE FROM customers WHERE username = ?`;
                
                this.db.run(sql, [username], async function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        // Hapus tag dari GenieACS jika ada nomor telepon
                        if (customer.phone) {
                            try {
                                const { findDeviceByPPPoE, removeTagFromDevice } = require('./genieacs');
                                const pppoeToUse = customer.pppoe_username || username; // Fallback ke username jika pppoe_username kosong
                                const device = await findDeviceByPPPoE(pppoeToUse);
                                
                                if (device) {
                                    await removeTagFromDevice(device._id, customer.phone);
                                    logger.info(`Removed phone tag ${customer.phone} from device ${device._id} for deleted customer ${username} (PPPoE: ${pppoeToUse})`);
                                } else {
                                    logger.warn(`No device found with PPPoE Username ${pppoeToUse} for deleted customer ${username}`);
                                }
                            } catch (genieacsError) {
                                logger.error(`Error removing phone tag from GenieACS for deleted customer ${username}:`, genieacsError.message);
                                // Jangan reject, karena customer sudah berhasil dihapus di billing
                            }
                        }
                        
                        resolve({ username, deleted: true });
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Invoice Management
    async createInvoice(invoiceData) {
        return new Promise((resolve, reject) => {
            const { customer_id, package_id, amount, due_date, notes } = invoiceData;
            const invoice_number = this.generateInvoiceNumber();
            
            const sql = `INSERT INTO invoices (customer_id, package_id, invoice_number, amount, due_date, notes) VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [customer_id, package_id, invoice_number, amount, due_date, notes], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, invoice_number, ...invoiceData });
                }
            });
        });
    }

    async getInvoices(customerUsername = null) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT i.*, c.username, c.name as customer_name, c.phone as customer_phone,
                       p.name as package_name, p.speed as package_speed
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN packages p ON i.package_id = p.id
            `;
            
            const params = [];
            if (customerUsername) {
                sql += ` WHERE c.username = ?`;
                params.push(customerUsername);
            }
            
            sql += ` ORDER BY i.created_at DESC`;
            
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getInvoicesByCustomer(customerId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.*, c.username, c.name as customer_name, c.phone as customer_phone,
                       p.name as package_name, p.speed as package_speed
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN packages p ON i.package_id = p.id
                WHERE i.customer_id = ?
                ORDER BY i.created_at DESC
            `;
            
            this.db.all(sql, [customerId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getCustomersByPackage(packageId) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT c.*, p.name as package_name, p.price as package_price, p.speed as package_speed
                FROM customers c
                LEFT JOIN packages p ON c.package_id = p.id
                WHERE c.package_id = ?
                ORDER BY c.name ASC
            `;
            
            this.db.all(sql, [packageId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getInvoicesByCustomerAndDateRange(customerUsername, startDate, endDate) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.*, c.username, c.name as customer_name, c.phone as customer_phone,
                       p.name as package_name, p.speed as package_speed
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN packages p ON i.package_id = p.id
                WHERE c.username = ? 
                AND i.created_at BETWEEN ? AND ?
                ORDER BY i.created_at DESC
            `;
            
            const params = [
                customerUsername,
                startDate.toISOString(),
                endDate.toISOString()
            ];
            
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getInvoiceById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.*, c.username, c.name as customer_name, c.phone as customer_phone,
                       p.name as package_name, p.speed as package_speed
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN packages p ON i.package_id = p.id
                WHERE i.id = ?
            `;
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateInvoiceStatus(id, status, paymentMethod = null) {
        return new Promise((resolve, reject) => {
            const paymentDate = status === 'paid' ? new Date().toISOString() : null;
            const sql = `UPDATE invoices SET status = ?, payment_date = ?, payment_method = ? WHERE id = ?`;
            
            this.db.run(sql, [status, paymentDate, paymentMethod, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id, status, payment_date: paymentDate, payment_method: paymentMethod });
                }
            });
        });
    }

    async updateInvoice(id, invoiceData) {
        return new Promise((resolve, reject) => {
            const { customer_id, package_id, amount, due_date, notes } = invoiceData;
            const sql = `UPDATE invoices SET customer_id = ?, package_id = ?, amount = ?, due_date = ?, notes = ? WHERE id = ?`;
            
            this.db.run(sql, [customer_id, package_id, amount, due_date, notes, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    // Get the updated invoice
                    this.getInvoiceById(id).then(resolve).catch(reject);
                }
            });
        });
    }

    async deleteInvoice(id) {
        return new Promise((resolve, reject) => {
            // First get the invoice details before deleting
            this.getInvoiceById(id).then(invoice => {
                const sql = `DELETE FROM invoices WHERE id = ?`;
                this.db.run(sql, [id], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(invoice);
                    }
                });
            }).catch(reject);
        });
    }

    // Payment Management
    async recordPayment(paymentData) {
        return new Promise((resolve, reject) => {
            const { invoice_id, amount, payment_method, reference_number, notes } = paymentData;
            const sql = `INSERT INTO payments (invoice_id, amount, payment_method, reference_number, notes) VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(sql, [invoice_id, amount, payment_method, reference_number, notes], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...paymentData });
                }
            });
        });
    }

    async getPayments(invoiceId = null) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT p.*, i.invoice_number, c.username, c.name as customer_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
            `;
            
            const params = [];
            if (invoiceId) {
                sql += ` WHERE p.invoice_id = ?`;
                params.push(invoiceId);
            }
            
            sql += ` ORDER BY p.payment_date DESC`;
            
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getPaymentById(id) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT p.*, i.invoice_number, c.username, c.name as customer_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN customers c ON i.customer_id = c.id
                WHERE p.id = ?
            `;
            
            this.db.get(sql, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Utility functions
    generateInvoiceNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INV-${year}${month}-${random}`;
    }

    async getBillingStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(DISTINCT c.id) as total_customers,
                    COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_customers,
                    COUNT(i.id) as total_invoices,
                    COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_invoices,
                    COUNT(CASE WHEN i.status = 'unpaid' THEN 1 END) as unpaid_invoices,
                    SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as total_revenue,
                    SUM(CASE WHEN i.status = 'unpaid' THEN i.amount ELSE 0 END) as total_unpaid
                FROM customers c
                LEFT JOIN invoices i ON c.id = i.customer_id
            `;
            
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getOverdueInvoices() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT i.*, c.username, c.name as customer_name, c.phone as customer_phone,
                       p.name as package_name
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN packages p ON i.package_id = p.id
                WHERE i.status = 'unpaid' AND i.due_date < date('now')
                ORDER BY i.due_date ASC
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    logger.error('Error closing billing database:', err);
                } else {
                    logger.info('Billing database connection closed');
                }
            });
        }
    }
}

// Create singleton instance
const billingManager = new BillingManager();

module.exports = billingManager; 