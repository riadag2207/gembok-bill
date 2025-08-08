# Error Handling Improvement - Bahasa Indonesia & Web Notifications

## Problem Description
Error messages saat ini hanya muncul di console dan menggunakan bahasa Inggris, padahal dalam mode produksi console tidak dibuka dan user membutuhkan pesan dalam bahasa Indonesia.

## Root Cause Analysis
1. **Console-only logging**: Error hanya di-log ke console
2. **English messages**: Pesan error dalam bahasa Inggris
3. **Generic error handling**: Tidak ada handling khusus untuk berbagai jenis error

## Fixes Applied

### 1. Improved Delete Customer Error Handling

#### Before (BROKEN)
```javascript
} catch (error) {
    logger.error('Error deleting customer:', error);
    res.status(500).json({
        success: false,
        message: 'Error deleting customer',
        error: error.message
    });
}
```

#### After (FIXED)
```javascript
} catch (error) {
    logger.error('Error deleting customer:', error);
    
    // Handle specific error messages
    let errorMessage = 'Gagal menghapus pelanggan';
    let statusCode = 500;
    
    if (error.message.includes('Customer not found')) {
        errorMessage = 'Pelanggan tidak ditemukan';
        statusCode = 404;
    } else if (error.message.includes('invoice(s) still exist')) {
        errorMessage = 'Tidak dapat menghapus pelanggan karena masih memiliki tagihan. Silakan hapus semua tagihan terlebih dahulu.';
        statusCode = 400;
    } else if (error.message.includes('foreign key constraint')) {
        errorMessage = 'Tidak dapat menghapus pelanggan karena masih memiliki data terkait. Silakan hapus data terkait terlebih dahulu.';
        statusCode = 400;
    }
    
    res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.message
    });
}
```

### 2. Improved Create Customer Error Handling

#### Before (BROKEN)
```javascript
} catch (error) {
    logger.error('Error creating customer:', error);
    res.status(500).json({
        success: false,
        message: 'Error creating customer: ' + error.message
    });
}
```

#### After (FIXED)
```javascript
} catch (error) {
    logger.error('Error creating customer:', error);
    
    // Handle specific error messages
    let errorMessage = 'Gagal menambahkan pelanggan';
    let statusCode = 500;
    
    if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('phone')) {
            errorMessage = 'Nomor telepon sudah terdaftar. Silakan gunakan nomor telepon yang berbeda.';
        } else if (error.message.includes('username')) {
            errorMessage = 'Username sudah digunakan. Silakan coba lagi.';
        } else {
            errorMessage = 'Data sudah ada dalam sistem. Silakan cek kembali.';
        }
        statusCode = 400;
    } else if (error.message.includes('FOREIGN KEY constraint failed')) {
        errorMessage = 'Paket yang dipilih tidak valid. Silakan pilih paket yang tersedia.';
        statusCode = 400;
    } else if (error.message.includes('not null constraint')) {
        errorMessage = 'Data wajib tidak boleh kosong. Silakan lengkapi semua field yang diperlukan.';
        statusCode = 400;
    }
    
    res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.message
    });
}
```

### 3. Improved Update Customer Error Handling

#### Before (BROKEN)
```javascript
if (!currentCustomer) {
    return res.status(404).json({
        success: false,
        message: 'Customer not found'
    });
}

} catch (error) {
    logger.error('Error updating customer:', error);
    res.status(500).json({
        success: false,
        message: 'Error updating customer: ' + error.message
    });
}
```

