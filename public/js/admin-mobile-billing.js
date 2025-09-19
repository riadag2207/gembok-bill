/**
 * Admin Mobile Billing JavaScript
 * Handles mobile interactions and enhancements for admin billing interface
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile billing interface
    initMobileBilling();
    
    // Add touch feedback for interactive elements
    addTouchFeedback();
    
    // Initialize haptic feedback
    initHapticFeedback();
    
    // Add pull-to-refresh functionality
    initPullToRefresh();
    
    // Initialize quick actions
    initQuickActions();
});

/**
 * Initialize mobile billing interface
 */
function initMobileBilling() {
    console.log('Initializing Admin Mobile Billing...');
    
    // Add loading states to stats cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('click', function() {
            this.classList.add('loading');
            setTimeout(() => {
                this.classList.remove('loading');
            }, 1500);
        });
    });
    
    // Add ripple effect to menu cards
    const menuCards = document.querySelectorAll('.menu-card');
    menuCards.forEach(card => {
        card.addEventListener('click', function(e) {
            createRippleEffect(e, this);
        });
    });
    
    // Add active state management for navigation
    updateActiveNavigation();
    
    // Add smooth scrolling for better mobile experience
    document.documentElement.style.scrollBehavior = 'smooth';
}

/**
 * Add touch feedback for interactive elements
 */
function addTouchFeedback() {
    const interactiveElements = document.querySelectorAll('.menu-card, .action-btn, .stat-card, .nav-item');
    
    interactiveElements.forEach(element => {
        // Touch start
        element.addEventListener('touchstart', function(e) {
            this.style.transform = 'translateY(-2px) scale(0.98)';
            this.style.transition = 'all 0.1s ease';
            
            // Add haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
        });
        
        // Touch end
        element.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.transform = '';
                this.style.transition = 'all 0.3s ease';
            }, 150);
        });
        
        // Touch cancel
        element.addEventListener('touchcancel', function() {
            this.style.transform = '';
            this.style.transition = 'all 0.3s ease';
        });
    });
}

/**
 * Initialize haptic feedback
 */
function initHapticFeedback() {
    if (!navigator.vibrate) {
        console.log('Haptic feedback not supported on this device');
        return;
    }
    
    // Different vibration patterns for different actions
    const vibrationPatterns = {
        success: [100, 50, 100],
        error: [200, 100, 200],
        warning: [150, 75, 150],
        info: [50, 25, 50]
    };
    
    // Add haptic feedback to action buttons
    const actionButtons = document.querySelectorAll('.action-btn');
    actionButtons.forEach(button => {
        button.addEventListener('click', function() {
            navigator.vibrate(vibrationPatterns.info);
        });
    });
    
    // Add haptic feedback to menu cards
    const menuCards = document.querySelectorAll('.menu-card');
    menuCards.forEach(card => {
        card.addEventListener('click', function() {
            navigator.vibrate(vibrationPatterns.success);
        });
    });
}

/**
 * Initialize pull-to-refresh functionality
 */
function initPullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let isRefreshing = false;
    const refreshThreshold = 100;
    
    document.addEventListener('touchstart', function(e) {
        if (window.scrollY === 0) {
            startY = e.touches[0].clientY;
        }
    });
    
    document.addEventListener('touchmove', function(e) {
        if (window.scrollY === 0 && startY > 0) {
            currentY = e.touches[0].clientY;
            const pullDistance = currentY - startY;
            
            if (pullDistance > 0) {
                e.preventDefault();
                
                // Add visual feedback
                const pullDistancePercent = Math.min(pullDistance / refreshThreshold, 1);
                document.body.style.transform = `translateY(${pullDistance * 0.5}px)`;
                document.body.style.opacity = 1 - (pullDistancePercent * 0.1);
                
                // Show refresh indicator
                showRefreshIndicator(pullDistancePercent);
            }
        }
    });
    
    document.addEventListener('touchend', function(e) {
        if (startY > 0) {
            const pullDistance = currentY - startY;
            
            if (pullDistance > refreshThreshold && !isRefreshing) {
                triggerRefresh();
            } else {
                // Reset position
                document.body.style.transform = '';
                document.body.style.opacity = '';
                hideRefreshIndicator();
            }
            
            startY = 0;
            currentY = 0;
        }
    });
}

/**
 * Show refresh indicator
 */
