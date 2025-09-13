const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../config/logger');
const { adminAuth } = require('./adminAuth');
const { getSetting } = require('../config/settingsManager');
const CableNetworkUtils = require('../utils/cableNetworkUtils');

// Middleware untuk mendapatkan pengaturan aplikasi
const getAppSettings = (req, res, next) => {
    req.appSettings = {
        companyHeader: getSetting('company_header', 'ISP Monitor'),
        companyName: getSetting('company_name', 'ISP Company'),
        companyAddress: getSetting('company_address', ''),
        companyPhone: getSetting('company_phone', ''),
        companyEmail: getSetting('company_email', ''),
        logoUrl: getSetting('logo_url', ''),
        whatsappNumber: getSetting('whatsapp_number', ''),
        whatsappApiKey: getSetting('whatsapp_api_key', ''),
        midtransServerKey: getSetting('midtrans_server_key', ''),
        midtransClientKey: getSetting('midtrans_client_key', ''),
        xenditSecretKey: getSetting('xendit_secret_key', ''),
        xenditPublicKey: getSetting('xendit_public_key', ''),
        timezone: getSetting('timezone', 'Asia/Jakarta')
    };
    next();
};

// Database path
const dbPath = path.join(__dirname, '../data/billing.db');

// Helper function untuk koneksi database
function getDatabase() {
    return new sqlite3.Database(dbPath);
}

// ===== CABLE NETWORK DASHBOARD =====

