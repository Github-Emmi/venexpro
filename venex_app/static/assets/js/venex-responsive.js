// VENEX BROKERAGE - Responsive JavaScript Utilities
class VenexResponsive {
    constructor() {
        this.currentBreakpoint = this.getCurrentBreakpoint();
        this.sidebarOpen = false;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupResponsiveComponents();
        this.setupTouchGestures();
        this.setupViewportMeta();
        this.setupPerformanceOptimizations();
    }

    // Breakpoint Detection
    getCurrentBreakpoint() {
        const width = window.innerWidth;
        if (width < 480) return 'xs';
        if (width < 640) return 'sm';
        if (width < 768) return 'md';
        if (width < 1024) return 'lg';
        if (width < 1280) return 'xl';
        return '2xl';
    }

    // Event Listeners
    setupEventListeners() {
        // Window resize with debounce
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 250);
        });

        // Mobile menu toggle
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-toggle="sidebar"]')) {
                this.toggleSidebar();
            }
            
            if (e.target.closest('.sidebar-overlay')) {
                this.closeSidebar();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // ESC key closes sidebar
            if (e.key === 'Escape' && this.sidebarOpen) {
                this.closeSidebar();
            }
            
            // Ctrl/Cmd + / for search focus
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.focusSearch();
            }
        });

        // Prevent zoom on double-tap
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, { passive: false });
    }

    // Touch Gestures for Mobile
    setupTouchGestures() {
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const swipeDistance = this.touchEndX - this.touchStartX;

        // Swipe right to open sidebar on mobile
        if (swipeDistance > swipeThreshold && this.isMobile() && !this.sidebarOpen) {
            this.openSidebar();
        }
        
        // Swipe left to close sidebar
        if (swipeDistance < -swipeThreshold && this.sidebarOpen) {
            this.closeSidebar();
        }
    }

    // Responsive Components Setup
    setupResponsiveComponents() {
        this.initializeResponsiveTables();
        this.initializeResponsiveImages();
        this.initializeLazyLoading();
        this.setupViewportHeightFix();
    }

    // Mobile Viewport Height Fix
    setupViewportHeightFix() {
        const setVh = () => {
            const vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', `${vh}px`);
        };

        setVh();
        window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);
    }

    // Viewport Meta Setup
    setupViewportMeta() {
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
        }
    }

    // Performance Optimizations for Mobile
    setupPerformanceOptimizations() {
        // Reduce animations on low-end devices
        if (this.isLowEndDevice()) {
            document.documentElement.classList.add('reduced-motion');
        }

        // Lazy load non-critical resources
        this.lazyLoadResources();
    }

    // Device Capability Detection
    isLowEndDevice() {
        const memory = navigator.deviceMemory;
        const cores = navigator.hardwareConcurrency;
        return memory < 4 || cores < 4;
    }

    isMobile() {
        return this.currentBreakpoint === 'xs' || this.currentBreakpoint === 'sm';
    }

    isTablet() {
        return this.currentBreakpoint === 'md';
    }

    isDesktop() {
        return this.currentBreakpoint === 'lg' || this.currentBreakpoint === 'xl' || this.currentBreakpoint === '2xl';
    }

    // Sidebar Management
    toggleSidebar() {
        if (this.sidebarOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    openSidebar() {
        const sidebar = document.querySelector('.dashboard-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.add('mobile-open');
            if (overlay) overlay.classList.add('active');
            this.sidebarOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }

    closeSidebar() {
        const sidebar = document.querySelector('.dashboard-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
            this.sidebarOpen = false;
            document.body.style.overflow = '';
        }
    }

    // Responsive Tables
    initializeResponsiveTables() {
        const tables = document.querySelectorAll('.table');
        
        tables.forEach(table => {
            if (this.isMobile()) {
                this.convertTableToCards(table);
            }
        });
    }

    convertTableToCards(table) {
        if (table.classList.contains('converted-to-cards')) return;

        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rows = table.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const card = document.createElement('div');
            card.className = 'table-card';
            card.style.cssText = `
                border: 1px solid var(--border-color);
                border-radius: var(--radius-md);
                padding: var(--space-md);
                margin-bottom: var(--space-sm);
                background: var(--bg-primary);
            `;

            cells.forEach((cell, index) => {
                if (headers[index]) {
                    const item = document.createElement('div');
                    item.className = 'table-card-item';
                    item.innerHTML = `
                        <span class="table-card-label" style="font-weight: 600; color: var(--text-secondary);">
                            ${headers[index]}:
                        </span>
                        <span class="table-card-value">${cell.innerHTML}</span>
                    `;
                    item.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: var(--space-xs);';
                    card.appendChild(item);
                }
            });

            row.replaceWith(card);
        });

        table.classList.add('converted-to-cards');
        table.querySelector('thead').style.display = 'none';
    }

    // Responsive Images
    initializeResponsiveImages() {
        const images = document.querySelectorAll('img:not(.lazy-loaded)');
        
        images.forEach(img => {
            if (!img.loading) {
                img.loading = 'lazy';
            }
            
            // Add error handling
            img.addEventListener('error', () => {
                img.src = '/static/assets/images/placeholder.png';
                img.alt = 'Image not available';
            });
        });
    }

    // Lazy Loading
    initializeLazyLoading() {
        if ('IntersectionObserver' in window) {
            const lazyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        
                        if (element.dataset.src) {
                            element.src = element.dataset.src;
                        }
                        
                        if (element.dataset.srcset) {
                            element.srcset = element.dataset.srcset;
                        }
                        
                        element.classList.remove('lazy');
                        element.classList.add('lazy-loaded');
                        lazyObserver.unobserve(element);
                    }
                });
            });

            document.querySelectorAll('.lazy').forEach(element => {
                lazyObserver.observe(element);
            });
        }
    }

    // Lazy Load Resources
    lazyLoadResources() {
        // Load non-critical CSS
        const loadCSS = (href) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.media = 'print';
            link.onload = () => link.media = 'all';
            document.head.appendChild(link);
        };

        // Load non-critical JS
        const loadJS = (src) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            document.body.appendChild(script);
        };

        // Example: Load charting library only when needed
        if (document.querySelector('#priceChart')) {
            loadJS('https://cdn.jsdelivr.net/npm/chart.js');
        }
    }

    // Search Focus
    focusSearch() {
        const searchInput = document.querySelector('[data-search-input]');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    // Handle Window Resize
    handleResize() {
        const newBreakpoint = this.getCurrentBreakpoint();
        
        if (newBreakpoint !== this.currentBreakpoint) {
            this.currentBreakpoint = newBreakpoint;
            this.onBreakpointChange(newBreakpoint);
        }

        this.updateResponsiveComponents();
    }

    onBreakpointChange(breakpoint) {
        // Dispatch custom event for other components to listen to
        const event = new CustomEvent('venex:breakpointchange', {
            detail: { breakpoint }
        });
        document.dispatchEvent(event);

        // Auto-close sidebar when switching to desktop
        if (this.isDesktop() && this.sidebarOpen) {
            this.closeSidebar();
        }

        // Re-initialize responsive tables
        this.initializeResponsiveTables();
    }

    updateResponsiveComponents() {
        // Update chart sizes
        this.updateChartSizes();
        
        // Update grid layouts
        this.updateGridLayouts();
        
        // Update navigation
        this.updateNavigation();
    }

    updateChartSizes() {
        const charts = document.querySelectorAll('.chart-container canvas');
        charts.forEach(canvas => {
            const chart = Chart.getChart(canvas);
            if (chart) {
                chart.resize();
            }
        });
    }

    updateGridLayouts() {
        const grids = document.querySelectorAll('[data-responsive-grid]');
        grids.forEach(grid => {
            const config = JSON.parse(grid.dataset.responsiveGrid);
            const breakpointConfig = config[this.currentBreakpoint];
            
            if (breakpointConfig) {
                grid.style.gridTemplateColumns = breakpointConfig;
            }
        });
    }

    updateNavigation() {
        const nav = document.querySelector('.dashboard-sidebar');
        if (nav && this.isDesktop()) {
            nav.style.transform = '';
        }
    }

    // Utility Methods
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Public API
    getBreakpoint() {
        return this.currentBreakpoint;
    }

    isBreakpoint(breakpoint) {
        return this.currentBreakpoint === breakpoint;
    }

    // Cleanup
    destroy() {
        this.closeSidebar();
        window.removeEventListener('resize', this.handleResize);
    }
}

// Additional Responsive Utilities
class VenexResponsiveUtils {
    static formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    static formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    static formatPercentage(number) {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(number / 100);
    }

    static formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    }

    static formatDateTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    static truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength) + '...';
    }

    static getReadableFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    static copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize responsive system
    window.venexResponsive = new VenexResponsive();
    
    // Add global utility functions
    window.VenexUtils = VenexResponsiveUtils;

    // Add CSS custom properties for JavaScript access
    document.documentElement.style.setProperty('--breakpoint-current', window.venexResponsive.getBreakpoint());
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VenexResponsive,
        VenexResponsiveUtils
    };
}