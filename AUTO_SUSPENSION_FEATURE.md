# Auto Suspension Feature - Pilihan Isolir Otomatis

## Problem Description
Saat ini semua pelanggan akan diisolir otomatis saat telat bayar, padahal ada pelanggan yang tidak ingin diisolir otomatis atau memiliki perjanjian khusus.

## Solution
Menambahkan field `auto_suspension` untuk memberikan pilihan kepada admin apakah pelanggan akan diisolir otomatis saat telat bayar atau tidak.

## Features Added

### 1. Database Schema Update
- **Kolom baru**: `auto_suspension BOOLEAN DEFAULT 1`
- **Lokasi**: Tabel `customers`
- **Default value**: `1` (Ya - diisolir otomatis)
- **Migration**: Otomatis ditambahkan saat aplikasi start

### 2. UI Components

#### A. Add Customer Modal
```html
<div class="mb-3">
    <label for="auto_suspension" class="form-label">Auto Suspension</label>
    <select class="form-control" id="auto_suspension" name="auto_suspension">
        <option value="1">Ya - Isolir otomatis saat telat bayar</option>
        <option value="0">Tidak - Tidak diisolir otomatis</option>
    </select>
    <small class="form-text text-muted">Pilih apakah pelanggan akan diisolir otomatis saat telat bayar</small>
</div>
```

#### B. Edit Customer Modal
```html
<div class="mb-3">
    <label for="edit_auto_suspension" class="form-label">Auto Suspension</label>
    <select class="form-control" id="edit_auto_suspension" name="auto_suspension">
        <option value="1">Ya - Isolir otomatis saat telat bayar</option>
        <option value="0">Tidak - Tidak diisolir otomatis</option>
    </select>
    <small class="form-text text-muted">Pilih apakah pelanggan akan diisolir otomatis saat telat bayar</small>
</div>
```

#### C. Customer Table
```html
<th>Auto Suspension</th>
<!-- In table body -->
<td>
    <% if (customer.auto_suspension === 1) { %>
        <span class="badge bg-success">Ya</span>
    <% } else { %>
        <span class="badge bg-secondary">Tidak</span>
    <% } %>
</td>
```

### 3. Backend Updates

#### A. Database Functions
**File**: `config/billing.js`

```javascript
// createCustomer function
const { name, phone, pppoe_username, email, address, package_id, pppoe_profile, status, auto_suspension } = customerData;
const sql = `INSERT INTO customers (username, name, phone, pppoe_username, email, address, package_id, pppoe_profile, status, auto_suspension) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
this.db.run(sql, [username, name, phone, autoPPPoEUsername, email, address, package_id, pppoe_profile, status || 'active', auto_suspension !== undefined ? auto_suspension : 1], ...);

// updateCustomer function
const { name, pppoe_username, email, address, package_id, pppoe_profile, status, auto_suspension } = customerData;
const sql = `UPDATE customers SET name = ?, pppoe_username = ?, email = ?, address = ?, package_id = ?, pppoe_profile = ?, status = ?, auto_suspension = ? WHERE phone = ?`;
this.db.run(sql, [name, pppoe_username, email, address, package_id, pppoe_profile, status, auto_suspension !== undefined ? auto_suspension : oldCustomer.auto_suspension, phone], ...);
```

#### B. API Routes
**File**: `routes/adminBilling.js`

```javascript
// POST /customers
const { name, phone, pppoe_username, email, address, package_id, pppoe_profile, auto_suspension } = req.body;
const customerData = {
    name,
    phone,
    pppoe_username,
    email,
    address,
    package_id,
    pppoe_profile: profileToUse,
    status: 'active',
    auto_suspension: auto_suspension !== undefined ? parseInt(auto_suspension) : 1
};

// PUT /customers/:phone
const { name, pppoe_username, email, address, package_id, pppoe_profile, status, auto_suspension } = req.body;
const customerData = {
    name: name,
    phone: phone,
    pppoe_username: pppoe_username || currentCustomer.pppoe_username,
    email: email || currentCustomer.email,
    address: address || currentCustomer.address,
    package_id: package_id,
    pppoe_profile: profileToUse,
    status: status || currentCustomer.status,
    auto_suspension: auto_suspension !== undefined ? parseInt(auto_suspension) : currentCustomer.auto_suspension
};
```

#### C. Service Suspension Logic
**File**: `config/serviceSuspension.js`

```javascript
// checkAndSuspendOverdueCustomers function
// Skip jika auto_suspension = 0 (tidak diisolir otomatis)
if (customer.auto_suspension === 0) {
    logger.info(`Customer ${customer.username} has auto_suspension disabled - skipping`);
    continue;
}
```

### 4. Frontend JavaScript

#### A. Add Customer Form
```javascript
const formData = {
    name: name,
    phone: phone,
    pppoe_username: $('#pppoe_username').val().trim(),
    address: $('#address').val().trim(),
    package_id: package_id,
    pppoe_profile: $('#pppoe_profile').val().trim() || 'default',
    auto_suspension: $('#auto_suspension').val()
};
```

#### B. Edit Customer Form
```javascript
// Load customer data
$('#edit_auto_suspension').val(customer.auto_suspension !== undefined ? customer.auto_suspension : 1);