// GET: Halaman utama Cable Network
router.get('/', adminAuth, getAppSettings, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil statistik umum
        const stats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    (SELECT COUNT(*) FROM odps) as total_odps,
                    (SELECT COUNT(*) FROM odps WHERE status = 'active') as active_odps,
                    (SELECT COUNT(*) FROM odps WHERE status = 'maintenance') as maintenance_odps,
                    (SELECT COUNT(*) FROM cable_routes) as total_cables,
                    (SELECT COUNT(*) FROM cable_routes WHERE status = 'connected') as connected_cables,
                    (SELECT COUNT(*) FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL) as mapped_customers
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows[0]);
            });
        });

        // Ambil ODP terbaru
        const recentODPs = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM odps 
                ORDER BY created_at DESC 
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Ambil cable routes terbaru
        const recentCables = await new Promise((resolve, reject) => {
            db.all(`
                SELECT cr.*, c.name as customer_name, c.phone as customer_phone
                FROM cable_routes cr
                LEFT JOIN customers c ON cr.customer_id = c.id
                ORDER BY cr.created_at DESC 
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        db.close();

        res.render('admin/cable-network/dashboard', {
            title: 'Cable Network Dashboard',
            page: 'cable-network',
            stats,
            recentODPs,
            recentCables,
            appSettings: req.appSettings
        });

    } catch (error) {
        logger.error('Error loading cable network dashboard:', error);
        res.status(500).render('error', { 
            error: 'Failed to load cable network dashboard',
            appSettings: req.appSettings 
        });
    }
});

// ===== ODP MANAGEMENT =====

// GET: Halaman ODP Management
router.get('/odp', adminAuth, getAppSettings, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil data ODP dengan statistik dan parent ODP info
        const odps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT o.*, 
                       p.name as parent_name,
                       p.code as parent_code,
                       COUNT(cr.id) as connected_customers,
                       COUNT(CASE WHEN cr.status = 'connected' THEN 1 END) as active_connections
                FROM odps o
                LEFT JOIN odps p ON o.parent_odp_id = p.id
                LEFT JOIN cable_routes cr ON o.id = cr.odp_id
                GROUP BY o.id
                ORDER BY o.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Ambil data parent ODP untuk dropdown (hanya ODP yang tidak memiliki parent)
        const parentOdps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, name, code, capacity, used_ports, status
                FROM odps 
                WHERE parent_odp_id IS NULL AND status = 'active'
                ORDER BY name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        res.render('admin/cable-network/odp', {
            title: 'ODP Management',
            page: 'cable-network-odp',
            appSettings: req.appSettings,
            odps: odps,
            parentOdps: parentOdps
        });
    } catch (error) {
        logger.error('Error loading ODP page:', error);
        res.status(500).render('error', {
            message: 'Error loading ODP page',
            error: error.message,
            appSettings: req.appSettings
        });
    }
});

// POST: Tambah ODP baru
router.post('/odp', adminAuth, async (req, res) => {
    try {
        const { name, code, parent_odp_id, latitude, longitude, address, capacity, status, notes } = req.body;
        
        // Validasi input
        if (!name || !code || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: 'Nama, kode, latitude, dan longitude wajib diisi'
            });
        }
        
        // Validasi koordinat
        if (!CableNetworkUtils.validateODPCoordinates(parseFloat(latitude), parseFloat(longitude))) {
            return res.status(400).json({
                success: false,
                message: 'Koordinat tidak valid'
            });
        }
        
        const db = getDatabase();
        
        // Cek apakah kode sudah ada
        const existingODP = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM odps WHERE code = ?', [code], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existingODP) {
            db.close();
            return res.status(400).json({
                success: false,
                message: 'Kode ODP sudah digunakan'
            });
        }
        
        // Insert ODP baru
        const newODPId = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO odps (name, code, parent_odp_id, latitude, longitude, address, capacity, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [name, code, parent_odp_id || null, latitude, longitude, address, capacity || 64, status || 'active', notes], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        // Ambil data ODP yang baru dibuat untuk response
        const newODP = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM odps WHERE id = ?', [newODPId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'ODP berhasil ditambahkan',
            data: { 
                id: newODPId,
                odp: newODP,
                suggestNetworkSegment: true // Flag untuk menyarankan membuat network segment
            }
        });
        
    } catch (error) {
        logger.error('Error adding ODP:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menambahkan ODP'
        });
    }
});

// PUT: Update ODP
router.put('/odp/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, parent_odp_id, latitude, longitude, address, capacity, status, notes } = req.body;
        
        // Log data yang diterima
        console.log('Updating ODP ID:', id);
        console.log('Received data:', { name, code, parent_odp_id, latitude, longitude, address, capacity, status, notes });
        
        const db = getDatabase();
        
        // Cek apakah ODP ada sebelum update
        const existingODP = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM odps WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!existingODP) {
            db.close();
            return res.status(404).json({
                success: false,
                message: 'ODP tidak ditemukan'
            });
        }
        
        console.log('Existing ODP before update:', existingODP);
        
        const result = await new Promise((resolve, reject) => {
            db.run(`
                UPDATE odps 
                SET name = ?, code = ?, parent_odp_id = ?, latitude = ?, longitude = ?, address = ?, 
                    capacity = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [name, code, parent_odp_id || null, latitude, longitude, address, capacity, status || 'active', notes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        console.log('Update result:', result);
        
        // Verifikasi data setelah update
        const updatedODP = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM odps WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('ODP after update:', updatedODP);
        
        db.close();
        
        res.json({
            success: true,
            message: 'ODP berhasil diperbarui',
            data: updatedODP
        });
        
    } catch (error) {
        logger.error('Error updating ODP:', error);
        console.error('Error updating ODP:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui ODP'
        });
    }
});

// DELETE: Hapus ODP
router.delete('/odp/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const db = getDatabase();
        
        // Cek apakah ODP masih digunakan
        const usedRoutes = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM cable_routes WHERE odp_id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        if (usedRoutes > 0) {
            db.close();
            return res.status(400).json({
                success: false,
                message: 'ODP tidak dapat dihapus karena masih digunakan oleh kabel pelanggan'
            });
        }
        
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM odps WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'ODP berhasil dihapus'
        });
        
    } catch (error) {
        logger.error('Error deleting ODP:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus ODP'
        });
    }
});

// ===== CABLE ROUTE MANAGEMENT =====

