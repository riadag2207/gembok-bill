// Modul logger untuk aplikasi
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { getSetting } = require('./settingsManager');

// Buat direktori logs jika belum ada
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Format untuk log
const logFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// Konfigurasi logger
const logger = winston.createLogger({
    level: getSetting('log_level', 'info'),
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        logFormat
    ),
    transports: [
        // Log ke file
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log') 
        }),
        // Log ke console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                logFormat
            )
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log') 
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }),
                logFormat
            )
        })
    ]
});

// Activity Log System
class ActivityLogger {
    constructor() {
        // Lazy loading untuk menghindari circular dependency
        this.db = null;
        this.initTable();
    }
    
    getDb() {
        if (!this.db) {
            this.db = require('./billing').db;
        }
        return this.db;
    }
    
    initTable() {
        // Delay initialization untuk menghindari circular dependency
        setTimeout(() => {
            try {
                const db = this.getDb();
                const sql = `
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        user_type TEXT,
                        action TEXT,
                        description TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `;
                
                db.run(sql, (err) => {
                    if (err) {
                        console.error('Error creating activity_logs table:', err);
                    } else {
                        console.log('Activity logs table ready');
                    }
                });
            } catch (error) {
                console.error('Error initializing activity logs table:', error);
            }
        }, 1000); // Delay 1 detik
    }
    
    log(userId, userType, action, description, req = null) {
        try {
            const db = this.getDb();
            const ipAddress = req ? (req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip) : '';
            const userAgent = req ? req.headers['user-agent'] : '';
            
            const sql = `
                INSERT INTO activity_logs (user_id, user_type, action, description, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [userId, userType, action, description, ipAddress, userAgent], (err) => {
                if (err) {
                    console.error('Error logging activity:', err);
                }
            });
        } catch (error) {
            console.error('Error in activity logging:', error);
        }
    }
    
    getLogs(limit = 100, offset = 0) {
        return new Promise((resolve, reject) => {
            try {
                const db = this.getDb();
                const sql = `
                    SELECT * FROM activity_logs 
                    ORDER BY created_at DESC 
                    LIMIT ? OFFSET ?
                `;
                
                db.all(sql, [limit, offset], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    getLogsByUser(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            try {
                const db = this.getDb();
                const sql = `
                    SELECT * FROM activity_logs 
                    WHERE user_id = ?
                    ORDER BY created_at DESC 
                    LIMIT ?
                `;
                
                db.all(sql, [userId, limit], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
    
    clearOldLogs(days = 30) {
        return new Promise((resolve, reject) => {
            try {
                const db = this.getDb();
                const sql = `
                    DELETE FROM activity_logs 
                    WHERE created_at < datetime('now', '-${days} days')
                `;
                
                db.run(sql, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}

// Create activity logger instance
const activityLogger = new ActivityLogger();

module.exports = {
    logger,
    activityLogger
};
