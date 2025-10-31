// Portfolio WebSocket Handler
class PortfolioWebSocket {
    constructor() {
        this.connectionStatus = document.createElement('div');
        this.connectionStatus.className = 'connection-status';
        document.body.appendChild(this.connectionStatus);

        this.connect();
    }

    connect() {
        this.socket = new WebSocket(
            `${window.location.protocol === 'https:' ? 'wss:' : 'wss:'}//${window.location.host}/wss/portfolio/`
        );

        this.socket.onopen = () => {
            this.updateConnectionStatus('connected');
            console.log('WebSocket connection established');
        };

        this.socket.onclose = (e) => {
            this.updateConnectionStatus('disconnected');
            console.log('WebSocket connection closed');
            setTimeout(() => this.connect(), 5000); // Reconnect after 5 seconds
        };

        this.socket.onerror = (error) => {
            this.updateConnectionStatus('error');
            console.error('WebSocket error:', error);
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
    }

    updateConnectionStatus(status) {
        this.connectionStatus.className = `connection-status ${status}`;
        switch (status) {
            case 'connected':
                this.connectionStatus.textContent = '🟢 Live Updates';
                break;
            case 'disconnected':
                this.connectionStatus.textContent = '⚫ Disconnected';
                break;
            case 'error':
                this.connectionStatus.textContent = '🔴 Connection Error';
                break;
        }

        // Hide status after 3 seconds if connected
        if (status === 'connected') {
            setTimeout(() => {
                this.connectionStatus.style.opacity = '0';
            }, 3000);
        } else {
            this.connectionStatus.style.opacity = '1';
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'price_update':
                this.updatePrices(data.data);
                break;
            case 'portfolio_update':
                this.updatePortfolio(data.data);
                break;
            case 'market_update':
                this.updateMarketData(data.data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    updatePrices(priceData) {
        // Update current prices in holdings table
        Object.entries(priceData).forEach(([symbol, data]) => {
            const row = document.querySelector(`tr[data-symbol="${symbol}"]`);
            if (row) {
                const priceCell = row.querySelector('.current-price');
                const changeCell = row.querySelector('.price-change');

                if (priceCell) {
                    priceCell.textContent = `$${data.price.toFixed(2)}`;
                }

                if (changeCell) {
                    const changePercent = data.change_24h;
                    changeCell.textContent = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                    changeCell.className = `price-change ${changePercent >= 0 ? 'positive' : 'negative'}`;
                }
            }
        });

        // Trigger portfolio value recalculation
        if (window.portfolioManager) {
            window.portfolioManager.recalculatePortfolioValue();
        }
    }

    updatePortfolio(portfolioData) {
        if (window.portfolioManager) {
            window.portfolioManager.updatePortfolioOverview(portfolioData);
            window.portfolioManager.updateHoldingsTable(portfolioData.holdings);
            window.portfolioManager.updateCharts(portfolioData);
        }
    }

    updateMarketData(marketData) {
        // Update market statistics if they exist in the UI
        const marketStatsElements = {
            totalMarketCap: document.getElementById('total-market-cap'),
            volume24h: document.getElementById('volume-24h'),
            btcDominance: document.getElementById('btc-dominance')
        };

        if (marketStatsElements.totalMarketCap) {
            marketStatsElements.totalMarketCap.textContent =
                new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1
                }).format(marketData.total_market_cap);
        }

        if (marketStatsElements.volume24h) {
            marketStatsElements.volume24h.textContent =
                new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1
                }).format(marketData.total_volume_24h);
        }

        if (marketStatsElements.btcDominance) {
            marketStatsElements.btcDominance.textContent =
                `${marketData.btc_dominance.toFixed(1)}%`;
        }
    }

    send(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket is not connected. Message not sent:', message);
        }
    }

    subscribe(symbols) {
        this.send({
            action: 'subscribe',
            symbols: symbols
        });
    }

    unsubscribe(symbols) {
        this.send({
            action: 'unsubscribe',
            symbols: symbols
        });
    }
}

// Initialize WebSocket handler when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioSocket = new PortfolioWebSocket();
});