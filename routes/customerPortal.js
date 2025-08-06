const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { findDeviceByTag } = require('../config/addWAN');
const { sendMessage } = require('../config/sendMessage');
const { getSettingsWithCache, getSetting } = require('../config/settingsManager');
const billingManager = require('../config/billing');
const router = express.Router();

// Validasi nomor pelanggan ke GenieACS
async function isValidCustomer(phone) {
  // Cari device berdasarkan nomor telepon (tag)
  let device = await findDeviceByTag(phone);
  
  // Jika tidak ditemukan, coba cari berdasarkan PPPoE username dari billing
  if (!device) {
    try {
      const customer = await billingManager.getCustomerByPhone(phone);
      if (customer && customer.pppoe_username) {
        const { findDeviceByPPPoE } = require('../config/genieacs');
        device = await findDeviceByPPPoE(customer.pppoe_username);
      }
    } catch (error) {
      console.error('Error finding device by PPPoE username:', error);
    }
  }
  
  return !!device;
}

// Simpan OTP sementara di memory (bisa diganti redis/db)
const otpStore = {};

// parameterPaths dan getParameterWithPaths dari WhatsApp bot
const parameterPaths = {
  rxPower: [
    'VirtualParameters.RXPower',
    'VirtualParameters.redaman',
    'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower'
  ],
  pppoeIP: [
    'VirtualParameters.pppoeIP',
    'VirtualParameters.pppIP',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress'
  ],
  pppUsername: [
    'VirtualParameters.pppoeUsername',
    'VirtualParameters.pppUsername',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'
  ],
  uptime: [
    'VirtualParameters.getdeviceuptime',
    'InternetGatewayDevice.DeviceInfo.UpTime'
  ],
  userConnected: [
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations'
  ]
};
function getParameterWithPaths(device, paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let value = device;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
        if (value && value._value !== undefined) value = value._value;
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return 'N/A';
}