// GET: Halaman Cable Route Management
router.get('/cables', adminAuth, getAppSettings, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil data cable routes dengan detail customer dan ODP
        const cableRoutes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT cr.*, 
                       c.name as customer_name, c.phone as customer_phone,
                       c.latitude as customer_latitude, c.longitude as customer_longitude,
                       o.name as odp_name, o.code as odp_code,
                       o.latitude as odp_latitude, o.longitude as odp_longitude
                FROM cable_routes cr
                JOIN customers c ON cr.customer_id = c.id
                JOIN odps o ON cr.odp_id = o.id
                ORDER BY cr.created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data ODP untuk dropdown
        const odps = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM odps WHERE status = "active" ORDER BY name', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data customers tanpa cable route
        const customersWithoutCable = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.* FROM customers c
                LEFT JOIN cable_routes cr ON c.id = cr.customer_id
                WHERE cr.id IS NULL AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
                ORDER BY c.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        res.render('admin/cable-network/cables', {
            title: 'Cable Route Management',
            page: 'cable-network-cables',
            appSettings: req.appSettings,
            cableRoutes: cableRoutes,
            odps: odps,
            customersWithoutCable: customersWithoutCable
        });
    } catch (error) {
        logger.error('Error loading cable routes page:', error);
        res.status(500).render('error', {
            message: 'Error loading cable routes page',
            error: error.message,
            appSettings: req.appSettings
        });
    }
});

// POST: Tambah Cable Route
router.post('/cables', adminAuth, async (req, res) => {
    try {
        const { customer_id, odp_id, cable_length, cable_type, port_number, notes } = req.body;
        
        // Validasi input
        if (!customer_id || !odp_id) {
            return res.status(400).json({
                success: false,
                message: 'Customer dan ODP wajib dipilih'
            });
        }
        
        const db = getDatabase();
        
        // Cek apakah customer sudah punya cable route
        const existingRoute = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM cable_routes WHERE customer_id = ?', [customer_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (existingRoute) {
            db.close();
            return res.status(400).json({
                success: false,
                message: 'Customer sudah memiliki jalur kabel'
            });
        }
        
        // Hitung panjang kabel otomatis jika tidak diisi
        let calculatedLength = cable_length;
        if (!cable_length) {
            const customer = await new Promise((resolve, reject) => {
                db.get('SELECT latitude, longitude FROM customers WHERE id = ?', [customer_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const odp = await new Promise((resolve, reject) => {
                db.get('SELECT latitude, longitude FROM odps WHERE id = ?', [odp_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (customer && odp) {
                calculatedLength = CableNetworkUtils.calculateCableDistance(
                    { latitude: customer.latitude, longitude: customer.longitude },
                    { latitude: odp.latitude, longitude: odp.longitude }
                );
            }
        }
        
        // Insert cable route
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO cable_routes (customer_id, odp_id, cable_length, cable_type, port_number, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [customer_id, odp_id, calculatedLength, cable_type || 'Fiber Optic', port_number, notes], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Jalur kabel berhasil ditambahkan',
            data: { 
                id: this.lastID,
                cable_length: calculatedLength
            }
        });
        
    } catch (error) {
        logger.error('Error adding cable route:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menambahkan jalur kabel'
        });
    }
});

// PUT: Update Cable Route Status
router.put('/cables/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const db = getDatabase();
        
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE cable_routes 
                SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, notes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Status kabel berhasil diperbarui'
        });
        
    } catch (error) {
        logger.error('Error updating cable status:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui status kabel'
        });
    }
});

