# WhatsApp Billing Admin

## Overview
Sistem WhatsApp admin untuk manajemen billing yang terintegrasi dengan sistem billing yang ada. Fitur ini memungkinkan admin untuk mengelola pelanggan, pembayaran, paket, dan invoice melalui WhatsApp dengan perintah yang mudah digunakan.

## Fitur Utama

### 1. Customer Management
- **Tambah Pelanggan**: `addcustomer [nama] [phone] [paket]`
- **Edit Pelanggan**: `editcustomer [phone] [field] [value]`
- **Hapus Pelanggan**: `delcustomer [phone]`
- **Daftar Pelanggan**: `listcustomers`
- **Cari Pelanggan**: `cari [nomor/nama_pelanggan]`

### 2. Payment Management
- **Bayar Tagihan**: `bayar [nomor/nama_pelanggan]`
- **Bayar Invoice**: `payinvoice [invoice_id] [amount] [method]`
- **Cek Status Pembayaran**: `tagihan [nomor/nama_pelanggan]`
- **Daftar Pelanggan Bayar**: `paidcustomers`
- **Daftar Pelanggan Terlambat**: `overduecustomers`
- **Statistik Billing**: `billingstats`

### 3. Package Management
- **Tambah Paket**: `addpackage [nama] [speed] [harga]`
- **Daftar Paket**: `listpackages`

### 4. Invoice Management
- **Buat Invoice**: `createinvoice [phone] [amount] [due_date]`
- **Daftar Invoice**: `listinvoices [phone]`

## Menu Utama

### Perintah: `billing`
Menampilkan menu utama billing dengan semua perintah yang tersedia.

### Perintah: `help billing`
Menampilkan bantuan lengkap untuk semua perintah billing.

## Contoh Penggunaan

### Menambah Pelanggan Baru
```
addcustomer "John Doe" 081234567890 "Paket Premium"
```

### Membayar Invoice
```
payinvoice 123 500000 cash
```

### Cek Status Pembayaran
```
tagihan 081234567890
tagihan Santo
tagihan "John Doe"
```

### Bayar Tagihan Pelanggan
```
bayar 081234567890
bayar Santo  
bayar "John Doe"
```

### Cari Pelanggan
```
cari 081234567890
cari Santo
cari "John Doe"
```

### Daftar Pelanggan yang Sudah Bayar
```
paidcustomers
```

### Daftar Pelanggan Terlambat
```
overduecustomers
```

### Statistik Billing
```
billingstats
```

## Keamanan

- Semua perintah billing hanya dapat diakses oleh admin
- Validasi input untuk mencegah kesalahan
- Logging untuk audit trail
- Error handling yang komprehensif

## Integrasi

### Dengan Sistem Billing
- Menggunakan `billingManager` untuk operasi database
- Terintegrasi dengan sistem pembayaran yang ada
- Mendukung semua fitur billing yang sudah ada

### Dengan WhatsApp
- Menggunakan sistem WhatsApp yang sudah ada
- Format pesan yang konsisten dengan fitur lain
- Header dan footer yang seragam

## Struktur File

### `config/billing-commands.js`
Modul utama yang menangani semua perintah billing melalui WhatsApp.

### `config/help-messages.js`
Pesan bantuan untuk menu billing.

### `config/whatsapp.js`
Integrasi perintah billing ke dalam sistem WhatsApp.

## Error Handling

### Validasi Input
- Format perintah yang benar
- Parameter yang diperlukan
- Tipe data yang sesuai

### Database Errors
- Penanganan error database
- Rollback untuk operasi yang gagal
- Logging error untuk debugging

### WhatsApp Errors
- Retry mechanism untuk pengiriman pesan
- Fallback untuk koneksi yang bermasalah
- Error message yang informatif

## Logging

Semua operasi billing melalui WhatsApp akan di-log dengan detail:
- Timestamp
- Admin yang melakukan operasi
- Perintah yang dijalankan
- Parameter yang digunakan
- Hasil operasi (success/error)

## Testing

### Manual Testing
1. Kirim perintah `billing` untuk melihat menu
2. Test setiap perintah dengan parameter yang valid
3. Test dengan parameter yang tidak valid
4. Test dengan akses non-admin

### Automated Testing
- Unit test untuk setiap fungsi
- Integration test untuk database
- WhatsApp message test

## Monitoring

### Metrics
- Jumlah perintah billing per hari
- Success rate perintah
- Response time
- Error rate

### Alerts
- Error rate yang tinggi
- Database connection issues
- WhatsApp connection problems

## Troubleshooting

### Common Issues

1. **Perintah tidak dikenali**
   - Pastikan format perintah benar
   - Cek apakah admin memiliki akses

2. **Database error**
   - Cek koneksi database
   - Validasi data input

3. **WhatsApp tidak terkirim**
   - Cek koneksi WhatsApp
   - Restart service jika diperlukan

### Debug Commands
- `billingstats` - Cek status sistem
- `help billing` - Bantuan lengkap

## Future Enhancements

### Planned Features
- Bulk operations untuk pelanggan
- Export data ke Excel
- Notifikasi otomatis untuk admin
- Dashboard analytics

### Integration Plans
- Payment gateway integration
- SMS notifications
- Email reports
- Mobile app integration

## Support

Untuk bantuan teknis atau pertanyaan tentang fitur billing WhatsApp admin, silakan hubungi tim development atau buat issue di repository.

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Author**: ALIJAYA Development Team