// Helper: Ambil info perangkat dan user terhubung dari GenieACS
async function getCustomerDeviceData(phone) {
  // Cari device berdasarkan nomor telepon (tag)
  let device = await findDeviceByTag(phone);
  
  // Jika tidak ditemukan, coba cari berdasarkan PPPoE username dari billing
  if (!device) {
    try {
      const customer = await billingManager.getCustomerByPhone(phone);
      if (customer && customer.pppoe_username) {
        const { findDeviceByPPPoE } = require('../config/genieacs');
        device = await findDeviceByPPPoE(customer.pppoe_username);
      }
    } catch (error) {
      console.error('Error finding device by PPPoE username:', error);
    }
  }
  
  if (!device) return null;
  // Ambil SSID
  const ssid = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.SSID?._value || '-';
  // Status online/offline
  const lastInform =
    device?._lastInform
      ? new Date(device._lastInform).toLocaleString('id-ID')
      : device?.Events?.Inform
        ? new Date(device.Events.Inform).toLocaleString('id-ID')
        : device?.InternetGatewayDevice?.DeviceInfo?.['1']?.LastInform?._value
          ? new Date(device.InternetGatewayDevice.DeviceInfo['1'].LastInform._value).toLocaleString('id-ID')
          : '-';
  const status = lastInform !== '-' ? 'Online' : 'Unknown';
  // User terhubung (WiFi)
  let connectedUsers = [];
  try {
    const hosts = device?.InternetGatewayDevice?.LANDevice?.['1']?.Hosts?.Host;
    if (hosts && typeof hosts === 'object') {
      for (const key in hosts) {
        if (!isNaN(key)) {
          const entry = hosts[key];
          connectedUsers.push({
            hostname: typeof entry?.HostName === 'object' ? entry?.HostName?._value || '-' : entry?.HostName || '-',
            ip: typeof entry?.IPAddress === 'object' ? entry?.IPAddress?._value || '-' : entry?.IPAddress || '-',
            mac: typeof entry?.MACAddress === 'object' ? entry?.MACAddress?._value || '-' : entry?.MACAddress || '-',
            iface: typeof entry?.InterfaceType === 'object' ? entry?.InterfaceType?._value || '-' : entry?.InterfaceType || entry?.Interface || '-',
            waktu: entry?.Active?._value === 'true' ? 'Aktif' : 'Tidak Aktif'
          });
        }
      }
    }
  } catch (e) {}
  // Ambil data dengan helper agar sama dengan WhatsApp
  const rxPower = getParameterWithPaths(device, parameterPaths.rxPower);
  const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP);
  const pppoeUsername = getParameterWithPaths(device, parameterPaths.pppUsername);
  const serialNumber =
    device?.DeviceID?.SerialNumber ||
    device?.InternetGatewayDevice?.DeviceInfo?.SerialNumber?._value ||
    device?.InternetGatewayDevice?.DeviceInfo?.['1']?.SerialNumber?._value ||
    device?.SerialNumber ||
    '-';
  const productClass =
    device?.DeviceID?.ProductClass ||
    device?.InternetGatewayDevice?.DeviceInfo?.ProductClass?._value ||
    device?.InternetGatewayDevice?.DeviceInfo?.['1']?.ProductClass?._value ||
    device?.ProductClass ||
    '-';
  let lokasi = device?.Tags || '-';
  if (Array.isArray(lokasi)) lokasi = lokasi.join(', ');
  const softwareVersion = device?.InternetGatewayDevice?.DeviceInfo?.SoftwareVersion?._value || '-';
  const model =
    device?.InternetGatewayDevice?.DeviceInfo?.ModelName?._value ||
    device?.InternetGatewayDevice?.DeviceInfo?.['1']?.ModelName?._value ||
    device?.ModelName ||
    '-';
  const uptime = getParameterWithPaths(device, parameterPaths.uptime);
  const totalAssociations = getParameterWithPaths(device, parameterPaths.userConnected);
  
  // Ambil data billing customer berdasarkan nomor telepon
  let billingData = null;
  try {
    const customer = await billingManager.getCustomerByPhone(phone);
    if (customer) {
      const invoices = await billingManager.getInvoicesByCustomer(customer.id);
      billingData = {
        customer: customer,
        invoices: invoices || [],
        payment_status: customer.payment_status
      };
    }
  } catch (error) {
    console.error('Error getting billing data:', error);
    // Tetap lanjutkan meskipun ada error billing
    // Data GenieACS tetap bisa diakses
  }
  
  return {
    phone,
    ssid,
    status,
    lastInform,
    connectedUsers,
    rxPower,
    pppoeIP,
    pppoeUsername,
    serialNumber,
    productClass,
    lokasi,
    softwareVersion,
    model,
    uptime,
    totalAssociations,
    billingData
  };
}