// PUT: Update Cable Route
router.put('/cables/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { cable_type, cable_length, port_number, status, notes } = req.body;
        
        // Log data yang diterima
        console.log('Updating Cable Route ID:', id);
        console.log('Received data:', { cable_type, cable_length, port_number, status, notes });
        
        const db = getDatabase();
        
        // Cek apakah cable route ada sebelum update
        const existingCable = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM cable_routes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!existingCable) {
            db.close();
            return res.status(404).json({
                success: false,
                message: 'Cable route tidak ditemukan'
            });
        }
        
        console.log('Existing cable route before update:', existingCable);
        
        const result = await new Promise((resolve, reject) => {
            db.run(`
                UPDATE cable_routes 
                SET cable_type = ?, cable_length = ?, port_number = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [cable_type, cable_length, port_number, status || 'connected', notes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        console.log('Update result:', result);
        
        // Verifikasi data setelah update
        const updatedCable = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM cable_routes WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        console.log('Cable route after update:', updatedCable);
        
        db.close();
        
        res.json({
            success: true,
            message: 'Cable route berhasil diperbarui',
            data: updatedCable
        });
        
    } catch (error) {
        logger.error('Error updating cable route:', error);
        console.error('Error updating cable route:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui cable route'
        });
    }
});

// ===== API ENDPOINTS =====

// GET: API untuk data ODP dan Cable Routes untuk mapping
router.get('/api/mapping-data', adminAuth, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil data ODP
        const odps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT o.*, 
                       COUNT(cr.id) as connected_customers,
                       COUNT(CASE WHEN cr.status = 'connected' THEN 1 END) as active_connections
                FROM odps o
                LEFT JOIN cable_routes cr ON o.id = cr.odp_id
                GROUP BY o.id
                ORDER BY o.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data cable routes dengan detail
        const cableRoutes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT cr.*, 
                       c.name as customer_name, c.phone as customer_phone,
                       c.latitude as customer_latitude, c.longitude as customer_longitude,
                       o.name as odp_name, o.latitude as odp_latitude, o.longitude as odp_longitude
                FROM cable_routes cr
                JOIN customers c ON cr.customer_id = c.id
                JOIN odps o ON cr.odp_id = o.id
                WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data network segments
        const networkSegments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ns.*, 
                       o1.name as start_odp_name, o1.latitude as start_latitude, o1.longitude as start_longitude,
                       o2.name as end_odp_name, o2.latitude as end_latitude, o2.longitude as end_longitude
                FROM network_segments ns
                JOIN odps o1 ON ns.start_odp_id = o1.id
                LEFT JOIN odps o2 ON ns.end_odp_id = o2.id
                WHERE ns.status = 'active'
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        // Analisis statistik
        const odpAnalysis = CableNetworkUtils.analyzeODPCapacity(odps);
        const cableAnalysis = CableNetworkUtils.analyzeCableStatus(cableRoutes);
        
        res.json({
            success: true,
            data: {
                odps: odps,
                cableRoutes: cableRoutes,
                networkSegments: networkSegments,
                analysis: {
                    odps: odpAnalysis,
                    cables: cableAnalysis
                }
            }
        });
        
    } catch (error) {
        logger.error('Error getting mapping data:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data mapping'
        });
    }
});

// GET: Halaman Analytics
router.get('/analytics', adminAuth, getAppSettings, async (req, res) => {
    try {
        res.render('admin/cable-network/analytics', {
            title: 'Cable Network Analytics',
            page: 'cable-network-analytics',
            appSettings: req.appSettings
        });
    } catch (error) {
        logger.error('Error loading analytics page:', error);
        res.status(500).render('error', {
            message: 'Error loading analytics page',
            error: error.message,
            appSettings: req.appSettings
        });
    }
});

// GET: API untuk statistik cable network
router.get('/api/statistics', adminAuth, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Statistik ODP
        const odpStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_odps,
                    SUM(capacity) as total_capacity,
                    SUM(used_ports) as total_used_ports,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_odps,
                    COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_odps
                FROM odps
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        // Statistik Cable Routes
        const cableStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as total_cables,
                    SUM(cable_length) as total_length,
                    COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected_cables,
                    COUNT(CASE WHEN status = 'disconnected' THEN 1 END) as disconnected_cables,
                    COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance_cables,
                    COUNT(CASE WHEN status = 'damaged' THEN 1 END) as damaged_cables
                FROM cable_routes
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            data: {
                odps: odpStats,
                cables: cableStats,
                utilization: odpStats.total_capacity > 0 ? 
                    (odpStats.total_used_ports / odpStats.total_capacity) * 100 : 0
            }
        });
        
    } catch (error) {
        logger.error('Error getting statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik'
        });
    }
});

// GET: API untuk analytics data
router.get('/api/analytics', adminAuth, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil data ODP dengan statistik
        const odps = await new Promise((resolve, reject) => {
            db.all(`
                SELECT o.*, 
                       COUNT(cr.id) as connected_customers,
                       COUNT(CASE WHEN cr.status = 'connected' THEN 1 END) as active_connections
                FROM odps o
                LEFT JOIN cable_routes cr ON o.id = cr.odp_id
                GROUP BY o.id
                ORDER BY o.name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data cable routes
        const cableRoutes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT cr.*, 
                       c.name as customer_name, c.phone as customer_phone,
                       c.latitude as customer_latitude, c.longitude as customer_longitude,
                       o.name as odp_name, o.latitude as odp_latitude, o.longitude as odp_longitude
                FROM cable_routes cr
                JOIN customers c ON cr.customer_id = c.id
                JOIN odps o ON cr.odp_id = o.id
                WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        // Analisis data untuk analytics
        const odpAnalysis = CableNetworkUtils.analyzeODPCapacity(odps);
        const cableAnalysis = CableNetworkUtils.analyzeCableStatus(cableRoutes);
        
        // Hitung utilization rate
        const totalCapacity = odpAnalysis.totalCapacity;
        const totalUsed = odpAnalysis.totalUsed;
        const utilization = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;
        
        // Hitung health score
        const connectedCables = cableAnalysis.connected;
        const totalCables = cableAnalysis.total;
        const healthScore = totalCables > 0 ? (connectedCables / totalCables) * 100 : 100;
        
        // Generate alerts
        const alerts = [];
        
        // Alert untuk ODP dengan kapasitas tinggi
        odpAnalysis.critical.forEach(odp => {
            alerts.push({
                type: 'danger',
                icon: 'bx-error-circle',
                title: 'Critical ODP Capacity',
                message: `${odp.name} is at ${((odp.used_ports / odp.capacity) * 100).toFixed(1)}% capacity`
            });
        });
        
        // Alert untuk cable yang disconnected
        if (cableAnalysis.disconnected > 0) {
            alerts.push({
                type: 'warning',
                icon: 'bx-wifi-off',
                title: 'Disconnected Cables',
                message: `${cableAnalysis.disconnected} cables are disconnected`
            });
        }
        
        // Alert untuk cable yang damaged
        if (cableAnalysis.damaged > 0) {
            alerts.push({
                type: 'danger',
                icon: 'bx-error',
                title: 'Damaged Cables',
                message: `${cableAnalysis.damaged} cables are damaged and need repair`
            });
        }
        
        // Top ODPs by usage
        const topODPs = odps
            .sort((a, b) => (b.used_ports / b.capacity) - (a.used_ports / a.capacity))
            .slice(0, 5);
        
        // Simulasi data trend (dalam implementasi nyata, ini akan diambil dari historical data)
        const utilizationTrend = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            data: [65, 70, 75, 68, 72, utilization]
        };
        
        // Simulasi performance metrics
        const performance = {
            avgUptime: 99.5,
            avgResponseTime: 15,
            maintenanceCount: 3
        };
        
        // Simulasi cost analysis
        const totalCableLength = cableRoutes.reduce((sum, route) => 
            sum + (parseFloat(route.cable_length) || 0), 0);
        const costPerKm = 25000; // IDR per km
        const totalInvestment = totalCableLength * costPerKm;
        
        const cost = {
            costPerKm: costPerKm,
            totalInvestment: totalInvestment
        };
        
        res.json({
            success: true,
            data: {
                odps: {
                    total: odpAnalysis.total,
                    healthy: odpAnalysis.healthy.length,
                    warning: odpAnalysis.warning.length,
                    critical: odpAnalysis.critical.length,
                    utilization: odpAnalysis.utilization,
                    heatmap: odps.map(odp => ({
                        name: odp.name,
                        code: odp.code,
                        used_ports: odp.used_ports,
                        capacity: odp.capacity
                    }))
                },
                cables: {
                    total: cableAnalysis.total,
                    connected: cableAnalysis.connected,
                    disconnected: cableAnalysis.disconnected,
                    maintenance: cableAnalysis.maintenance,
                    damaged: cableAnalysis.damaged,
                    healthPercentage: cableAnalysis.healthPercentage,
                    totalLength: totalCableLength
                },
                utilization: utilization,
                healthScore: healthScore,
                alerts: alerts,
                topODPs: topODPs,
                utilizationTrend: utilizationTrend,
                performance: performance,
                cost: cost
            }
        });
        
    } catch (error) {
        logger.error('Error getting analytics data:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data analytics'
        });
    }
});

