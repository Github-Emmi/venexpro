// static/js/market.js - Market Page Functionality
class VenexMarket {
    constructor() {
        this.currentChart = null;
        this.currentSymbol = 'BTC';
        this.currentTimeframe = '1d';
        this.socket = null;
        this.isConnected = false;
        this.cryptoData = [];
        this.priceUpdateInterval = null;
        this.init();
    }

    init() {
        console.log('VENEX Market Initialized');
        this.setupEventListeners();
        this.initializeChart();
        this.connectWebSocket();
        this.startPriceUpdates();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('crypto-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCryptocurrencies(e.target.value);
            });
        }

        // Chart cryptocurrency selector
        const chartSelect = document.getElementById('chart-crypto-select');
        if (chartSelect) {
            chartSelect.addEventListener('change', (e) => {
                this.currentSymbol = e.target.value;
                this.loadChartData(this.currentSymbol, this.currentTimeframe);
            });
        }

        // Timeframe buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTimeframe = e.target.getAttribute('data-timeframe');
                this.loadChartData(this.currentSymbol, this.currentTimeframe);
            });
        });

        // Crypto table row clicks
        document.addEventListener('click', (e) => {
            const row = e.target.closest('.crypto-row');
            if (row) {
                const symbol = row.getAttribute('data-symbol');
                this.selectCryptocurrency(symbol);
            }

            const gainerItem = e.target.closest('.gainer-item');
            if (gainerItem) {
                const symbol = gainerItem.getAttribute('data-symbol');
                this.selectCryptocurrency(symbol);
            }

            const loserItem = e.target.closest('.loser-item');
            if (loserItem) {
                const symbol = loserItem.getAttribute('data-symbol');
                this.selectCryptocurrency(symbol);
            }
        });

        // Window resize handling
        window.addEventListener('resize', () => {
            if (this.currentChart) {
                this.currentChart.resize();
            }
        });
    }

    initializeChart() {
        const ctx = document.getElementById('marketChart');
        if (!ctx) return;

        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: this.createGradient(ctx),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: this.getChartOptions()
        });
    }

    createGradient(ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
        gradient.addColorStop(1, 'rgba(102, 126, 234, 0.05)');
        return gradient;
    }

    getChartOptions() {
        return {
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
                            return `Price: $${context.parsed.y.toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                            })}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8,
                        callback: function(value, index, values) {
                            // Format labels based on data density
                            if (this.chart.data.labels.length > 30) {
                                return new Date(this.getLabelForValue(value)).toLocaleDateString();
                            } else {
                                return new Date(this.getLabelForValue(value)).toLocaleTimeString();
                            }
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000) {
                                return '$' + (value / 1000).toFixed(1) + 'K';
                            }
                            return '$' + value.toLocaleString();
                        }
                    },
                    position: 'right'
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        };
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/market/`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('Market WebSocket connected');
            this.isConnected = true;
            this.showConnectionStatus('connected');
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Market WebSocket disconnected');
            this.isConnected = false;
            this.showConnectionStatus('disconnected');
            
            // Attempt to reconnect after 5 seconds
            setTimeout(() => {
                this.connectWebSocket();
            }, 5000);
        };
        
        this.socket.onerror = (error) => {
            console.error('Market WebSocket error:', error);
            this.showConnectionStatus('error');
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'market_data':
                this.updateMarketData(data.data);
                break;
            case 'price_update':
                this.updatePrice(data.data);
                break;
            case 'chart_data':
                this.updateChartWithData(data);
                break;
            case 'error':
                this.showToast(data.message, 'error');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    updateMarketData(marketData) {
        if (marketData.cryptocurrencies) {
            this.cryptoData = marketData.cryptocurrencies;
            this.updateCryptoTable(this.cryptoData);
            this.updateGainersLosers(this.cryptoData);
        }
        
        if (marketData.market_stats) {
            this.updateMarketStats(marketData.market_stats);
        }
    }

    updatePrice(priceData) {
        // Update specific cryptocurrency price
        const { symbol, price, change_24h, change_percentage_24h } = priceData;
        
        // Update table row
        const row = document.querySelector(`.crypto-row[data-symbol="${symbol}"]`);
        if (row) {
            const priceCell = row.querySelector('.current-price');
            const changeCell = row.querySelector('.price-change');
            
            if (priceCell) {
                priceCell.textContent = `$${parseFloat(price).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`;
            }
            
            if (changeCell) {
                const isPositive = parseFloat(change_percentage_24h) >= 0;
                changeCell.textContent = `${isPositive ? '+' : ''}${parseFloat(change_percentage_24h).toFixed(2)}%`;
                changeCell.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            }
        }
        
        // Update gainers/losers if this coin is in them
        this.updateGainersLosers(this.cryptoData);
    }

    updateCryptoTable(cryptocurrencies) {
        const tbody = document.getElementById('crypto-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        cryptocurrencies.forEach(crypto => {
            const row = document.createElement('tr');
            row.className = 'crypto-row';
            row.setAttribute('data-symbol', crypto.symbol);
            
            const isPositive = parseFloat(crypto.price_change_percentage_24h) >= 0;
            
            row.innerHTML = `
                <td>
                    <div class="coin-info">
                        <div class="coin-logo">
                            ${crypto.symbol.slice(0, 3)}
                        </div>
                        <div class="coin-name">
                            <span class="coin-symbol">${crypto.symbol}</span>
                            <span class="coin-full-name">${crypto.name}</span>
                        </div>
                    </div>
                </td>
                <td class="price-cell">
                    <span class="current-price">$${parseFloat(crypto.current_price).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })}</span>
                </td>
                <td>
                    <span class="price-change ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${parseFloat(crypto.price_change_percentage_24h).toFixed(2)}%
                    </span>
                </td>
                <td>
                    <span class="high-low">- / -</span>
                </td>
                <td>$${parseFloat(crypto.market_cap).toLocaleString('en-US', {
                    maximumFractionDigits: 0
                })}</td>
                <td>$${parseFloat(crypto.volume_24h).toLocaleString('en-US', {
                    maximumFractionDigits: 0
                })}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    updateGainersLosers(cryptocurrencies) {
        // Get top 5 gainers
        const gainers = [...cryptocurrencies]
            .filter(crypto => parseFloat(crypto.price_change_percentage_24h) > 0)
            .sort((a, b) => parseFloat(b.price_change_percentage_24h) - parseFloat(a.price_change_percentage_24h))
            .slice(0, 5);
        
        // Get top 5 losers
        const losers = [...cryptocurrencies]
            .filter(crypto => parseFloat(crypto.price_change_percentage_24h) < 0)
            .sort((a, b) => parseFloat(a.price_change_percentage_24h) - parseFloat(b.price_change_percentage_24h))
            .slice(0, 5);
        
        this.updateGainersList(gainers);
        this.updateLosersList(losers);
    }

    updateGainersList(gainers) {
        const gainersList = document.getElementById('top-gainers-list');
        if (!gainersList) return;
        
        gainersList.innerHTML = '';
        
        gainers.forEach(gainer => {
            const item = document.createElement('div');
            item.className = 'gainer-item';
            item.setAttribute('data-symbol', gainer.symbol);
            
            item.innerHTML = `
                <div class="coin-mini-info">
                    <div class="mini-logo">${gainer.symbol.slice(0, 3)}</div>
                    <span class="coin-symbol">${gainer.symbol}</span>
                </div>
                <div class="price-info">
                    <span class="price">$${parseFloat(gainer.current_price).toFixed(2)}</span>
                    <span class="change positive">+${parseFloat(gainer.price_change_percentage_24h).toFixed(2)}%</span>
                </div>
            `;
            
            gainersList.appendChild(item);
        });
    }

    updateLosersList(losers) {
        const losersList = document.getElementById('top-losers-list');
        if (!losersList) return;
        
        losersList.innerHTML = '';
        
        losers.forEach(loser => {
            const item = document.createElement('div');
            item.className = 'loser-item';
            item.setAttribute('data-symbol', loser.symbol);
            
            item.innerHTML = `
                <div class="coin-mini-info">
                    <div class="mini-logo">${loser.symbol.slice(0, 3)}</div>
                    <span class="coin-symbol">${loser.symbol}</span>
                </div>
                <div class="price-info">
                    <span class="price">$${parseFloat(loser.current_price).toFixed(2)}</span>
                    <span class="change negative">${parseFloat(loser.price_change_percentage_24h).toFixed(2)}%</span>
                </div>
            `;
            
            losersList.appendChild(item);
        });
    }

    updateMarketStats(stats) {
        const elements = {
            'global-market-cap': stats.total_market_cap,
            'global-volume': stats.total_volume_24h,
            'btc-dominance': stats.btc_dominance + '%',
            'active-coins': stats.active_cryptocurrencies
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'btc-dominance') {
                    element.textContent = value;
                } else if (id === 'active-coins') {
                    element.textContent = value.toLocaleString();
                } else {
                    element.textContent = '$' + parseFloat(value).toLocaleString('en-US', {
                        maximumFractionDigits: 0
                    });
                }
            }
        });
    }

    filterCryptocurrencies(searchTerm) {
        const rows = document.querySelectorAll('.crypto-row');
        const term = searchTerm.toLowerCase().trim();
        
        rows.forEach(row => {
            const symbol = row.getAttribute('data-symbol').toLowerCase();
            const name = row.querySelector('.coin-full-name').textContent.toLowerCase();
            
            if (symbol.includes(term) || name.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    selectCryptocurrency(symbol) {
        this.currentSymbol = symbol;
        
        // Update chart selector
        const chartSelect = document.getElementById('chart-crypto-select');
        if (chartSelect) {
            chartSelect.value = symbol;
        }
        
        // Load chart data for selected cryptocurrency
        this.loadChartData(symbol, this.currentTimeframe);
        
        // Highlight selected row
        document.querySelectorAll('.crypto-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        const selectedRow = document.querySelector(`.crypto-row[data-symbol="${symbol}"]`);
        if (selectedRow) {
            selectedRow.classList.add('selected');
        }
    }

    async loadChartData(symbol, timeframe) {
        if (!this.currentChart) return;
        
        const loadingElement = document.getElementById('chart-loading');
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        
        try {
            // Use WebSocket to request chart data
            if (this.isConnected && this.socket) {
                this.socket.send(JSON.stringify({
                    type: 'subscribe_chart',
                    symbol: symbol,
                    timeframe: timeframe
                }));
            } else {
                // Fallback to REST API
                const response = await fetch(`/api/market/chart/${symbol}/?range=${timeframe}`);
                const data = await response.json();
                
                if (data.success) {
                    this.updateChartWithData({
                        symbol: symbol,
                        timeframe: timeframe,
                        data: data
                    });
                } else {
                    throw new Error(data.error || 'Failed to load chart data');
                }
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
            this.showToast('Failed to load chart data', 'error');
        } finally {
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
        }
    }

    updateChartWithData(chartData) {
        if (!this.currentChart || !chartData.data) return;
        
        const { prices, timestamps } = chartData.data;
        
        if (!prices || !timestamps) {
            console.warn('Invalid chart data format:', chartData);
            return;
        }
        
        // Process data for chart
        const labels = timestamps.map(ts => {
            const date = new Date(ts * 1000);
            return date.toISOString();
        });
        
        this.currentChart.data.labels = labels;
        this.currentChart.data.datasets[0].data = prices;
        this.currentChart.data.datasets[0].label = `${chartData.symbol} Price`;
        
        this.currentChart.update('none');
    }

    startPriceUpdates() {
        // Update market data every 30 seconds as fallback
        this.priceUpdateInterval = setInterval(() => {
            if (!this.isConnected) {
                this.fetchMarketData();
            }
        }, 30000);
    }

    async fetchMarketData() {
        try {
            const response = await fetch('/api/market/data/');
            const data = await response.json();
            
            if (data.cryptocurrencies) {
                this.updateMarketData(data);
            }
        } catch (error) {
            console.error('Error fetching market data:', error);
        }
    }

    showConnectionStatus(status) {
        // You can implement a connection status indicator in your UI
        const statusElement = document.getElementById('connection-status') || this.createStatusElement();
        
        const statusConfig = {
            'connected': { text: 'Live', class: 'connected' },
            'disconnected': { text: 'Disconnected', class: 'disconnected' },
            'error': { text: 'Connection Error', class: 'error' }
        };
        
        const config = statusConfig[status] || statusConfig.disconnected;
        statusElement.textContent = config.text;
        statusElement.className = `connection-status ${config.class}`;
    }

    createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.className = 'connection-status';
        statusElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
        `;
        
        document.body.appendChild(statusElement);
        return statusElement;
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
                z-index: 1000;
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
        `;

        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span style="font-size: 1.2em;">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
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

    loadInitialData() {
        // Load initial chart data
        this.loadChartData(this.currentSymbol, this.currentTimeframe);
        
        // Fetch market data if not connected via WebSocket
        if (!this.isConnected) {
            this.fetchMarketData();
        }
    }

    destroy() {
        if (this.priceUpdateInterval) {
            clearInterval(this.priceUpdateInterval);
        }
        if (this.socket) {
            this.socket.close();
        }
        if (this.currentChart) {
            this.currentChart.destroy();
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.venexMarket = new VenexMarket();
    
    // Add CSS animations for toasts and connection status
    if (!document.querySelector('#market-animations')) {
        const style = document.createElement('style');
        style.id = 'market-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .connection-status.connected {
                background: #10b981;
                color: white;
            }
            .connection-status.disconnected {
                background: #6b7280;
                color: white;
            }
            .connection-status.error {
                background: #ef4444;
                color: white;
            }
            .crypto-row.selected {
                background: #f0f9ff !important;
                border-left: 3px solid #667eea;
            }
        `;
        document.head.appendChild(style);
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VenexMarket };
}