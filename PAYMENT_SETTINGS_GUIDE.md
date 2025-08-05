# Panduan Pengaturan Informasi Pembayaran dan Kontak

## Cara Mengedit Informasi Pembayaran dan Kontak via Web

### 1. Akses Halaman Settings
- Login sebagai admin
- Buka menu **Setting** di sidebar
- Halaman settings akan menampilkan semua pengaturan sistem

### 2. Pengaturan Informasi Pembayaran
Berikut adalah field-field yang dapat diedit untuk informasi pembayaran:

#### Transfer Bank:
- **payment_bank_name**: Nama bank (contoh: BCA, Mandiri, BNI)
- **payment_account_number**: Nomor rekening
- **payment_account_holder**: Nama pemilik rekening

#### Pembayaran Tunai:
- **payment_cash_address**: Alamat kantor untuk pembayaran tunai
- **payment_cash_hours**: Jam operasional kantor

### 3. Pengaturan Informasi Kontak
Berikut adalah field-field yang dapat diedit untuk informasi kontak:

- **contact_phone**: Nomor telepon
- **contact_email**: Alamat email
- **contact_address**: Alamat lengkap
- **contact_whatsapp**: Nomor WhatsApp

### 4. Cara Mengedit
1. Cari field yang ingin diedit di halaman settings
2. Klik pada field tersebut
3. Edit nilai sesuai kebutuhan
4. Klik tombol **"Simpan Perubahan"**
5. Pengaturan akan langsung diterapkan

### 5. Lokasi Tampilan
Setelah diedit, informasi ini akan muncul di:
- Halaman cetak invoice admin (`/admin/billing/invoices/:id/print`)
- Halaman cetak invoice customer (`/customer/billing/invoices/:id/print`)
- Bagian "Cara Pembayaran" dan "Info Hubungi"

### 6. Contoh Pengaturan
```json
{
  "payment_bank_name": "BCA",
  "payment_account_number": "1234567890",
  "payment_account_holder": "ALIJAYA DIGITAL NETWORK",
  "payment_cash_address": "Jl. Contoh No. 123",
  "payment_cash_hours": "08:00 - 17:00",
  "contact_phone": "0812-3456-7890",
  "contact_email": "info@example.com",
  "contact_address": "Jl. Contoh No. 123, Kota",
  "contact_whatsapp": "081947215703"
}
```

### 7. Catatan Penting
- Semua pengaturan disimpan di file `settings.json`
- Perubahan akan langsung diterapkan tanpa perlu restart aplikasi
- Jika field dikosongkan, akan menggunakan nilai default
- Pastikan informasi yang dimasukkan akurat dan up-to-date 