const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path ke database billing
const dbPath = path.join(__dirname, '../data/billing.db');

// Buat koneksi database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to billing database');
});

// Fungsi untuk memeriksa struktur database
function checkDatabaseStructure() {
    return new Promise((resolve, reject) => {
        console.log('🔍 Checking database structure for financial reporting...\n');
        
        // Cek struktur tabel payment_gateway_transactions
        db.all("PRAGMA table_info(payment_gateway_transactions)", (err, columns) => {
            if (err) {
                console.log('❌ Table payment_gateway_transactions not found');
                resolve();
                return;
            }
            
            console.log('📊 Table: payment_gateway_transactions');
            console.log('Columns:');
            columns.forEach(col => {
                console.log(`  - ${col.name}: ${col.type} - ${col.notnull ? 'REQUIRED' : 'OPTIONAL'}`);
            });
            
            // Cek kolom yang dibutuhkan untuk laporan keuangan
            const requiredColumns = ['payment_method', 'gateway_name'];
            const missingColumns = requiredColumns.filter(col => 
                !columns.some(c => c.name === col)
            );
            
            if (missingColumns.length > 0) {
                console.log(`\n❌ Missing columns: ${missingColumns.join(', ')}`);
            } else {
                console.log('\n✅ All required columns exist');
            }
            
            // Cek struktur tabel invoices
            db.all("PRAGMA table_info(invoices)", (err, invoiceColumns) => {
                if (err) {
                    console.log('❌ Table invoices not found');
                    resolve();
                    return;
                }
                
                console.log('\n📊 Table: invoices');
                console.log('Columns:');
                invoiceColumns.forEach(col => {
                    console.log(`  - ${col.name}: ${col.type} - ${col.notnull ? 'REQUIRED' : 'OPTIONAL'}`);
                });
                
                // Cek kolom PPN
                const ppnColumns = ['base_amount', 'tax_rate'];
                const missingPPNColumns = ppnColumns.filter(col => 
                    !invoiceColumns.some(c => c.name === col)
                );
                
                if (missingPPNColumns.length > 0) {
                    console.log(`\n❌ Missing PPN columns: ${missingPPNColumns.join(', ')}`);
                } else {
                    console.log('\n✅ All PPN columns exist');
                }
                
                // Cek struktur tabel expenses
                db.all("PRAGMA table_info(expenses)", (err, expenseColumns) => {
                    if (err) {
                        console.log('❌ Table expenses not found');
                        resolve();
                        return;
                    }
                    
                    console.log('\n📊 Table: expenses');
                    console.log('Columns:');
                    expenseColumns.forEach(col => {
                        console.log(`  - ${col.name}: ${col.type} - ${col.notnull ? 'REQUIRED' : 'OPTIONAL'}`);
                    });
                    
                    resolve();
                });
            });
        });
    });
}

// Jalankan script
if (require.main === module) {
    checkDatabaseStructure()
        .then(() => {
            console.log('\n🎯 Database structure check completed!');
            db.close((err) => {
                if (err) {
                    console.error('❌ Error closing database:', err.message);
                } else {
                    console.log('🔒 Database connection closed');
                }
            });
        })
        .catch(error => {
            console.error('\n💥 Script failed:', error.message);
            process.exit(1);
        });
}

module.exports = { checkDatabaseStructure };
