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
    console.log('Connected to billing database');
});

// Fungsi untuk menambahkan kolom koordinat
function addCoordinatesColumns() {
    return new Promise((resolve, reject) => {
        // Cek apakah kolom latitude sudah ada
        db.all("PRAGMA table_info(customers)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            const hasLatitude = columns.some(col => col.name === 'latitude');
            const hasLongitude = columns.some(col => col.name === 'longitude');
            
            if (hasLatitude && hasLongitude) {
                console.log('✅ Kolom latitude dan longitude sudah ada di tabel customers');
                resolve();
                return;
            }
            
            // Tambahkan kolom latitude jika belum ada
            if (!hasLatitude) {
                db.run("ALTER TABLE customers ADD COLUMN latitude DECIMAL(10,8)", (err) => {
                    if (err) {
                        console.error('Error adding latitude column:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Berhasil menambahkan kolom latitude ke tabel customers');
                    
                    // Tambahkan kolom longitude jika belum ada
                    if (!hasLongitude) {
                        db.run("ALTER TABLE customers ADD COLUMN longitude DECIMAL(11,8)", (err) => {
                            if (err) {
                                console.error('Error adding longitude column:', err);
                                reject(err);
                                return;
                            }
                            console.log('✅ Berhasil menambahkan kolom longitude ke tabel customers');
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            } else {
                // Hanya tambahkan longitude
                db.run("ALTER TABLE customers ADD COLUMN longitude DECIMAL(11,8)", (err) => {
                    if (err) {
                        console.error('Error adding longitude column:', err);
                        reject(err);
                        return;
                    }
                    console.log('✅ Berhasil menambahkan kolom longitude ke tabel customers');
                    resolve();
                });
            }
        });
    });
}

// Fungsi untuk menampilkan struktur tabel customers
function showTableStructure() {
    return new Promise((resolve, reject) => {
        db.all("PRAGMA table_info(customers)", (err, columns) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log('\n📋 Struktur Tabel Customers:');
            console.log('┌─────────────────┬─────────────┬─────────┬─────────┬─────────┐');
            console.log('│ Nama Kolom     │ Tipe Data  │ Not Null│ Default │ Primary │');
            console.log('├─────────────────┼─────────────┼─────────┼─────────┼─────────┤');
            
            columns.forEach(col => {
                const notNull = col.notnull ? 'YES' : 'NO';
                const primary = col.pk ? 'YES' : 'NO';
                const defaultValue = col.dflt_value || 'NULL';
                
                console.log(`│ ${col.name.padEnd(15)} │ ${col.type.padEnd(11)} │ ${notNull.padEnd(7)} │ ${defaultValue.toString().padEnd(7)} │ ${primary.padEnd(7)} │`);
            });
            
            console.log('└─────────────────┴─────────────┴─────────┴─────────┴─────────┘');
            resolve();
        });
    });
}

// Fungsi untuk menampilkan sample data customers
function showCustomersData() {
    return new Promise((resolve, reject) => {
        db.all("SELECT id, name, phone, latitude, longitude FROM customers LIMIT 5", (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            console.log('\n👥 Data Customers (Sample):');
            console.log('┌────┬─────────────────┬─────────────┬─────────────┬─────────────┐');
            console.log('│ ID │ Nama Customer  │ Phone      │ Latitude   │ Longitude  │');
            console.log('├────┼─────────────────┼─────────────┼─────────────┼─────────────┤');
            
            rows.forEach(row => {
                const lat = row.latitude ? row.latitude.toFixed(6) : 'NULL';
                const lng = row.longitude ? row.longitude.toFixed(6) : 'NULL';
                
                console.log(`│ ${row.id.toString().padEnd(2)} │ ${row.name.padEnd(15)} │ ${row.phone.padEnd(11)} │ ${lat.padEnd(11)} │ ${lng.padEnd(11)} │`);
            });
            
            console.log('└────┴─────────────────┴─────────────┴─────────────┴─────────────┘');
            resolve();
        });
    });
}

// Fungsi untuk update koordinat default (Jakarta) untuk customer yang belum punya koordinat
function updateDefaultCoordinates() {
    return new Promise((resolve, reject) => {
        // Jakarta coordinates
        const defaultLat = -6.2088;
        const defaultLng = 106.8456;
        
        db.run("UPDATE customers SET latitude = ?, longitude = ? WHERE latitude IS NULL OR longitude IS NULL", 
            [defaultLat, defaultLng], (err) => {
                if (err) {
                    console.log('⚠️ Warning: Gagal update koordinat default:', err.message);
                } else {
                    console.log('✅ Berhasil update koordinat default untuk customer yang belum punya koordinat');
                }
                resolve();
            });
    });
}

// Main execution
async function main() {
    try {
        console.log('🚀 Memulai migrasi database untuk fitur mapping...\n');
        
        // Tambahkan kolom koordinat
        await addCoordinatesColumns();
        
        // Update koordinat default
        await updateDefaultCoordinates();
        
        // Tampilkan struktur tabel
        await showTableStructure();
        
        // Tampilkan data sample
        await showCustomersData();
        
        console.log('\n✅ Migrasi database selesai! Fitur mapping sudah siap digunakan.');
        console.log('\n📝 Catatan:');
        console.log('   • Semua customer yang belum punya koordinat akan menggunakan koordinat default Jakarta');
        console.log('   • Admin dapat mengubah koordinat per customer melalui form edit');
        console.log('   • Fitur mapping tersedia di menu Network Mapping');
        console.log('   • Koordinat dapat diambil dari GPS atau dipilih dari peta');
        
    } catch (error) {
        console.error('❌ Error selama migrasi:', error.message);
        process.exit(1);
    } finally {
        // Tutup koneksi database
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('\n🔒 Database connection closed');
            }
        });
    }
}

// Jalankan script
if (require.main === module) {
    main();
}

module.exports = { addCoordinatesColumns, showTableStructure, showCustomersData };