// Helper: Update SSID (real ke GenieACS) - Legacy
async function updateSSID(phone, newSSID) {
  try {
    // Cari device berdasarkan nomor telepon (tag)
    let device = await findDeviceByTag(phone);
    
    // Jika tidak ditemukan, coba cari berdasarkan PPPoE username dari billing
    if (!device) {
      try {
        const customer = await billingManager.getCustomerByPhone(phone);
        if (customer && customer.pppoe_username) {
          const { findDeviceByPPPoE } = require('../config/genieacs');
          device = await findDeviceByPPPoE(customer.pppoe_username);
        }
      } catch (error) {
        console.error('Error finding device by PPPoE username:', error);
      }
    }
    
    if (!device) return false;
    const deviceId = device._id;
    const encodedDeviceId = encodeURIComponent(deviceId);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const username = settings.genieacs_username || '';
    const password = settings.genieacs_password || '';
    // Update SSID 2.4GHz
    await axios.post(
      `${genieacsUrl}/devices/${encodedDeviceId}/tasks?connection_request`,
      {
        name: "setParameterValues",
        parameterValues: [
          ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", newSSID, "xsd:string"]
        ]
      },
      { auth: { username, password } }
    );
    // Update SSID 5GHz (index 5-8, ambil yang berhasil saja)
    const newSSID5G = `${newSSID}-5G`;
    const ssid5gIndexes = [5, 6, 7, 8];
    for (const idx of ssid5gIndexes) {
      try {
        await axios.post(
          `${genieacsUrl}/devices/${encodedDeviceId}/tasks?connection_request`,
          {
            name: "setParameterValues",
            parameterValues: [
              [`InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.SSID`, newSSID5G, "xsd:string"]
            ]
          },
          { auth: { username, password } }
        );
        break;
      } catch (e) {}
    }
    // Hanya refresh, tidak perlu reboot
    await axios.post(
      `${genieacsUrl}/devices/${encodedDeviceId}/tasks?connection_request`,
      { name: "refreshObject", objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration" },
      { auth: { username, password } }
    );
    return true;
  } catch (e) {
    return false;
  }
}

// Helper: Update SSID Optimized (seperti WhatsApp command) - Fast Response
async function updateSSIDOptimized(phone, newSSID) {
  try {
    console.log(`🔄 Optimized SSID update for phone: ${phone} to: ${newSSID}`);
    
    // Cari device berdasarkan nomor pelanggan
    let device = await findDeviceByTag(phone);
    if (!device) {
      try {
        const customer = await billingManager.getCustomerByPhone(phone);
        if (customer && customer.pppoe_username) {
          const { findDeviceByPPPoE } = require('../config/genieacs');
          device = await findDeviceByPPPoE(customer.pppoe_username);
        }
      } catch (error) {
        console.error('Error finding device by PPPoE username:', error);
      }
    }
    
    if (!device) {
      return { success: false, message: 'Device tidak ditemukan' };
    }
    
    const deviceId = device._id;
    const encodedDeviceId = encodeURIComponent(deviceId);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const username = settings.genieacs_username || '';
    const password = settings.genieacs_password || '';
    
    // Buat nama SSID 5G berdasarkan SSID 2.4G (seperti di WhatsApp)
    const newSSID5G = `${newSSID}-5G`;
    
    // Concurrent API calls untuk speed up
    const axiosConfig = {
      auth: { username, password },
      timeout: 10000 // 10 second timeout
    };
    
    // Update SSID 2.4GHz dan 5GHz secara concurrent
    const tasks = [];
    
    // Task 1: Update SSID 2.4GHz
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "setParameterValues",
          parameterValues: [
            ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID", newSSID, "xsd:string"]
          ]
        },
        axiosConfig
      )
    );
    
    // Task 2: Update SSID 5GHz (coba index 5 dulu, yang paling umum)
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "setParameterValues",
          parameterValues: [
            ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID", newSSID5G, "xsd:string"]
          ]
        },
        axiosConfig
      ).catch(() => null) // Ignore error jika index 5 tidak ada
    );
    
    // Task 3: Refresh object
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "refreshObject",
          objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration"
        },
        axiosConfig
      ).catch(() => null) // Ignore error jika refresh gagal
    );
    
    // Jalankan semua tasks secara concurrent
    const results = await Promise.allSettled(tasks);
    
    // Check results
    const mainTaskSuccess = results[0].status === 'fulfilled';
    const wifi5GFound = results[1].status === 'fulfilled';
    
    if (mainTaskSuccess) {
      console.log(`✅ SSID update completed for ${phone}: ${newSSID}`);
      return { success: true, wifi5GFound };
    } else {
      console.error(`❌ SSID update failed for ${phone}: ${results[0].reason?.message || 'Unknown error'}`);
      return { success: false, message: 'Gagal update SSID' };
    }
    
  } catch (error) {
    console.error('Error in updateSSIDOptimized:', error);
    return { success: false, message: error.message };
  }
}
// Helper: Add admin number and company info to customer data
function addAdminNumber(customerData) {
  const adminNumber = getSetting('admins.0', '6281947215703');
  const companyHeader = getSetting('company_header', 'ALIJAYA DIGITAL NETWORK');
  
  // Convert to display format (remove country code if present)
  const displayNumber = adminNumber.startsWith('62') ? '0' + adminNumber.slice(2) : adminNumber;
  
  if (customerData && typeof customerData === 'object') {
    customerData.adminNumber = displayNumber;
    customerData.adminNumberWA = adminNumber;
    customerData.companyHeader = companyHeader;
  }
  return customerData;
}

