// venex-dashboard.js - UPDATED VERSION
class VenexDashboard {
    constructor() {
        this.currentChart = null;
        this.userId = document.body.getAttribute('data-user-id');
        this.init();
    }

    init() {
        this.initializeCharts();
        this.setupEventListeners();
        this.loadRealTimeData();
        
        // WebSocket is now handled by VenexWebSocket class
        console.log('Dashboard initialized for user:', this.userId);
    }

    // Initialize price charts
    initializeCharts() {
        const chartElement = document.getElementById('priceChart');
        if (!chartElement) return;

        const ctx = chartElement.getContext('2d');
        
        // Sample data - in production, this would come from an API
        const data = {
            labels: ['1H', '6H', '12H', '1D', '1W', '1M'],
            datasets: [{
                label: 'BTC Price',
                data: [41250, 41320, 41180, 41050, 40800, 40500, 41250],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        };

        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `Price: $${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280',
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#667eea',
                        hoverBorderColor: '#ffffff',
                        hoverBorderWidth: 3
                    }
                }
            }
        };

        this.currentChart = new Chart(ctx, config);
    }

    // Setup event listeners for interactive elements
    setupEventListeners() {
        // Quick trade buttons
        document.querySelectorAll('.trade-buttons button').forEach(button => {
            button.addEventListener('click', (e) => this.handleQuickTrade(e));
        });

        // Chart cryptocurrency selector
        const chartSelect = document.getElementById('chart-crypto-select');
        if (chartSelect) {
            chartSelect.addEventListener('change', (e) => this.updateChartData(e.target.value));
        }

        // Mobile menu toggle (for responsive design)
        this.setupMobileMenu();

        // Auto-refresh data every 30 seconds
        setInterval(() => this.refreshDashboardData(), 30000);
    }

    // Handle quick trade execution
    async handleQuickTrade(event) {
        const button = event.currentTarget;
        const action = button.getAttribute('data-action');
        const symbol = button.getAttribute('data-symbol');
        
        if (!symbol) {
            this.showToast('Please select a cryptocurrency first', 'error');
            return;
        }

        // Show loading state
        button.classList.add('loading');
        button.disabled = true;

        try {
            const response = await fetch('/api/trading/buy/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    symbol: symbol,
                    quantity: '0.001', // Default small amount for quick trade
                    action: action
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showToast(`Trade ${action} executed successfully!`, 'success');
                // WebSocket will handle the real-time update
            } else {
                throw new Error(data.error || 'Trade execution failed');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
            console.error('Trade error:', error);
        } finally {
            // Remove loading state
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    // Update chart when cryptocurrency selection changes
    async updateChartData(cryptoSymbol) {
        if (!this.currentChart) return;

        try {
            // Show loading state on chart
            this.currentChart.data.datasets[0].data = [];
            this.currentChart.update('none');

            const response = await fetch(`/api/market/chart/${cryptoSymbol}/`);
            const data = await response.json();

            if (data.success) {
                this.currentChart.data.labels = data.labels;
                this.currentChart.data.datasets[0].data = data.prices;
                this.currentChart.data.datasets[0].label = `${cryptoSymbol} Price`;
                this.currentChart.update();
            }
        } catch (error) {
            console.error('Error updating chart:', error);
            this.showToast('Failed to load chart data', 'error');
        }
    }

    // Refresh dashboard data
    async refreshDashboardData() {
        try {
            const response = await fetch('/api/dashboard/');
            const data = await response.json();
            
            if (data.portfolio_summary) {
                this.updateDashboardUI(data);
            }
        } catch (error) {
            console.error('Error refreshing dashboard data:', error);
        }
    }

    // Update dashboard UI with new data
    updateDashboardUI(data) {
        // Update total balance
        const balanceElement = document.querySelector('.balance-amount');
        if (balanceElement && data.portfolio_summary.total_value) {
            balanceElement.textContent = `$${data.portfolio_summary.total_value.toLocaleString()}`;
        }

        // Update portfolio distribution
        if (data.portfolio_breakdown) {
            this.updatePortfolioDistribution(data.portfolio_breakdown);
        }

        // Update recent transactions
        if (data.recent_activity) {
            this.updateRecentTransactions(data.recent_activity);
        }
    }

    // Update portfolio distribution grid
    updatePortfolioDistribution(distribution) {
        const grid = document.querySelector('.crypto-grid');
        if (!grid) return;

        grid.innerHTML = distribution.map(asset => `
            <div class="crypto-card" data-symbol="${asset.symbol}">
                <div class="crypto-symbol">${asset.symbol}</div>
                <div class="crypto-amount">${VenexUtils.formatCrypto(asset.quantity)}</div>
                <div class="crypto-value">${VenexUtils.formatCurrency(asset.current_value)}</div>
                <div class="crypto-change ${asset.profit_loss_percentage >= 0 ? 'positive' : 'negative'}">
                    ${asset.profit_loss_percentage >= 0 ? '+' : ''}${asset.profit_loss_percentage.toFixed(2)}%
                </div>
            </div>
        `).join('');
    }

    // Update recent transactions list
    updateRecentTransactions(transactions) {
        const container = document.querySelector('.transactions-list');
        if (!container) return;

        container.innerHTML = transactions.map(tx => `
            <div class="transaction-item ${tx.type.toLowerCase()}">
                <div class="transaction-type">
                    <span class="type-icon">
                        ${this.getTransactionIcon(tx.type)}
                    </span>
                    ${tx.type}
                </div>
                <div class="transaction-details">
                    <span class="crypto">${tx.symbol || 'USD'}</span>
                    <span class="amount">${VenexUtils.formatCrypto(tx.amount)}</span>
                </div>
                <div class="transaction-meta">
                    <span class="status completed">Completed</span>
                    <span class="time">${VenexUtils.timeAgo(tx.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    // Setup mobile menu functionality
    setupMobileMenu() {
        const menuToggle = document.createElement('button');
        menuToggle.innerHTML = '☰';
        menuToggle.className = 'mobile-menu-toggle';
        menuToggle.style.cssText = `
            display: none;
            position: fixed;
            top: 1rem;
            left: 1rem;
            z-index: 1001;
            background: var(--primary-color);
            color: white;
            border: none;
            border-radius: 6px;
            width: 40px;
            height: 40px;
            font-size: 1.25rem;
            cursor: pointer;
        `;

        // Only show on mobile
        if (window.innerWidth <= 768) {
            menuToggle.style.display = 'block';
        }

        menuToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.dashboard-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('mobile-open');
            }
        });

        document.body.appendChild(menuToggle);

        // Update on resize
        window.addEventListener('resize', () => {
            menuToggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        });
    }

    // Show toast notification
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
            `;
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.cssText = `
            background: white;
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border-left: 4px solid ${this.getToastColor(type)};
            animation: slideIn 0.3s ease;
        `;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span class="toast-icon" style="margin-right: 8px;">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // Get appropriate icon for toast type
    getToastIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || '💡';
    }

    // Get color for toast type
    getToastColor(type) {
        const colors = {
            'success': '#10B981',
            'error': '#EF4444',
            'warning': '#F59E0B',
            'info': '#3B82F6'
        };
        return colors[type] || '#6B7280';
    }

    // Get appropriate icon for transaction type
    getTransactionIcon(type) {
        const icons = {
            'BUY': '⬇️',
            'SELL': '⬆️',
            'DEPOSIT': '📥',
            'WITHDRAWAL': '📤'
        };
        return icons[type] || '💰';
    }

    // Load real-time data on initialization
    loadRealTimeData() {
        this.refreshDashboardData();
    }

    // Get CSRF token from cookies
    getCSRFToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Cleanup method
    destroy() {
        if (this.currentChart) {
            this.currentChart.destroy();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize on dashboard pages
    if (document.querySelector('.dashboard-container')) {
        window.venexDashboard = new VenexDashboard();
    }
});