// GET: API untuk cable routes berdasarkan ODP ID
router.get('/api/odp/:id/cable-routes', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        
        const cableRoutes = await new Promise((resolve, reject) => {
            db.all(`
                SELECT cr.*, 
                       c.name as customer_name, c.phone as customer_phone,
                       c.latitude as customer_latitude, c.longitude as customer_longitude
                FROM cable_routes cr
                JOIN customers c ON cr.customer_id = c.id
                WHERE cr.odp_id = ?
                ORDER BY cr.created_at DESC
            `, [id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            data: cableRoutes
        });
        
    } catch (error) {
        logger.error('Error getting cable routes for ODP:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil cable routes untuk ODP'
        });
    }
});

// ===== NETWORK SEGMENT MANAGEMENT =====

// GET: Halaman Network Segments
router.get('/network-segments', adminAuth, getAppSettings, async (req, res) => {
    try {
        const db = getDatabase();
        
        // Ambil data network segments dengan detail ODP
        const networkSegments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ns.*, 
                       o1.name as start_odp_name, o1.code as start_odp_code,
                       o2.name as end_odp_name, o2.code as end_odp_code
                FROM network_segments ns
                JOIN odps o1 ON ns.start_odp_id = o1.id
                LEFT JOIN odps o2 ON ns.end_odp_id = o2.id
                ORDER BY ns.created_at DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Ambil data ODP untuk dropdown
        const odps = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM odps WHERE status = "active" ORDER BY name', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        db.close();
        
        res.render('admin/cable-network/network-segments', {
            title: 'Network Segments Management',
            page: 'network-segments',
            networkSegments,
            odps,
            appSettings: req.appSettings
        });
    } catch (error) {
        logger.error('Error loading network segments page:', error);
        res.status(500).render('error', {
            message: 'Error loading network segments page',
            error: error.message,
            appSettings: req.appSettings
        });
    }
});