// Helper: Update Password (real ke GenieACS) - Legacy
async function updatePassword(phone, newPassword) {
  try {
    if (newPassword.length < 8) return false;
    
    // Cari device berdasarkan nomor telepon (tag)
    let device = await findDeviceByTag(phone);
    
    // Jika tidak ditemukan, coba cari berdasarkan PPPoE username dari billing
    if (!device) {
      try {
        const customer = await billingManager.getCustomerByPhone(phone);
        if (customer && customer.pppoe_username) {
          const { findDeviceByPPPoE } = require('../config/genieacs');
          device = await findDeviceByPPPoE(customer.pppoe_username);
        }
      } catch (error) {
        console.error('Error finding device by PPPoE username:', error);
      }
    }
    
    if (!device) return false;
    const deviceId = device._id;
    const encodedDeviceId = encodeURIComponent(deviceId);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const username = settings.genieacs_username || '';
    const password = settings.genieacs_password || '';
    const tasksUrl = `${genieacsUrl}/devices/${encodedDeviceId}/tasks`;
    // Update password 2.4GHz
    await axios.post(`${tasksUrl}?connection_request`, {
      name: "setParameterValues",
      parameterValues: [
        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", newPassword, "xsd:string"],
        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase", newPassword, "xsd:string"]
      ]
    }, { auth: { username, password } });
    // Update password 5GHz
    await axios.post(`${tasksUrl}?connection_request`, {
      name: "setParameterValues",
      parameterValues: [
        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", newPassword, "xsd:string"],
        ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.KeyPassphrase", newPassword, "xsd:string"]
      ]
    }, { auth: { username, password } });
    // Refresh
    await axios.post(`${tasksUrl}?connection_request`, {
      name: "refreshObject",
      objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration"
    }, { auth: { username, password } });
    return true;
  } catch (e) {
    return false;
  }
}

// Helper: Update Password Optimized (seperti WhatsApp command) - Fast Response
async function updatePasswordOptimized(phone, newPassword) {
  try {
    console.log(`🔄 Optimized password update for phone: ${phone}`);
    
    // Cari device berdasarkan nomor pelanggan
    let device = await findDeviceByTag(phone);
    if (!device) {
      try {
        const customer = await billingManager.getCustomerByPhone(phone);
        if (customer && customer.pppoe_username) {
          const { findDeviceByPPPoE } = require('../config/genieacs');
          device = await findDeviceByPPPoE(customer.pppoe_username);
        }
      } catch (error) {
        console.error('Error finding device by PPPoE username:', error);
      }
    }
    
    if (!device) {
      return { success: false, message: 'Device tidak ditemukan' };
    }
    
    const deviceId = device._id;
    const encodedDeviceId = encodeURIComponent(deviceId);
    const settings = getSettingsWithCache();
    const genieacsUrl = settings.genieacs_url || 'http://localhost:7557';
    const username = settings.genieacs_username || '';
    const password = settings.genieacs_password || '';
    
    // Concurrent API calls untuk speed up
    const axiosConfig = {
      auth: { username, password },
      timeout: 10000 // 10 second timeout
    };
    
    // Update password 2.4GHz dan 5GHz secara concurrent
    const tasks = [];
    
    // Task 1: Update password 2.4GHz
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "setParameterValues",
          parameterValues: [
            ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase", newPassword, "xsd:string"]
          ]
        },
        axiosConfig
      )
    );
    
    // Task 2: Update password 5GHz (coba index 5 dulu)
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "setParameterValues",
          parameterValues: [
            ["InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase", newPassword, "xsd:string"]
          ]
        },
        axiosConfig
      ).catch(() => null) // Ignore error jika index 5 tidak ada
    );
    
    // Task 3: Refresh object
    tasks.push(
      axios.post(
        `${genieacsUrl}/devices/${encodedDeviceId}/tasks`,
        {
          name: "refreshObject",
          objectName: "InternetGatewayDevice.LANDevice.1.WLANConfiguration"
        },
        axiosConfig
      ).catch(() => null) // Ignore error jika refresh gagal
    );
    
    // Jalankan semua tasks secara concurrent
    const results = await Promise.allSettled(tasks);
    
    // Check results
    const mainTaskSuccess = results[0].status === 'fulfilled';
    
    if (mainTaskSuccess) {
      console.log(`✅ Password update completed for ${phone}`);
      return { success: true };
    } else {
      console.error(`❌ Password update failed for ${phone}: ${results[0].reason?.message || 'Unknown error'}`);
      return { success: false, message: 'Gagal update password' };
    }
    
  } catch (error) {
    console.error('Error in updatePasswordOptimized:', error);
    return { success: false, message: error.message };
  }
}

