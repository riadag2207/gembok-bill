const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/billing.db');

console.log('🔍 Memeriksa struktur tabel technicians...');

db.serialize(() => {
    // Cek struktur tabel
    db.all("PRAGMA table_info(technicians)", (err, rows) => {
        if (err) {
            console.error('❌ Error:', err);
            return;
        }

        console.log('📋 Struktur Tabel technicians:');
        rows.forEach(row => {
            console.log(`   - ${row.name}: ${row.type} ${row.dflt_value ? '(default: ' + row.dflt_value + ')' : ''} ${row.notnull ? '(NOT NULL)' : ''} ${row.pk ? '(PRIMARY KEY)' : ''}`);
        });

        // Cek data yang ada
        db.all("SELECT * FROM technicians", (err, techRows) => {
            if (err) {
                console.error('❌ Error getting technicians:', err);
            } else {
                console.log(`\n📊 Data teknisi (${techRows.length} total):`);
                techRows.forEach(row => {
                    console.log(`   ID: ${row.id} | Nama: ${row.name} | Phone: ${row.phone} | Role: ${row.role} | Status: ${row.is_active ? 'Aktif' : 'Tidak Aktif'}`);
                });
            }

            db.close();
        });
    });
});