// GET: Single Network Segment (untuk edit)
router.get('/network-segments/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        
        const segment = await new Promise((resolve, reject) => {
            db.get(`
                SELECT ns.*, 
                       o1.name as start_odp_name, o1.code as start_odp_code,
                       o2.name as end_odp_name, o2.code as end_odp_code
                FROM network_segments ns
                JOIN odps o1 ON ns.start_odp_id = o1.id
                LEFT JOIN odps o2 ON ns.end_odp_id = o2.id
                WHERE ns.id = ?
            `, [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        db.close();
        
        if (segment) {
            res.json({
                success: true,
                data: segment
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Network segment tidak ditemukan'
            });
        }
    } catch (error) {
        logger.error('Error getting network segment:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting network segment'
        });
    }
});

// POST: Tambah Network Segment
router.post('/network-segments', adminAuth, async (req, res) => {
    try {
        const { name, start_odp_id, end_odp_id, segment_type, cable_length, status, notes } = req.body;
        
        // Validasi input
        if (!name || !start_odp_id) {
            return res.status(400).json({
                success: false,
                message: 'Nama dan Start ODP wajib diisi'
            });
        }
        
        const db = getDatabase();
        
        // Cek apakah start ODP ada
        const startODP = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, latitude, longitude FROM odps WHERE id = ?', [start_odp_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!startODP) {
            db.close();
            return res.status(400).json({
                success: false,
                message: 'Start ODP tidak ditemukan'
            });
        }
        
        // Cek apakah end ODP ada (jika diisi)
        let endODP = null;
        if (end_odp_id) {
            endODP = await new Promise((resolve, reject) => {
                db.get('SELECT id, name, latitude, longitude FROM odps WHERE id = ?', [end_odp_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!endODP) {
                db.close();
                return res.status(400).json({
                    success: false,
                    message: 'End ODP tidak ditemukan'
                });
            }
        }
        
        // Hitung panjang kabel otomatis jika tidak diisi
        let calculatedLength = cable_length;
        if (!cable_length && endODP) {
            calculatedLength = CableNetworkUtils.calculateCableDistance(
                { latitude: startODP.latitude, longitude: startODP.longitude },
                { latitude: endODP.latitude, longitude: endODP.longitude }
            );
        }
        
        // Insert network segment
        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO network_segments (name, start_odp_id, end_odp_id, segment_type, cable_length, status, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [name, start_odp_id, end_odp_id || null, segment_type || 'Backbone', calculatedLength, status || 'active', notes], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Network segment berhasil ditambahkan',
            data: { 
                id: result,
                cable_length: calculatedLength
            }
        });
        
    } catch (error) {
        logger.error('Error adding network segment:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menambahkan network segment'
        });
    }
});

// PUT: Update Network Segment
router.put('/network-segments/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, start_odp_id, end_odp_id, segment_type, cable_length, status, notes } = req.body;
        
        const db = getDatabase();
        
        // Cek apakah network segment ada
        const existingSegment = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM network_segments WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!existingSegment) {
            db.close();
            return res.status(404).json({
                success: false,
                message: 'Network segment tidak ditemukan'
            });
        }
        
        // Update network segment
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE network_segments 
                SET name = ?, start_odp_id = ?, end_odp_id = ?, segment_type = ?, 
                    cable_length = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [name, start_odp_id, end_odp_id || null, segment_type, cable_length, status, notes, id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Network segment berhasil diperbarui'
        });
        
    } catch (error) {
        logger.error('Error updating network segment:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui network segment'
        });
    }
});

