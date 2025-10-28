// Venex Broker Responsive JavaScript
class VenexResponsive {
    constructor() {
        // Elements
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = document.getElementById('mobileMenuToggle');
        this.themeToggle = document.getElementById('themeToggle');
        this.mainContent = document.querySelector('.main-content');
        
        // State
        this.darkMode = localStorage.getItem('theme') === 'dark' || 
                        (!localStorage.getItem('theme') && 
                         window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        // Initialize
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupMobileMenu();
        this.setupResizeHandler();
    }

    setupTheme() {
        // Apply initial theme
        document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        
        // Watch system theme changes
        window.matchMedia('(prefers-color-scheme: dark)')
            .addEventListener('change', e => {
                if (!localStorage.getItem('theme')) {
                    this.darkMode = e.matches;
                    this.applyTheme();
                }
            });
    }

    setupEventListeners() {
        // Theme toggle
        this.themeToggle?.addEventListener('click', () => this.toggleTheme());
        
        // Mobile menu toggle
        this.menuToggle?.addEventListener('click', () => this.toggleMobileMenu());
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.sidebar?.classList.contains('active') &&
                !this.sidebar.contains(e.target) &&
                !this.menuToggle.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
        
        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.sidebar?.classList.contains('active')) {
                this.closeMobileMenu();
            }
        });
    }

    setupMobileMenu() {
        // Add touch swipe handling for mobile
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, false);

        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, false);
        
        this.handleSwipe = () => {
            const swipeThreshold = 50;
            const swipeLength = touchEndX - touchStartX;
            
            if (Math.abs(swipeLength) > swipeThreshold) {
                if (swipeLength > 0) { // Right swipe
                    this.openMobileMenu();
                } else { // Left swipe
                    this.closeMobileMenu();
                }
            }
        };
    }

    setupResizeHandler() {
        // Debounced resize handler
        let resizeTimer;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (window.innerWidth > 768 && this.sidebar?.classList.contains('active')) {
                    this.closeMobileMenu();
                }
            }, 250);
        });
    }

    toggleTheme() {
        this.darkMode = !this.darkMode;
        localStorage.setItem('theme', this.darkMode ? 'dark' : 'light');
        this.applyTheme();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
        
        // Animate theme transition
        document.documentElement.classList.add('theme-transition');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    }

    toggleMobileMenu() {
        this.sidebar?.classList.toggle('active');
        this.menuToggle?.classList.toggle('active');
    }

    openMobileMenu() {
        if (this.sidebar && !this.sidebar.classList.contains('active')) {
            this.sidebar.classList.add('active');
            this.menuToggle?.classList.add('active');
        }
    }

    closeMobileMenu() {
        if (this.sidebar?.classList.contains('active')) {
            this.sidebar.classList.remove('active');
            this.menuToggle?.classList.remove('active');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.venexResponsive = new VenexResponsive();
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VenexResponsive;
}