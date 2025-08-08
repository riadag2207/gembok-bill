# Update Sistem Login Pelanggan

## Perubahan yang Dilakukan

### 1. **Database Schema**
- Field `phone` di tabel `customers` sekarang menjadi `UNIQUE NOT NULL`
- Username sekarang di-generate otomatis berdasarkan nomor telepon

### 2. **Sistem Login**
- **Sebelum**: Login menggunakan username yang diinput manual
- **Sesudah**: Login menggunakan nomor telepon (08xxxxxxxxxx)
- Dashboard pelanggan tetap menggunakan session `phone`

### 3. **Form Tambah Pelanggan**
- **Dihapus**: Field "Username" (sekarang auto-generate)
- **Tetap ada**: Field "PPPoE Username" (opsional, auto-generate jika kosong)
- **Required**: Nama, Telepon, Paket

### 4. **Form Edit Pelanggan**
- **Dihapus**: Field "Username" (tidak bisa diedit)
- **Readonly**: Field "Telepon" (tidak bisa diubah)
- **Required**: Nama, Paket

### 5. **Auto-Generate Username**
```javascript
// Format: cust_[4digit_terakhir_telepon]_[timestamp]
// Contoh: cust_3007_168885
generateUsername(phone) {
    const last4Digits = phone.slice(-4);
    const timestamp = Date.now().toString().slice(-6);
    return `cust_${last4Digits}_${timestamp}`;
}

// Format: pppoe_[4digit_terakhir_telepon]
// Contoh: pppoe_3007
generatePPPoEUsername(phone) {
    const last4Digits = phone.slice(-4);
    return `pppoe_${last4Digits}`;
}
```

### 6. **Backend Routes**
- **Customer Creation**: `POST /admin/billing/customers` (tidak perlu username)
- **Customer Update**: `PUT /admin/billing/customers/:phone` (menggunakan phone sebagai identifier)
- **Customer Delete**: `DELETE /admin/billing/customers/:phone`
- **Customer Data**: `GET /admin/billing/api/customers/:phone`

### 7. **Frontend Changes**
- Tabel customer tidak menampilkan kolom "Username"
- Form tambah customer tidak ada field username
- Form edit customer tidak bisa mengubah nomor telepon
- Tombol edit/delete menggunakan phone sebagai parameter

### 8. **Customer Portal Login**
- Login menggunakan nomor telepon (08xxxxxxxxxx)
- Validasi format nomor telepon
- OTP tetap menggunakan nomor telepon
- Session menggunakan `phone`

## Keuntungan

1. **Lebih Praktis**: Pelanggan tidak perlu mengingat username, cukup nomor telepon
2. **Otomatis**: Username dan PPPoE username di-generate otomatis
3. **Konsisten**: Semua sistem menggunakan nomor telepon sebagai identifier
4. **Mudah Dikelola**: Admin tidak perlu input username manual

## Testing

1. **Tambah Pelanggan Baru**: Pastikan username dan PPPoE username ter-generate otomatis
2. **Edit Pelanggan**: Pastikan nomor telepon tidak bisa diubah
3. **Login Pelanggan**: Pastikan bisa login dengan nomor telepon
4. **Dashboard Pelanggan**: Pastikan semua fitur berfungsi normal

## Data Existing

Semua customer existing telah diupdate dengan:
- Username auto-generate: `cust_[4digit]_[timestamp]`
- PPPoE username auto-generate: `pppoe_[4digit]` (jika sebelumnya NULL)