// DELETE: Hapus Network Segment
router.delete('/network-segments/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const db = getDatabase();
        
        // Cek apakah network segment ada
        const existingSegment = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM network_segments WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!existingSegment) {
            db.close();
            return res.status(404).json({
                success: false,
                message: 'Network segment tidak ditemukan'
            });
        }
        
        // Hapus network segment
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM network_segments WHERE id = ?', [id], function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Network segment berhasil dihapus'
        });
        
    } catch (error) {
        logger.error('Error deleting network segment:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus network segment'
        });
    }
});

// POST: Buat Network Segment Otomatis untuk ODP Baru
router.post('/network-segments/auto-create', adminAuth, async (req, res) => {
    try {
        const { new_odp_id, connect_to_odp_id, segment_type, segment_name } = req.body;
        
        // Validasi input
        if (!new_odp_id || !connect_to_odp_id) {
            return res.status(400).json({
                success: false,
                message: 'New ODP ID dan Connect To ODP ID wajib diisi'
            });
        }
        
        const db = getDatabase();
        
        // Cek apakah kedua ODP ada
        const newODP = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, code, latitude, longitude FROM odps WHERE id = ?', [new_odp_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const connectODP = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, code, latitude, longitude FROM odps WHERE id = ?', [connect_to_odp_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!newODP || !connectODP) {
            db.close();
            return res.status(400).json({
                success: false,
                message: 'ODP tidak ditemukan'
            });
        }
        
        // Hitung panjang kabel otomatis
        const cableLength = CableNetworkUtils.calculateCableDistance(
            { latitude: newODP.latitude, longitude: newODP.longitude },
            { latitude: connectODP.latitude, longitude: connectODP.longitude }
        );
        
        // Buat nama segment otomatis jika tidak diisi
        const autoSegmentName = segment_name || `${newODP.name} - ${connectODP.name}`;
        
        // Insert network segment
        const result = await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO network_segments (name, start_odp_id, end_odp_id, segment_type, cable_length, status, notes)
                VALUES (?, ?, ?, ?, ?, 'active', ?)
            `, [autoSegmentName, new_odp_id, connect_to_odp_id, segment_type || 'Distribution', cableLength, `Auto-created when adding ODP ${newODP.name}`], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        db.close();
        
        res.json({
            success: true,
            message: 'Network segment berhasil dibuat otomatis',
            data: { 
                id: result,
                name: autoSegmentName,
                cable_length: cableLength,
                start_odp: newODP,
                end_odp: connectODP
            }
        });
        
    } catch (error) {
        logger.error('Error auto-creating network segment:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membuat network segment otomatis'
        });
    }
});

module.exports = router;
