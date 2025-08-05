const cron = require('node-cron');
const billingManager = require('./billing');
const { logger } = require('./logger');

class InvoiceScheduler {
    constructor() {
        this.initScheduler();
    }

    initScheduler() {
        // Schedule monthly invoice generation on 1st of every month at 00:01
        cron.schedule('1 0 1 * *', async () => {
            try {
                logger.info('Starting automatic monthly invoice generation...');
                await this.generateMonthlyInvoices();
                logger.info('Automatic monthly invoice generation completed');
            } catch (error) {
                logger.error('Error in automatic monthly invoice generation:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });

        logger.info('Invoice scheduler initialized - will run on 1st of every month at 00:01');
        
        // Schedule daily due date reminders at 09:00
        cron.schedule('0 9 * * *', async () => {
            try {
                logger.info('Starting daily due date reminders...');
                await this.sendDueDateReminders();
                logger.info('Daily due date reminders completed');
            } catch (error) {
                logger.error('Error in daily due date reminders:', error);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta"
        });
        
        logger.info('Due date reminder scheduler initialized - will run daily at 09:00');
    }

    async sendDueDateReminders() {
        try {
            const whatsappNotifications = require('./whatsapp-notifications');
            const invoices = await billingManager.getInvoices();
            const today = new Date();
            
            // Filter invoices that are due in the next 3 days
            const upcomingInvoices = invoices.filter(invoice => {
                if (invoice.status !== 'unpaid') return false;
                
                const dueDate = new Date(invoice.due_date);
                const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                
                return daysUntilDue >= 0 && daysUntilDue <= 3;
            });
            
            logger.info(`Found ${upcomingInvoices.length} invoices due in the next 3 days`);
            
            for (const invoice of upcomingInvoices) {
                try {
                    await whatsappNotifications.sendDueDateReminder(invoice.id);
                    logger.info(`Due date reminder sent for invoice ${invoice.invoice_number}`);
                } catch (error) {
                    logger.error(`Error sending due date reminder for invoice ${invoice.invoice_number}:`, error);
                }
            }
        } catch (error) {
            logger.error('Error in sendDueDateReminders:', error);
            throw error;
        }
    }

    async generateMonthlyInvoices() {
        try {
            // Get all active customers
            const customers = await billingManager.getCustomers();
            const activeCustomers = customers.filter(customer => 
                customer.status === 'active' && customer.package_id
            );

            logger.info(`Found ${activeCustomers.length} active customers for invoice generation`);

            for (const customer of activeCustomers) {
                try {
                                            // Get customer's package
                        const packageData = await billingManager.getPackageById(customer.package_id);
                        if (!packageData) {
                            logger.warn(`Package not found for customer ${customer.username}`);
                            continue;
                        }

                    // Check if invoice already exists for this month
                    const currentDate = new Date();
                    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                    const existingInvoices = await billingManager.getInvoicesByCustomerAndDateRange(
                        customer.username,
                        startOfMonth,
                        endOfMonth
                    );

                    if (existingInvoices.length > 0) {
                        logger.info(`Invoice already exists for customer ${customer.username} this month`);
                        continue;
                    }

                    // Set due date to 15th of current month
                    const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15);

                                            // Create invoice data
                        const invoiceData = {
                            customer_id: customer.id,
                            package_id: customer.package_id,
                            amount: packageData.price,
                            due_date: dueDate.toISOString().split('T')[0],
                            notes: `Tagihan bulanan ${currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`
                        };

                    // Create the invoice
                    const newInvoice = await billingManager.createInvoice(invoiceData);
                    logger.info(`Created invoice ${newInvoice.invoice_number} for customer ${customer.username}`);

                } catch (error) {
                    logger.error(`Error creating invoice for customer ${customer.username}:`, error);
                }
            }

        } catch (error) {
            logger.error('Error in generateMonthlyInvoices:', error);
            throw error;
        }
    }

    // Manual trigger for testing
    async triggerMonthlyInvoices() {
        logger.info('Manual trigger for monthly invoice generation');
        await this.generateMonthlyInvoices();
    }
}

module.exports = new InvoiceScheduler(); 