// GET: Login page
router.get('/login', (req, res) => {
  const settings = getSettingsWithCache();
  res.render('login', { settings, error: null });
});

// POST: Proses login - Optimized dengan AJAX support
router.post('/login', async (req, res) => {
  try {
    const { phone } = req.body;
    const settings = getSettingsWithCache();
    
    // Fast validation
    if (!phone || !phone.match(/^08[0-9]{8,13}$/)) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(400).json({ success: false, message: 'Nomor HP harus valid (08xxxxxxxxxx)' });
      } else {
        return res.render('login', { settings, error: 'Nomor HP tidak valid.' });
      }
    }
    
    // Check customer validity
    if (!await isValidCustomer(phone)) {
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(401).json({ success: false, message: 'Nomor HP tidak terdaftar.' });
      } else {
        return res.render('login', { settings, error: 'Nomor HP tidak valid atau belum terdaftar.' });
      }
    }
    
    if (settings.customerPortalOtp === 'true') {
      // Generate OTP sesuai jumlah digit di settings
      const otpLength = settings.otp_length || 6;
      const min = Math.pow(10, otpLength - 1);
      const max = Math.pow(10, otpLength) - 1;
      const otp = Math.floor(min + Math.random() * (max - min)).toString();
      otpStore[phone] = { otp, expires: Date.now() + 5 * 60 * 1000 };
      
      // Kirim OTP ke WhatsApp pelanggan
      try {
        const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
        const msg = `🔐 *KODE OTP PORTAL PELANGGAN*\n\n` +
          `Kode OTP Anda adalah: *${otp}*\n\n` +
          `⏰ Kode ini berlaku selama 5 menit\n` +
          `🔒 Jangan bagikan kode ini kepada siapapun`;
        
        await sendMessage(waJid, msg);
        console.log(`OTP berhasil dikirim ke ${phone}: ${otp}`);
      } catch (error) {
        console.error(`Gagal mengirim OTP ke ${phone}:`, error);
      }
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({ success: true, message: 'OTP berhasil dikirim', redirect: '/customer/otp' });
      } else {
        return res.render('otp', { phone, error: null, otp_length: otpLength, settings });
      }
    } else {
      req.session.phone = phone;
      
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.json({ success: true, message: 'Login berhasil', redirect: '/customer/dashboard' });
      } else {
        return res.redirect('/customer/dashboard');
      }
    }
  } catch (error) {
    console.error('Login error:', error);
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat login' });
    } else {
      return res.render('login', { settings: getSettingsWithCache(), error: 'Terjadi kesalahan saat login.' });
    }
  }
});

// GET: Halaman OTP
router.get('/otp', (req, res) => {
  const { phone } = req.query;
  const settings = getSettingsWithCache();
  res.render('otp', { phone, error: null, otp_length: settings.otp_length || 6, settings });
});

// POST: Verifikasi OTP
router.post('/otp', (req, res) => {
  const { phone, otp } = req.body;
  const data = otpStore[phone];
  const settings = getSettingsWithCache();
  if (!data || data.otp !== otp || Date.now() > data.expires) {
    return res.render('otp', { phone, error: 'OTP salah atau sudah kadaluarsa.', otp_length: settings.otp_length || 6, settings });
  }
  // Sukses login
  delete otpStore[phone];
  req.session = req.session || {};
  req.session.phone = phone;
  return res.redirect('/customer/dashboard');
});

