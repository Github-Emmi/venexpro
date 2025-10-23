// VENEX WebSocket Manager for Real-Time Data (venex-websocket.js)
class VenexWebSocket {
    constructor(userId = null) {
        this.socket = null;
        this.userId = userId;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isAuthenticated = !!userId;
        
        // Determine WebSocket URL based on authentication
        if (this.isAuthenticated) {
            this.wsUrl = `ws://${window.location.host}/ws/dashboard/`;
        } else {
            this.wsUrl = `ws://${window.location.host}/ws/market/`;
        }
        
        this.connect();
    }
    
    connect() {
        try {
            console.log(`Connecting to WebSocket: ${this.wsUrl}`);
            this.socket = new WebSocket(this.wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected successfully');
                this.reconnectAttempts = 0;
                
                if (this.isAuthenticated) {
                    console.log('Authenticated WebSocket session established');
                } else {
                    console.log('Public market WebSocket session established');
                }
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.socket.onclose = (event) => {
                console.log(`WebSocket disconnected: ${event.code} - ${event.reason}`);
                this.handleReconnection();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnection();
        }
    }
    
    handleMessage(data) {
        console.log('WebSocket message received:', data);
        
        switch (data.type) {
            case 'dashboard_snapshot':
            case 'dashboard_update':
                this.handleDashboardUpdate(data);
                break;
                
            case 'market_snapshot':
            case 'market_update':
                this.handleMarketUpdate(data);
                break;
                
            case 'trade_update':
                this.handleTradeUpdate(data);
                break;
                
            case 'portfolio_update':
                this.handlePortfolioUpdate(data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    handleDashboardUpdate(data) {
        // Update dashboard with real-time data
        if (data.data && data.data.portfolio_summary) {
            this.updateDashboardSummary(data.data.portfolio_summary);
        }
        if (data.data && data.data.portfolio_breakdown) {
            this.updatePortfolioBreakdown(data.data.portfolio_breakdown);
        }
        if (data.payload && data.payload.portfolio) {
            this.updateDashboardSummary(data.payload.portfolio);
        }
    }
    
    handleMarketUpdate(data) {
        // Update market data displays
        if (data.data && Array.isArray(data.data)) {
            this.updateMarketGrid(data.data);
        }
        if (data.payload && data.payload.cryptos) {
            this.updateMarketGrid(data.payload.cryptos);
        }
    }
    
    handleTradeUpdate(data) {
        // Show trade notifications
        if (data.payload && data.payload.trade) {
            this.showTradeNotification(data.payload.trade);
        }
    }
    
    handlePortfolioUpdate(data) {
        // Update portfolio displays
        if (data.payload) {
            this.updatePortfolioDisplay(data.payload);
        }
    }
    
    updateDashboardSummary(summary) {
        // Update DOM elements with portfolio summary
        const elements = {
            totalValue: document.getElementById('total-portfolio-value'),
            totalInvested: document.getElementById('total-invested'),
            totalProfitLoss: document.getElementById('total-profit-loss'),
            profitLossPercentage: document.getElementById('profit-loss-percentage')
        };
        
        if (elements.totalValue && summary.total_value) {
            elements.totalValue.textContent = `$${summary.total_value.toLocaleString()}`;
        }
        if (elements.totalInvested && summary.total_invested) {
            elements.totalInvested.textContent = `$${summary.total_invested.toLocaleString()}`;
        }
        if (elements.totalProfitLoss && summary.total_profit_loss) {
            const isPositive = summary.total_profit_loss >= 0;
            elements.totalProfitLoss.textContent = `${isPositive ? '+' : ''}$${Math.abs(summary.total_profit_loss).toLocaleString()}`;
            elements.totalProfitLoss.className = `profit-loss ${isPositive ? 'positive' : 'negative'}`;
        }
        if (elements.profitLossPercentage && summary.profit_loss_percentage) {
            const isPositive = summary.profit_loss_percentage >= 0;
            elements.profitLossPercentage.textContent = `${isPositive ? '+' : ''}${summary.profit_loss_percentage.toFixed(2)}%`;
            elements.profitLossPercentage.className = `profit-loss ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    updateMarketGrid(cryptos) {
        // Update each cryptocurrency card in the market grid
        cryptos.forEach(crypto => {
            const priceElement = document.getElementById(`price-${crypto.symbol}`);
            const changeElement = document.getElementById(`change-${crypto.symbol}`);
            const cardElement = document.getElementById(`crypto-card-${crypto.symbol}`);
            
            if (priceElement) {
                priceElement.textContent = `$${crypto.price.toFixed(2)}`;
            }
            
            if (changeElement) {
                const isPositive = crypto.change_percentage_24h >= 0;
                changeElement.textContent = `${isPositive ? '+' : ''}${crypto.change_percentage_24h.toFixed(2)}%`;
                changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            }
            
            // Visual feedback for price updates
            if (cardElement) {
                cardElement.classList.add('price-update-flash');
                setTimeout(() => {
                    cardElement.classList.remove('price-update-flash');
                }, 1000);
            }
        });
    }
    
    showTradeNotification(trade) {
        // Create toast notification for trades
        const notification = document.createElement('div');
        notification.className = 'trade-notification';
        notification.innerHTML = `
            <strong>Trade Executed</strong>
            <div>${trade.type} ${trade.quantity} ${trade.symbol} @ $${trade.price_per_unit}</div>
            <small>${new Date().toLocaleTimeString()}</small>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached. Please refresh the page.');
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Utility functions for VENEX platform
class VenexUtils {
    // Format currency with proper localization
    static formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 8
        }).format(amount);
    }

    // Format cryptocurrency amount
    static formatCrypto(amount, decimals = 8) {
        return parseFloat(amount).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    }

    // Calculate percentage change
    static calculateChange(oldValue, newValue) {
        if (oldValue === 0) return 0;
        return ((newValue - oldValue) / oldValue) * 100;
    }

    // Debounce function for performance
    static debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    // Validate email format
    static validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Generate random color for charts
    static generateColor() {
        return '#' + Math.floor(Math.random()*16777215).toString(16);
    }

    // Copy text to clipboard
    static copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (error) {
                    reject(error);
                }
                document.body.removeChild(textArea);
            }
        });
    }

    // Format date relative to now
    static timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + ' years ago';
        
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + ' months ago';
        
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + ' days ago';
        
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + ' hours ago';
        
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + ' minutes ago';
        
        return Math.floor(seconds) + ' seconds ago';
    }

    // Safe number parsing
    static safeParseFloat(value, defaultValue = 0) {
        if (value === null || value === undefined) return defaultValue;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    // Generate UUID (for mock data)
    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

// Export for global usage
window.VenexUtils = VenexUtils;

// Initialize WebSocket based on page context
document.addEventListener('DOMContentLoaded', function() {
    // Get user ID from Django template context
    const userId = document.body.getAttribute('data-user-id') || 
                   (window.VENEX_CONFIG && VENEX_CONFIG.userId) || 
                   null;
    
    // Only initialize WebSocket if we're on a page that needs it
    const needsWebSocket = document.querySelector('[data-websocket="true"]');
    if (needsWebSocket) {
        window.venexWebSocket = new VenexWebSocket(userId);
    }
});