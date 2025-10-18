class VenexDashboard {
    constructor() {
        this.currentChart = null;
        this.socket = null;
        this.init();
    }

    init() {
        this.initializeCharts();
        this.setupEventListeners();
        this.setupWebSocket();
        this.loadRealTimeData();
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

        // Notification click handler
        const notifications = document.querySelector('.notifications');
        if (notifications) {
            notifications.addEventListener('click', () => this.showNotifications());
        }

        // Auto-refresh data every 30 seconds
        setInterval(() => this.refreshDashboardData(), 30000);
    }

    // Handle quick trade execution
    async handleQuickTrade(event) {
        const button = event.currentTarget;
        const action = button.getAttribute('data-action');
        const form = document.getElementById('quick-trade-form');
        
        if (!form) return;

        // Show loading state
        button.classList.add('loading');
        button.disabled = true;

        try {
            const formData = new FormData(form);
            formData.append('action', action);

            const response = await fetch('/api/trade/quick/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.getCSRFToken()
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Trade ${action} executed successfully!`, 'success');
                // Refresh dashboard data
                this.refreshDashboardData();
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

    // Setup WebSocket for real-time updates
    setupWebSocket() {
        if (typeof VENEX_CONFIG === 'undefined' || !VENEX_CONFIG.api.wsUrl) {
            console.warn('WebSocket URL not configured');
            return;
        }

        try {
            this.socket = new WebSocket(VENEX_CONFIG.api.wsUrl);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                // Subscribe to market data updates
                this.socket.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['prices', 'portfolio']
                }));
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('WebSocket setup failed:', error);
        }
    }

    // Handle incoming WebSocket messages
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'price_update':
                this.updatePriceDisplay(data.symbol, data.price, data.change);
                break;
            case 'portfolio_update':
                this.updatePortfolioValues(data.portfolio);
                break;
            case 'transaction_update':
                this.addNewTransaction(data.transaction);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    // Update price display in real-time
    updatePriceDisplay(symbol, price, change) {
        // Update crypto cards
        const cryptoCard = document.querySelector(`[data-symbol="${symbol}"]`);
        if (cryptoCard) {
            const priceElement = cryptoCard.querySelector('.crypto-value');
            const changeElement = cryptoCard.querySelector('.crypto-change');
            
            if (priceElement) {
                priceElement.textContent = `$${parseFloat(price).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 8
                })}`;
            }
            
            if (changeElement) {
                const isPositive = parseFloat(change) >= 0;
                changeElement.textContent = `${isPositive ? '+' : ''}${change}%`;
                changeElement.className = `crypto-change ${isPositive ? 'positive' : 'negative'}`;
            }
        }

        // Update total portfolio value if this affects user's holdings
        this.updateTotalPortfolioValue();
    }

    // Update portfolio values from WebSocket data
    updatePortfolioValues(portfolioData) {
        portfolioData.forEach(asset => {
            const portfolioItem = document.querySelector(`[data-portfolio-symbol="${asset.symbol}"]`);
            if (portfolioItem) {
                const currentValue = portfolioItem.querySelector('.crypto-value');
                const profitLoss = portfolioItem.querySelector('.crypto-change');
                
                if (currentValue) {
                    currentValue.textContent = `$${asset.current_value}`;
                }
                if (profitLoss) {
                    profitLoss.textContent = `${asset.profit_loss_percentage}%`;
                    profitLoss.className = `crypto-change ${asset.profit_loss_percentage >= 0 ? 'positive' : 'negative'}`;
                }
            }
        });
    }

    // Add new transaction to the recent transactions list
    addNewTransaction(transaction) {
        const transactionsList = document.querySelector('.transactions-list');
        if (!transactionsList) return;

        const transactionElement = this.createTransactionElement(transaction);
        
        // Add to top of list
        transactionsList.insertBefore(transactionElement, transactionsList.firstChild);
        
        // Remove oldest transaction if we have more than 10
        const allTransactions = transactionsList.querySelectorAll('.transaction-item');
        if (allTransactions.length > 10) {
            allTransactions[allTransactions.length - 1].remove();
        }
    }

    // Create HTML element for a transaction
    createTransactionElement(transaction) {
        const div = document.createElement('div');
        div.className = `transaction-item`;
        div.innerHTML = `
            <div class="transaction-type ${transaction.transaction_type.toLowerCase()}">
                <span class="type-icon">
                    ${this.getTransactionIcon(transaction.transaction_type)}
                </span>
                ${transaction.transaction_type}
            </div>
            <div class="transaction-details">
                <span class="crypto">${transaction.cryptocurrency}</span>
                <span class="amount">${transaction.quantity}</span>
            </div>
            <div class="transaction-meta">
                <span class="status ${transaction.status.toLowerCase()}">${transaction.status}</span>
                <span class="time">Just now</span>
            </div>
        `;
        return div;
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

    // Refresh dashboard data
    async refreshDashboardData() {
        try {
            const response = await fetch('/api/dashboard/data/');
            const data = await response.json();
            
            if (data.success) {
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
        if (balanceElement && data.total_balance) {
            balanceElement.textContent = `$${data.total_balance}`;
        }

        // Update portfolio distribution
        if (data.portfolio_distribution) {
            this.updatePortfolioDistribution(data.portfolio_distribution);
        }
    }

    // Update portfolio distribution grid
    updatePortfolioDistribution(distribution) {
        const grid = document.querySelector('.crypto-grid');
        if (!grid) return;

        grid.innerHTML = distribution.map(asset => `
            <div class="crypto-card" data-symbol="${asset.symbol}">
                <div class="crypto-symbol">${asset.symbol}</div>
                <div class="crypto-amount">${asset.quantity}</div>
                <div class="crypto-value">$${asset.value}</div>
                <div class="crypto-change ${asset.profit_loss_percentage >= 0 ? 'positive' : 'negative'}">
                    ${asset.profit_loss_percentage}%
                </div>
            </div>
        `).join('');
    }

    // Update total portfolio value
    updateTotalPortfolioValue() {
        // This would recalculate based on current prices
        // In a real implementation, this would make an API call or calculate locally
        console.log('Updating total portfolio value...');
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
            sidebar.classList.toggle('mobile-open');
        });

        document.body.appendChild(menuToggle);

        // Update on resize
        window.addEventListener('resize', () => {
            menuToggle.style.display = window.innerWidth <= 768 ? 'block' : 'none';
        });
    }

    // Show notifications panel
    showNotifications() {
        // This would show a notifications modal or dropdown
        console.log('Showing notifications...');
        this.showToast('Notifications feature coming soon!', 'info');
    }

    // Show toast notification
    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
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
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.venexDashboard = new VenexDashboard();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VenexDashboard;
}