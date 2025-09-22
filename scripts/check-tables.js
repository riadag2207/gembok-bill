const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/billing.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 Checking required tables...');

// Check if technicians table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='technicians'", (err, rows) => {
    if (err) {
        console.error('❌ Error checking technicians table:', err);
    } else {
        console.log('✅ Technicians table exists:', rows.length > 0);
    }
});

// Check if installation_jobs table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='installation_jobs'", (err, rows) => {
    if (err) {
        console.error('❌ Error checking installation_jobs table:', err);
    } else {
        console.log('✅ Installation_jobs table exists:', rows.length > 0);
    }
});

// Check if packages table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='packages'", (err, rows) => {
    if (err) {
        console.error('❌ Error checking packages table:', err);
    } else {
        console.log('✅ Packages table exists:', rows.length > 0);
    }
});

// List all tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error('❌ Error listing tables:', err);
    } else {
        console.log('📋 All tables:', rows.map(r => r.name));
    }
    db.close();
});
