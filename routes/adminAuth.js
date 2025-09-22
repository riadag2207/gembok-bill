const express = require('express');
const router = express.Router();
const { getSetting } = require('../config/settingsManager');
const { validateConfiguration, getValidationSummary, checkForDefaultSettings } = require('../config/configValidator');

// Cache untuk admin credentials (optional, untuk performance)
let adminCredentials = null;
let credentialsCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

function getAdminCredentials() {
  const now = Date.now();
  if (!adminCredentials || (now - credentialsCacheTime) > CACHE_DURATION) {
    adminCredentials = {
      username: getSetting('admin_username', 'admin'),
      password: getSetting('admin_password', 'admin')
    };
    credentialsCacheTime = now;
  }
  return adminCredentials;
}

// Middleware cek login admin
function adminAuth(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// GET: Halaman login admin
router.get('/login', (req, res) => {
  res.render('adminLogin', { error: null });
});

// Test route untuk debugging
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes working!', timestamp: new Date().toISOString() });
});

// Route mobile login sudah dipindah ke app.js untuk menghindari konflik

// Route mobile login sudah dipindah ke app.js untuk menghindari konflik

// POST: Proses login admin - Optimized
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const credentials = getAdminCredentials();

    // Fast validation
    if (!username || !password) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ success: false, message: 'Username dan password harus diisi!' });
      } else {
        return res.render('adminLogin', { error: 'Username dan password harus diisi!' });
      }
    }

    // Autentikasi dengan cache
    if (username === credentials.username && password === credentials.password) {
      req.session.isAdmin = true;
      req.session.adminUser = username;
      
      // Validasi konfigurasi sistem setelah login berhasil (non-blocking)
      // Jalankan validasi secara asinkron tanpa menghambat login
      setImmediate(() => {
        console.log('🔍 [ADMIN_LOGIN] Memvalidasi konfigurasi sistem secara asinkron...');
        
        validateConfiguration().then(validationResults => {
          console.log('🔍 [ADMIN_LOGIN] Validasi selesai, menyimpan hasil ke session...');
          
            // Simpan hasil validasi ke session untuk ditampilkan di dashboard
            // Selalu simpan hasil, baik valid maupun tidak valid
            req.session.configValidation = {
              hasValidationRun: true,
              results: validationResults,
              summary: getValidationSummary(),
              defaultSettingsWarnings: checkForDefaultSettings(),
              lastValidationTime: Date.now()
            };
          
          if (!validationResults.overall.isValid) {
            console.log('⚠️ [ADMIN_LOGIN] Konfigurasi sistem bermasalah - warning akan ditampilkan di dashboard');
          } else {
            console.log('✅ [ADMIN_LOGIN] Konfigurasi sistem valid');
          }
        }).catch(error => {
          console.error('❌ [ADMIN_LOGIN] Error saat validasi konfigurasi:', error);
          // Simpan error state tapi tetap biarkan admin login
          req.session.configValidation = {
            hasValidationRun: true,
            results: null,
            summary: { status: 'error', message: 'Gagal memvalidasi konfigurasi sistem' },
            defaultSettingsWarnings: [],
            lastValidationTime: Date.now()
          };
        });
      });
      
      // Fast response untuk AJAX
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        res.json({ success: true, message: 'Login berhasil!' });
      } else {
        res.redirect('/admin/dashboard');
      }
    } else {
      // Fast error response
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        res.status(401).json({ success: false, message: 'Username atau password salah!' });
      } else {
        res.render('adminLogin', { error: 'Username atau password salah.' });
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login!' });
    } else {
      res.render('adminLogin', { error: 'Terjadi kesalahan saat login.' });
    }
  }
});

// GET: Redirect /admin to dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.isAdmin) {
    res.redirect('/admin/dashboard');
  } else {
    res.redirect('/admin/login');
  }
});

// GET: Logout admin
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

module.exports = { router, adminAuth };