function showRefreshIndicator(progress) {
    let indicator = document.getElementById('refresh-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'refresh-indicator';
        indicator.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Pull to refresh';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(67, 97, 238, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 9999;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicator);
    }
    
    indicator.style.opacity = progress;
    indicator.style.transform = `translateX(-50%) scale(${0.8 + progress * 0.2})`;
}

/**
 * Hide refresh indicator
 */
function hideRefreshIndicator() {
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
        indicator.style.opacity = '0';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 300);
    }
}

/**
 * Trigger refresh
 */
function triggerRefresh() {
    isRefreshing = true;
    
    // Show loading state
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
        indicator.innerHTML = '<i class="bi bi-arrow-clockwise spinner"></i> Refreshing...';
    }
    
    // Simulate refresh (in real app, this would reload data)
    setTimeout(() => {
        location.reload();
    }, 1000);
}

/**
 * Initialize quick actions
 */
function initQuickActions() {
    // Quick Add Customer
    window.quickAddCustomer = function() {
        showQuickModal('Tambah Pelanggan', 'customer-form');
    };
    
    // Quick Create Invoice
    window.quickCreateInvoice = function() {
        showQuickModal('Buat Tagihan', 'invoice-form');
    };
    
    // Quick Payment
    window.quickPayment = function() {
        showQuickModal('Input Pembayaran', 'payment-form');
    };
    
    // Quick Report
    window.quickReport = function() {
        showQuickModal('Laporan Cepat', 'report-form');
    };
}

/**
 * Show quick action modal
 */
function showQuickModal(title, formType) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
    `;
    
    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 20px;
        max-width: 400px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    
    modal.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0">${title}</h5>
            <button class="btn-close" onclick="closeQuickModal()"></button>
        </div>
        <div id="quick-form-content">
            <p class="text-muted">Fitur ${title} akan segera tersedia. Redirect ke halaman lengkap...</p>
            <div class="d-grid gap-2 mt-3">
                <button class="btn btn-primary" onclick="redirectToFullPage('${formType}')">
                    Buka Halaman Lengkap
                </button>
                <button class="btn btn-outline-secondary" onclick="closeQuickModal()">
                    Batal
                </button>
            </div>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add animation
    overlay.style.opacity = '0';
    modal.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
    }, 10);
    
    // Close on overlay click
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeQuickModal();
        }
    });
    
    // Store reference for closing
    window.currentQuickModal = overlay;
}

/**
 * Close quick modal
 */
function closeQuickModal() {
    const overlay = window.currentQuickModal;
    if (overlay) {
        overlay.style.opacity = '0';
        const modal = overlay.querySelector('div');
        modal.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
        
        window.currentQuickModal = null;
    }
}

/**
 * Redirect to full page
 */
function redirectToFullPage(formType) {
    const routes = {
        'customer-form': '/admin/billing/customers?action=add',
        'invoice-form': '/admin/billing/invoices?action=create',
        'payment-form': '/admin/billing/payments?action=input',
        'report-form': '/admin/billing/reports'
    };
    
    const route = routes[formType];
    if (route) {
        window.location.href = route;
    }
}

/**
 * Create ripple effect for button clicks
 */
function createRippleEffect(event, element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255, 255, 255, 0.3)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s linear';
    ripple.style.pointerEvents = 'none';
    
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

/**
 * Update active navigation state
 */
function updateActiveNavigation() {
    const currentPath = window.location.pathname;
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href');
        
        if (currentPath.includes(href.replace('/admin/billing/mobile', ''))) {
            item.classList.add('active');
        }
    });
}

/**
 * Add CSS for ripple animation
 */
const rippleCSS = `
@keyframes ripple {
    0% {
        transform: scale(0);
        opacity: 1;
    }
    100% {
        transform: scale(2);
        opacity: 0;
    }
}

.spinner {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

// Inject CSS
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

/**
 * Performance optimization
 */
function optimizePerformance() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Debounce scroll events
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // Handle scroll events here
        }, 100);
    });
}

// Initialize performance optimizations
optimizePerformance();

/**
 * Error handling
 */
window.addEventListener('error', function(e) {
    console.error('Admin Mobile Billing Error:', e.error);
    
    // Show user-friendly error message
    if (e.error && e.error.message) {
        showNotification('Terjadi kesalahan: ' + e.error.message, 'error');
    }
});

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

console.log('Admin Mobile Billing JavaScript loaded successfully!');