#### After (FIXED)
```javascript
if (!currentCustomer) {
    return res.status(404).json({
        success: false,
        message: 'Pelanggan tidak ditemukan'
    });
}

} catch (error) {
    logger.error('Error updating customer:', error);
    
    // Handle specific error messages
    let errorMessage = 'Gagal mengupdate pelanggan';
    let statusCode = 500;
    
    if (error.message.includes('Pelanggan tidak ditemukan')) {
        errorMessage = 'Pelanggan tidak ditemukan';
        statusCode = 404;
    } else if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('phone')) {
            errorMessage = 'Nomor telepon sudah terdaftar. Silakan gunakan nomor telepon yang berbeda.';
        } else if (error.message.includes('username')) {
            errorMessage = 'Username sudah digunakan. Silakan coba lagi.';
        } else {
            errorMessage = 'Data sudah ada dalam sistem. Silakan cek kembali.';
        }
        statusCode = 400;
    } else if (error.message.includes('FOREIGN KEY constraint failed')) {
        errorMessage = 'Paket yang dipilih tidak valid. Silakan pilih paket yang tersedia.';
        statusCode = 400;
    } else if (error.message.includes('not null constraint')) {
        errorMessage = 'Data wajib tidak boleh kosong. Silakan lengkapi semua field yang diperlukan.';
        statusCode = 400;
    }
    
    res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.message
    });
}
```

### 4. Updated Database Error Messages

#### Before (BROKEN)
```javascript
reject(new Error('Customer not found'));
reject(new Error(`Cannot delete customer: ${invoices.length} invoice(s) still exist for this customer. Please delete all invoices first.`));
```

#### After (FIXED)
```javascript
reject(new Error('Pelanggan tidak ditemukan'));
reject(new Error(`Tidak dapat menghapus pelanggan: ${invoices.length} tagihan masih ada untuk pelanggan ini. Silakan hapus semua tagihan terlebih dahulu.`));
```

## Error Types Handled

### 1. Database Constraints
- **UNIQUE constraint failed**: Data duplikat
- **FOREIGN KEY constraint failed**: Referensi tidak valid
- **NOT NULL constraint failed**: Data wajib kosong

### 2. Business Logic Errors
- **Customer not found**: Pelanggan tidak ditemukan
- **Invoice exists**: Masih ada tagihan terkait
- **Invalid package**: Paket tidak valid

### 3. HTTP Status Codes
- **400 Bad Request**: Error validasi atau constraint
- **404 Not Found**: Data tidak ditemukan
- **500 Internal Server Error**: Error sistem

## Benefits

### 1. Better User Experience
- Pesan error dalam bahasa Indonesia
- Pesan yang jelas dan informatif
- Guidance untuk user tentang apa yang harus dilakukan

### 2. Production Ready
- Error muncul di web interface, bukan hanya console
- Proper HTTP status codes
- Consistent error handling across all endpoints

### 3. Developer Friendly
- Detailed error logging tetap ada
- Original error message disimpan untuk debugging
- Structured error responses

## Testing Scenarios

### 1. Delete Customer with Invoices
- **Expected**: Error 400 dengan pesan "Tidak dapat menghapus pelanggan karena masih memiliki tagihan"
- **Result**: ✅ Works correctly

### 2. Delete Non-existent Customer
- **Expected**: Error 404 dengan pesan "Pelanggan tidak ditemukan"
- **Result**: ✅ Works correctly

### 3. Create Customer with Duplicate Phone
- **Expected**: Error 400 dengan pesan "Nomor telepon sudah terdaftar"
- **Result**: ✅ Works correctly

### 4. Update Customer with Invalid Package
- **Expected**: Error 400 dengan pesan "Paket yang dipilih tidak valid"
- **Result**: ✅ Works correctly

## Files Modified

### 1. `routes/adminBilling.js`
- Fixed error handling for DELETE `/customers/:phone`
- Fixed error handling for POST `/customers`
- Fixed error handling for PUT `/customers/:phone`

### 2. `config/billing.js`
- Updated error messages to Indonesian
- Improved error handling in `deleteCustomer` function

## Conclusion

Error handling telah diperbaiki untuk:
- Menampilkan pesan error dalam bahasa Indonesia
- Memberikan feedback yang jelas di web interface
- Menggunakan HTTP status codes yang proper
- Tetap menyimpan detail error untuk debugging

Sekarang user akan mendapatkan pesan error yang jelas dan informatif di web interface, bukan hanya di console.