// GET: Dashboard pelanggan
router.get('/dashboard', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const settings = getSettingsWithCache();
  
  try {
    const data = await getCustomerDeviceData(phone);
    if (!data) {
      const fallbackCustomer = addAdminNumber({ phone, ssid: '-', status: 'Tidak ditemukan', lastChange: '-' });
      return res.render('dashboard', { 
        customer: fallbackCustomer, 
        connectedUsers: [], 
        notif: 'Data perangkat tidak ditemukan.',
        settings,
        billingData: null
      });
    }
    
    const customerWithAdmin = addAdminNumber(data);
    res.render('dashboard', { 
      customer: customerWithAdmin, 
      connectedUsers: data.connectedUsers,
      settings,
      billingData: data.billingData || null
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    // Fallback jika ada error, tetap tampilkan data GenieACS
    const fallbackCustomer = addAdminNumber({ phone, ssid: '-', status: 'Error', lastChange: '-' });
    res.render('dashboard', { 
      customer: fallbackCustomer, 
      connectedUsers: [], 
      notif: 'Terjadi kesalahan saat memuat data.',
      settings,
      billingData: null
    });
  }
});

// POST: Ganti SSID (Legacy - redirect to homepage with notification)
router.post('/change-ssid', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const { ssid } = req.body;
  const ok = await updateSSIDOptimized(phone, ssid);
  if (ok) {
    // Kirim notifikasi WhatsApp ke pelanggan
    const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
    const msg = `✅ *PERUBAHAN NAMA WIFI*\n\nNama WiFi Anda telah diubah menjadi:\n• WiFi 2.4GHz: ${ssid}\n• WiFi 5GHz: ${ssid}-5G\n\nSilakan hubungkan ulang perangkat Anda ke WiFi baru.`;
    try { await sendMessage(waJid, msg); } catch (e) {}
  }
  const data = await getCustomerDeviceData(phone);
  const customerWithAdmin = addAdminNumber(data || { phone, ssid: '-', status: '-', lastChange: '-' });
  res.render('dashboard', { 
    customer: customerWithAdmin, 
    connectedUsers: data ? data.connectedUsers : [], 
    notif: ok ? 'Nama WiFi (SSID) berhasil diubah.' : 'Gagal mengubah SSID.',
    settings: getSettingsWithCache()
  });
});

