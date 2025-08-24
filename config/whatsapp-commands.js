const { getSetting } = require('./settingsManager');
const logger = require('./logger');

class WhatsAppCommands {
    constructor(whatsappCore) {
        this.core = whatsappCore;
        this.sock = null;
    }

    // Set socket instance
    setSock(sock) {
        this.sock = sock;
    }

    // Get socket instance
    getSock() {
        return this.sock || this.core.getSock();
    }

    // Helper function untuk mengirim pesan
    async sendMessage(remoteJid, text) {
        const sock = this.getSock();
        if (!sock) {
            console.error('Sock instance not set');
            return false;
        }

        try {
            await sock.sendMessage(remoteJid, { text });
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    // Command: cek status perangkat
    async handleCekStatus(remoteJid, customerNumber) {
        if (!customerNumber) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\n` +
                      `Format yang benar:\n` +
                      `cek [nomor_pelanggan]\n\n` +
                      `Contoh:\n` +
                      `cek 123456`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `🔍 *MENCARI PERANGKAT*\n\nSedang mencari perangkat untuk pelanggan ${customerNumber}...\nMohon tunggu sebentar.` 
            });

            // Implementasi cek status perangkat
            // ... existing code ...
            
        } catch (error) {
            console.error('Error in handleCekStatus:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mengecek status:\n${error.message}` 
            });
        }
    }

    // Command: ganti SSID WiFi
    async handleGantiSSID(remoteJid, customerNumber, newSSID) {
        if (!customerNumber || !newSSID) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\ngantissid [nomor_pelanggan] [ssid_baru]\n\nContoh:\ngantissid 123456 WiFiBaru`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES PERUBAHAN SSID*\n\nSedang mengubah SSID WiFi...\nMohon tunggu sebentar.` 
            });

            // Implementasi ganti SSID
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleGantiSSID:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mengubah SSID:\n${error.message}` 
            });
        }
    }

    // Command: ganti password WiFi
    async handleGantiPassword(remoteJid, customerNumber, newPassword) {
        if (!customerNumber || !newPassword) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\ngantipass [nomor_pelanggan] [password_baru]\n\nContoh:\ngantipass 123456 password123`
            });
            return;
        }

        if (newPassword.length < 8) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *Password terlalu pendek!*\n\nPassword harus minimal 8 karakter.`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES PERUBAHAN PASSWORD*\n\nSedang mengubah password WiFi...\nMohon tunggu sebentar.` 
            });

            // Implementasi ganti password
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleGantiPassword:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mengubah password:\n${error.message}` 
            });
        }
    }

    // Command: reboot perangkat
    async handleReboot(remoteJid, customerNumber) {
        if (!customerNumber) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\nreboot [nomor_pelanggan]\n\nContoh:\nreboot 123456`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES REBOOT*\n\nSedang me-restart perangkat...\nMohon tunggu sebentar.` 
            });

            // Implementasi reboot
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleReboot:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat reboot:\n${error.message}` 
            });
        }
    }

    // Command: tambah tag
    async handleAddTag(remoteJid, deviceId, customerNumber) {
        if (!deviceId || !customerNumber) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\naddtag [device_id] [nomor_pelanggan]\n\nContoh:\naddtag device123 123456`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES PENAMBAHAN TAG*\n\nSedang menambahkan tag...\nMohon tunggu sebentar.` 
            });

            // Implementasi tambah tag
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleAddTag:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat menambahkan tag:\n${error.message}` 
            });
        }
    }

    // Command: hapus tag
    async handleRemoveTag(remoteJid, deviceId, tag) {
        if (!deviceId || !tag) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\nuntag [device_id] [tag]\n\nContoh:\nuntag device123 tag123`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES PENGHAPUSAN TAG*\n\nSedang menghapus tag...\nMohon tunggu sebentar.` 
            });

            // Implementasi hapus tag
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleRemoveTag:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat menghapus tag:\n${error.message}` 
            });
        }
    }

    // Command: lihat tags
    async handleListTags(remoteJid, deviceId) {
        if (!deviceId) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\ntags [device_id]\n\nContoh:\ntags device123`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `🔍 *MENCARI TAGS*\n\nSedang mencari tags untuk device ${deviceId}...\nMohon tunggu sebentar.` 
            });

            // Implementasi lihat tags
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleListTags:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mencari tags:\n${error.message}` 
            });
        }
    }

    // Command: refresh perangkat
    async handleRefresh(remoteJid, deviceId) {
        if (!deviceId) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *FORMAT SALAH*\n\nFormat yang benar:\nrefresh [device_id]\n\nContoh:\nrefresh device123`
            });
            return;
        }

        try {
            await this.sendMessage(remoteJid, { 
                text: `⏳ *PROSES REFRESH*\n\nSedang refresh data perangkat...\nMohon tunggu sebentar.` 
            });

            // Implementasi refresh
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleRefresh:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat refresh:\n${error.message}` 
            });
        }
    }

    // Command: cek semua perangkat
    async handleCekAll(remoteJid) {
        try {
            await this.sendMessage(remoteJid, { 
                text: `🔍 *MENCARI SEMUA PERANGKAT*\n\nSedang mencari semua perangkat...\nMohon tunggu sebentar.` 
            });

            // Implementasi cek semua perangkat
            // ... existing code ...

        } catch (error) {
            console.error('Error in handleCekAll:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mencari perangkat:\n${error.message}` 
            });
        }
    }

    // Command: set header
    async handleSetHeader(remoteJid, newHeader) {
        if (!newHeader) {
            await this.sendMessage(remoteJid, { 
                text: `❌ *Format salah!*\n\nsetheader [teks_header_baru]`
            });
            return;
        }

        try {
            const { setSetting } = require('./settingsManager');
            const success = setSetting('company_header', newHeader);
            
            if (success) {
                await this.sendMessage(remoteJid, { 
                    text: `✅ *Header berhasil diubah!*\n\nHeader baru: ${newHeader}`
                });
            } else {
                await this.sendMessage(remoteJid, { 
                    text: `❌ *Gagal mengubah header!*\n\nTerjadi kesalahan saat menyimpan ke settings.`
                });
            }
        } catch (error) {
            console.error('Error in handleSetHeader:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat mengubah header:\n${error.message}` 
            });
        }
    }

    // Command: status sistem
    async handleStatus(remoteJid) {
        try {
            const status = this.core.getWhatsAppStatus();
            const uptime = process.uptime();
            const uptimeHours = Math.floor(uptime / 3600);
            const uptimeMinutes = Math.floor((uptime % 3600) / 60);
            
            let message = `📊 *STATUS SISTEM*\n\n`;
            message += `• WhatsApp: ${status.connected ? '🟢 Connected' : '🔴 Disconnected'}\n`;
            message += `• Uptime: ${uptimeHours}j ${uptimeMinutes}m\n`;
            message += `• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n`;
            message += `• Node.js: ${process.version}\n`;
            message += `• Platform: ${process.platform}\n`;
            
            if (status.connectedSince) {
                message += `• Connected since: ${status.connectedSince.toLocaleString('id-ID')}\n`;
            }
            
            await this.sendMessage(remoteJid, { text: message });
        } catch (error) {
            console.error('Error in handleStatus:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat menampilkan status:\n${error.message}` 
            });
        }
    }

    // Command: restart aplikasi
    async handleRestart(remoteJid) {
        try {
            await this.sendMessage(remoteJid, { 
                text: `⚠️ *KONFIRMASI RESTART*\n\nAnda yakin ingin me-restart aplikasi?\n\nKetik: *ya* untuk konfirmasi\nKetik: *tidak* untuk batal`
            });
            
            // Set flag untuk konfirmasi restart
            global.pendingRestart = true;
            global.restartRequestedBy = remoteJid;
            
        } catch (error) {
            console.error('Error in handleRestart:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat memproses restart:\n${error.message}` 
            });
        }
    }

    // Command: konfirmasi restart
    async handleConfirmRestart(remoteJid) {
        try {
            if (global.pendingRestart && global.restartRequestedBy === remoteJid) {
                await this.sendMessage(remoteJid, { 
                    text: `🔄 *RESTARTING APLIKASI*\n\nAplikasi akan di-restart dalam 5 detik...\n\nTerima kasih telah menggunakan layanan kami.`
                });
                
                // Clear flags
                global.pendingRestart = false;
                global.restartRequestedBy = null;
                
                // Restart setelah 5 detik
                setTimeout(() => {
                    process.exit(0);
                }, 5000);
            } else {
                await this.sendMessage(remoteJid, { 
                    text: `❌ *TIDAK ADA PERMINTAAN RESTART*\n\nTidak ada permintaan restart yang pending.`
                });
            }
        } catch (error) {
            console.error('Error in handleConfirmRestart:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat konfirmasi restart:\n${error.message}` 
            });
        }
    }

    // Command: debug resource
    async handleDebugResource(remoteJid) {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            let message = `🔍 *DEBUG RESOURCE*\n\n`;
            message += `• Memory Usage:\n`;
            message += `  - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB\n`;
            message += `  - Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB\n`;
            message += `  - Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
            message += `  - External: ${Math.round(memUsage.external / 1024 / 1024)}MB\n`;
            message += `• CPU Usage:\n`;
            message += `  - User: ${Math.round(cpuUsage.user / 1000)}ms\n`;
            message += `  - System: ${Math.round(cpuUsage.system / 1000)}ms\n`;
            message += `• Process Info:\n`;
            message += `  - PID: ${process.pid}\n`;
            message += `  - Uptime: ${Math.floor(process.uptime())}s\n`;
            
            await this.sendMessage(remoteJid, { text: message });
        } catch (error) {
            console.error('Error in handleDebugResource:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat debug resource:\n${error.message}` 
            });
        }
    }

    // Command: check group
    async handleCheckGroup(remoteJid) {
        try {
            const { getSetting } = require('./settingsManager');
            const technicianGroupId = getSetting('technician_group_id', '');
            const technicianNumbers = getSetting('technician_numbers', []);
            
            let message = `👥 *CHECK GROUP & NOMOR*\n\n`;
            message += `• Technician Group ID:\n`;
            message += `  ${technicianGroupId || 'Tidak dikonfigurasi'}\n\n`;
            message += `• Technician Numbers:\n`;
            
            if (technicianNumbers && technicianNumbers.length > 0) {
                technicianNumbers.forEach((num, index) => {
                    message += `  ${index + 1}. ${num}\n`;
                });
            } else {
                message += `  Tidak ada nomor technician\n`;
            }
            
            await this.sendMessage(remoteJid, { text: message });
        } catch (error) {
            console.error('Error in handleCheckGroup:', error);
            await this.sendMessage(remoteJid, { 
                text: `❌ *ERROR*\n\nTerjadi kesalahan saat check group:\n${error.message}` 
            });
        }
    }
}

module.exports = WhatsAppCommands;
