// static/js/venex-dashboard.js - Unified Dashboard Functionality
class VenexDashboard {
    constructor() {
        this.priceUpdateInterval = null;
        this.currentTradeSymbol = 'BTC';
        this.currentTradePrice = VENEX_CONFIG.initialPrices.BTC || 0;
        this.init();
    }

    init() {
        console.log('VENEX Dashboard Initialized');
        this.setupEventListeners();
        this.startPriceUpdates();
        this.setupTradeForm();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Trade form cryptocurrency selector
        const tradeSelect = document.getElementById('trade-crypto-select');
        if (tradeSelect) {
            tradeSelect.addEventListener('change', (e) => {
                this.handleTradeCryptoChange(e.target.value);
            });
        }

        // Auto-refresh dashboard data every 30 seconds
        setInterval(() => this.refreshDashboardData(), 30000);
    }

    setupTradeForm() {
        const tradeSelect = document.getElementById('trade-crypto-select');
        const quantityInput = document.getElementById('trade-quantity');
        const currentPriceDisplay = document.getElementById('current-price-display');
        const totalAmountDisplay = document.getElementById('total-amount-display');

        const updateTradeCalculation = () => {
            const selectedOption = tradeSelect.options[tradeSelect.selectedIndex];
            const price = parseFloat(selectedOption.getAttribute('data-price')) || this.currentTradePrice;
            const quantity = parseFloat(quantityInput.value) || 0;
            const total = price * quantity;

            currentPriceDisplay.textContent = `$${price.toFixed(2)}`;
            totalAmountDisplay.textContent = `$${total.toFixed(2)}`;
            
            // Update quick trade price display
            document.getElementById('quick-trade-price').textContent = `$${price.toFixed(2)}`;
        };

        if (tradeSelect) {
            tradeSelect.addEventListener('change', updateTradeCalculation);
        }
        if (quantityInput) {
            quantityInput.addEventListener('input', updateTradeCalculation);
        }

        // Trade execution
        document.querySelectorAll('.trade-buttons button').forEach(button => {
            button.addEventListener('click', (e) => {
                const side = e.target.getAttribute('data-side');
                this.executeTrade(side);
            });
        });

        // Initial calculation
        updateTradeCalculation();
    }

    handleTradeCryptoChange(symbol) {
        this.currentTradeSymbol = symbol;
        this.currentTradePrice = VENEX_CONFIG.initialPrices[symbol] || 0;
        this.updateTradePriceDisplay();
    }

    updateTradePriceDisplay() {
        const currentPriceDisplay = document.getElementById('current-price-display');
        const quickTradePrice = document.getElementById('quick-trade-price');
        
        if (currentPriceDisplay) {
            currentPriceDisplay.textContent = `$${this.currentTradePrice.toFixed(2)}`;
        }
        if (quickTradePrice) {
            quickTradePrice.textContent = `$${this.currentTradePrice.toFixed(2)}`;
        }
        
        // Trigger calculation update
        this.triggerTradeCalculation();
    }

    triggerTradeCalculation() {
        const quantityInput = document.getElementById('trade-quantity');
        if (quantityInput && quantityInput.value) {
            quantityInput.dispatchEvent(new Event('input'));
        }
    }

    async executeTrade(side) {
        const form = document.getElementById('quick-trade-form');
        if (!form) return;

        const formData = new FormData(form);
        
        // Add trade side to form data
        formData.append('side', side);
        
        const button = document.querySelector(`.btn-${side.toLowerCase()}`);
        const originalText = button.textContent;
        
        try {
            button.textContent = 'Processing...';
            button.disabled = true;
            
            const response = await fetch(VENEX_CONFIG.api.trade, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': VENEX_CONFIG.csrfToken
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(`Trade ${side} executed successfully!`, 'success');
                // Refresh dashboard data
                setTimeout(() => this.refreshDashboardData(), 1000);
            } else {
                throw new Error(result.error || 'Trade execution failed');
            }
        } catch (error) {
            this.showToast(`Trade failed: ${error.message}`, 'error');
            console.error('Trade error:', error);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    startPriceUpdates() {
        // Update prices every 10 seconds
        this.priceUpdateInterval = setInterval(() => {
            this.updateCurrentPrices();
        }, 10000);
    }

    async updateCurrentPrices() {
        try {
            const response = await fetch(VENEX_CONFIG.api.dashboard);
            const data = await response.json();
            
            if (data.crypto_balances) {
                this.updatePriceDisplays(data.crypto_balances);
            }
        } catch (error) {
            console.error('Error updating prices:', error);
        }
    }

    updatePriceDisplays(cryptoBalances) {
        for (const [symbol, data] of Object.entries(cryptoBalances)) {
            const priceElement = document.getElementById(`price-${symbol}`);
            const changeElement = document.getElementById(`change-${symbol}`);
            const cardElement = document.getElementById(`crypto-card-${symbol}`);
            
            if (priceElement && data.current_price !== undefined) {
                priceElement.textContent = data.current_price.toFixed(2);
                // Update trade data attribute if this is the current trade symbol
                if (symbol === this.currentTradeSymbol) {
                    this.currentTradePrice = data.current_price;
                    this.updateTradePriceDisplay();
                }
            }
            
            if (changeElement && data.change_percentage_24h !== undefined) {
                const isPositive = data.change_percentage_24h >= 0;
                changeElement.textContent = `${isPositive ? '+' : ''}${data.change_percentage_24h.toFixed(2)}%`;
                changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            }
            
            if (cardElement && data.change_percentage_24h !== undefined && data.change_percentage_24h !== 0) {
                // Add visual feedback for price changes
                cardElement.style.animation = 'none';
                setTimeout(() => {
                    cardElement.style.animation = 'pulse 0.5s ease-in-out';
                }, 10);
            }
        }
    }

    async refreshDashboardData() {
        try {
            const response = await fetch(VENEX_CONFIG.api.dashboard);
            const data = await response.json();
            
            if (data) {
                this.updateDashboardUI(data);
            }
        } catch (error) {
            console.error('Error refreshing dashboard data:', error);
        }
    }

    updateDashboardUI(data) {
        // Update total balance if available
        if (data.total_balance !== undefined) {
            const balanceElement = document.querySelector('.balance-amount');
            if (balanceElement) {
                balanceElement.textContent = `$${data.total_balance.toLocaleString()}`;
            }
        }

        // Update crypto balances
        if (data.crypto_balances) {
            this.updatePriceDisplays(data.crypto_balances);
        }
    }

    loadInitialData() {
        this.updateCurrentPrices();
    }

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
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.cssText = `
            padding: 12px 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-left: 4px solid ${this.getToastColor(type)};
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span style="font-size: 1.2em;">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }

    getToastColor(type) {
        const colors = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#667eea'
        };
        return colors[type] || '#667eea';
    }

    getToastIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || '💡';
    }

    destroy() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
    }
}

// Add CSS animations for toasts
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
`;
document.head.appendChild(style);