// API: Ganti SSID (Ajax endpoint - optimized like WhatsApp)
router.post('/api/change-ssid', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.status(401).json({ success: false, message: 'Session tidak valid' });
  
  const { ssid } = req.body;
  
  if (!ssid || ssid.length < 3 || ssid.length > 32) {
    return res.status(400).json({ success: false, message: 'SSID harus berisi 3-32 karakter!' });
  }
  
  try {
    // Kirim response cepat ke frontend
    res.json({ 
      success: true, 
      message: 'SSID sedang diproses...',
      newSSID: ssid,
      processing: true
    });
    
    // Proses update di background (non-blocking)
    updateSSIDOptimized(phone, ssid).then(result => {
      if (result.success) {
        // Kirim notifikasi WhatsApp ke pelanggan (non-blocking)
        const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
        const msg = `✅ *PERUBAHAN NAMA WIFI*\n\nNama WiFi Anda telah diubah menjadi:\n• WiFi 2.4GHz: ${ssid}\n• WiFi 5GHz: ${ssid}-5G\n\nSilakan hubungkan ulang perangkat Anda ke WiFi baru.`;
        sendMessage(waJid, msg).catch(e => {
          console.error('Error sending WhatsApp notification:', e);
        });
        
        console.log(`✅ SSID update completed for ${phone}: ${ssid}`);
      } else {
        console.error(`❌ SSID update failed for ${phone}: ${result.message}`);
      }
    }).catch(error => {
      console.error('Error in background SSID update:', error);
    });
    
  } catch (error) {
    console.error('Error in change SSID API:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// POST: Ganti Password (Legacy - untuk backward compatibility)
router.post('/change-password', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  const { password } = req.body;
  const ok = await updatePassword(phone, password);
  if (ok) {
    // Kirim notifikasi WhatsApp ke pelanggan
    const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
    const msg = `✅ *PERUBAHAN PASSWORD WIFI*\n\nPassword WiFi Anda telah diubah menjadi:\n• Password Baru: ${password}\n\nSilakan hubungkan ulang perangkat Anda dengan password baru.`;
    try { await sendMessage(waJid, msg); } catch (e) {}
  }
  const data = await getCustomerDeviceData(phone);
  const customerWithAdmin = addAdminNumber(data || { phone, ssid: '-', status: '-', lastChange: '-' });
  res.render('dashboard', { 
    customer: customerWithAdmin, 
    connectedUsers: data ? data.connectedUsers : [], 
    notif: ok ? 'Password WiFi berhasil diubah.' : 'Gagal mengubah password.',
    settings: getSettingsWithCache()
  });
});

// API: Ganti Password (Ajax endpoint - optimized like WhatsApp)
router.post('/api/change-password', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.status(401).json({ success: false, message: 'Session tidak valid' });
  
  const { password } = req.body;
  
  if (!password || password.length < 8 || password.length > 63) {
    return res.status(400).json({ success: false, message: 'Password harus berisi 8-63 karakter!' });
  }
  
  try {
    // Kirim response cepat ke frontend
    res.json({ 
      success: true, 
      message: 'Password sedang diproses...',
      processing: true
    });
    
    // Proses update di background (non-blocking)
    updatePasswordOptimized(phone, password).then(result => {
      if (result.success) {
        // Kirim notifikasi WhatsApp ke pelanggan (non-blocking)
        const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
        const msg = `✅ *PERUBAHAN PASSWORD WIFI*\n\nPassword WiFi Anda telah diubah menjadi:\n• Password Baru: ${password}\n\nSilakan hubungkan ulang perangkat Anda dengan password baru.`;
        sendMessage(waJid, msg).catch(e => {
          console.error('Error sending WhatsApp notification:', e);
        });
        
        console.log(`✅ Password update completed for ${phone}`);
      } else {
        console.error(`❌ Password update failed for ${phone}: ${result.message}`);
      }
    }).catch(error => {
      console.error('Error in background password update:', error);
    });
    
  } catch (error) {
    console.error('Error in change password API:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// POST: Restart Device
router.post('/restart-device', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.status(401).json({ success: false, message: 'Session tidak valid' });
  
  try {
    console.log(`🔄 Restart device request from phone: ${phone}`);
    
    // Cari device berdasarkan nomor pelanggan
    const device = await findDeviceByTag(phone);
    if (!device) {
      console.log(`❌ Device not found for phone: ${phone}`);
      return res.status(404).json({ success: false, message: 'Device tidak ditemukan' });
    }

    console.log(`✅ Device found: ${device._id}`);

    // Cek status device (online/offline) - gunakan threshold yang lebih longgar
    const lastInform = device._lastInform ? new Date(device._lastInform) : null;
    const now = Date.now();
    const thirtyMinutes = 30 * 60 * 1000; // 30 menit
    
    const isOnline = lastInform && (now - lastInform.getTime()) < thirtyMinutes;
    
    if (!isOnline) {
      const minutesAgo = lastInform ? Math.round((now - lastInform.getTime()) / 60000) : 'Unknown';
      console.log(`⚠️ Device is offline. Last inform: ${lastInform ? lastInform.toLocaleString() : 'Never'}`);
      console.log(`⏰ Time since last inform: ${minutesAgo} minutes`);
      
      let offlineMessage = 'Device sedang offline.';
      if (minutesAgo !== 'Unknown' && minutesAgo > 60) {
        offlineMessage = `Device offline sejak ${Math.floor(minutesAgo / 60)} jam ${minutesAgo % 60} menit yang lalu.`;
      } else if (minutesAgo !== 'Unknown') {
        offlineMessage = `Device offline sejak ${minutesAgo} menit yang lalu.`;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: offlineMessage + ' Silakan coba lagi dalam beberapa menit setelah device online kembali.' 
      });
    }
    
    console.log(`✅ Device is online. Last inform: ${lastInform.toLocaleString()}`);

    const genieacsUrl = getSetting('genieacs_url', 'http://localhost:7557');
    const genieacsUsername = getSetting('genieacs_username', 'admin');
    const genieacsPassword = getSetting('genieacs_password', 'password');

    console.log(`🔗 GenieACS URL: ${genieacsUrl}`);

    // Gunakan device ID asli (tidak di-decode) karena GenieACS memerlukan format yang di-encode
    const deviceId = device._id;
    console.log(`🔧 Using original device ID: ${deviceId}`);

    // Kirim perintah restart ke GenieACS menggunakan endpoint yang benar
    const taskData = {
      name: 'reboot'
    };

    console.log(`📤 Sending restart task to GenieACS for device: ${deviceId}`);

    // Gunakan endpoint yang benar sesuai dokumentasi GenieACS
    // Pastikan device ID di-encode dengan benar untuk menghindari masalah karakter khusus
    const encodedDeviceId = encodeURIComponent(deviceId);
    console.log(`🔧 Using encoded device ID: ${encodedDeviceId}`);

    try {
      const response = await axios.post(`${genieacsUrl}/devices/${encodedDeviceId}/tasks?connection_request`, taskData, {
        auth: { username: genieacsUsername, password: genieacsPassword },
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`✅ GenieACS response:`, response.data);

      // Jika task berhasil dibuat, berarti restart command berhasil dikirim
      // Device akan offline selama proses restart (1-2 menit)
      console.log(`🔄 Restart command sent successfully. Device will be offline during restart process.`);
      
    } catch (taskError) {
      console.error(`❌ Error sending restart task:`, taskError.response?.data || taskError.message);
      
      // Jika device tidak ditemukan saat mengirim task, berarti device baru saja offline
      if (taskError.response?.status === 404) {
        throw new Error('Device tidak dapat menerima perintah restart. Device mungkin baru saja offline atau sedang dalam proses restart.');
      }
      
      throw taskError;
    }

    // Kirim notifikasi WhatsApp ke pelanggan
    try {
      const waJid = phone.replace(/^0/, '62') + '@s.whatsapp.net';
      const msg = `🔄 *RESTART PERANGKAT*\n\n` +
        `Perintah restart berhasil dikirim ke perangkat Anda.\n\n` +
        `⏰ Proses restart memakan waktu 1-2 menit\n` +
        `📶 Koneksi internet akan terputus sementara\n` +
        `✅ Internet akan kembali normal setelah restart selesai\n\n` +
        `Terima kasih atas kesabaran Anda.`;
      await sendMessage(waJid, msg);
      console.log(`✅ WhatsApp notification sent to ${phone}`);
    } catch (e) {
      console.error('❌ Gagal mengirim notifikasi restart:', e);
    }

    res.json({ success: true, message: 'Perintah restart berhasil dikirim' });
  } catch (err) {
    console.error('❌ Error restart device:', err.message);
    console.error('❌ Error details:', err.response?.data || err);
    
    let errorMessage = 'Gagal mengirim perintah restart';
    
    // Berikan pesan yang lebih informatif berdasarkan error
    if (err.response?.status === 404) {
      errorMessage = 'Device tidak ditemukan atau sedang offline. Silakan coba lagi dalam beberapa menit.';
    } else if (err.response?.data?.message) {
      errorMessage = err.response.data.message;
    } else if (err.message) {
      errorMessage = err.message;
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage
    });
  }
});

// POST: Logout pelanggan
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/customer/login');
  });
});

// GET: Halaman billing customer
router.get('/billing', async (req, res) => {
  const phone = req.session && req.session.phone;
  if (!phone) return res.redirect('/customer/login');
  
  try {
    const customer = await billingManager.getCustomerByPhone(phone);
    const settings = getSettingsWithCache();
    
    if (!customer) {
      return res.render('customer/billing/dashboard', { 
        customer: null, 
        invoices: [], 
        settings,
        error: 'Data pelanggan tidak ditemukan dalam sistem billing.'
      });
    }
    
    const invoices = await billingManager.getInvoicesByCustomer(customer.id);
    
    res.render('customer/billing/dashboard', { 
      customer, 
      invoices: invoices || [], 
      settings 
    });
  } catch (error) {
    console.error('Error loading billing page:', error);
    const settings = getSettingsWithCache();
    res.render('customer/billing/dashboard', { 
      customer: null, 
      invoices: [], 
      settings,
      error: 'Terjadi kesalahan saat memuat data billing.'
    });
  }
});

// Import dan gunakan route laporan gangguan
const troubleReportRouter = require('./troubleReport');
router.use('/trouble', troubleReportRouter);

module.exports = router; 