// Submit form data
const formData = {
    name: name,
    pppoe_username: $('#edit_pppoe_username').val().trim(),
    address: $('#edit_address').val().trim(),
    package_id: package_id,
    pppoe_profile: $('#edit_pppoe_profile').val().trim() || 'default',
    auto_suspension: $('#edit_auto_suspension').val(),
    status: $('#edit_status').val()
};
```

## Business Logic

### 1. Default Behavior
- **Default value**: `1` (Ya - diisolir otomatis)
- **Existing customers**: Otomatis mendapat nilai `1` saat migration

### 2. Auto Suspension Rules
- **auto_suspension = 1**: Pelanggan akan diisolir otomatis saat telat bayar
- **auto_suspension = 0**: Pelanggan TIDAK akan diisolir otomatis saat telat bayar

### 3. Service Suspension Check
```javascript
// Logika di checkAndSuspendOverdueCustomers()
if (customer.auto_suspension === 0) {
    logger.info(`Customer ${customer.username} has auto_suspension disabled - skipping`);
    continue; // Skip suspension untuk pelanggan ini
}
```

## User Experience

### 1. Add Customer
- Admin dapat memilih "Ya" atau "Tidak" untuk auto suspension
- Default: "Ya" (diisolir otomatis)
- Pilihan jelas dengan deskripsi yang informatif

### 2. Edit Customer
- Admin dapat mengubah setting auto suspension
- Nilai saat ini ditampilkan di dropdown
- Perubahan langsung tersimpan

### 3. Customer List
- Kolom "Auto Suspension" menampilkan status dengan badge
- **Hijau**: "Ya" (diisolir otomatis)
- **Abu-abu**: "Tidak" (tidak diisolir otomatis)

## Benefits

### 1. Flexibility
- Admin dapat mengatur per pelanggan
- Mendukung perjanjian khusus dengan pelanggan
- Tidak semua pelanggan harus diisolir otomatis

### 2. Customer Service
- Pelanggan VIP tidak akan diisolir otomatis
- Pelanggan dengan perjanjian khusus dapat diatur
- Mengurangi komplain karena isolir otomatis

### 3. Business Control
- Admin memiliki kontrol penuh
- Logging yang jelas untuk audit
- Transparansi dalam pengaturan

## Testing Scenarios

### 1. Add Customer with Auto Suspension = Yes
- **Expected**: Customer dibuat dengan auto_suspension = 1
- **Result**: ✅ Works correctly

### 2. Add Customer with Auto Suspension = No
- **Expected**: Customer dibuat dengan auto_suspension = 0
- **Result**: ✅ Works correctly

### 3. Edit Customer Auto Suspension
- **Expected**: Setting auto suspension dapat diubah
- **Result**: ✅ Works correctly

### 4. Service Suspension Check
- **auto_suspension = 1**: Pelanggan diisolir saat telat bayar
- **auto_suspension = 0**: Pelanggan TIDAK diisolir saat telat bayar
- **Result**: ✅ Works correctly

## Files Modified

### 1. Database
- `config/billing.js`: Added auto_suspension column and updated functions

### 2. Backend
- `routes/adminBilling.js`: Updated API routes to handle auto_suspension
- `config/serviceSuspension.js`: Added auto_suspension check in suspension logic

### 3. Frontend
- `views/admin/billing/customers.ejs`: Added UI components and JavaScript

## Migration
- Kolom `auto_suspension` otomatis ditambahkan saat aplikasi start
- Existing customers mendapat default value `1`
- Tidak ada data loss atau downtime

## Conclusion
Fitur auto suspension telah berhasil ditambahkan dengan:
- UI yang user-friendly
- Backend logic yang robust
- Database migration yang aman
- Business logic yang fleksibel

Admin sekarang dapat mengatur per pelanggan apakah akan diisolir otomatis atau tidak, memberikan fleksibilitas dalam manajemen pelanggan.
