/**
 * Venex Broker - Market Page JavaScript
 * Handles real-time market data updates via WebSocket and API calls
 */

class MarketPage {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.apiRefreshInterval = 60000; // 60 seconds
        this.cryptoData = new Map();
        this.isConnected = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadInitialData();
        this.connectWebSocket();
        this.startApiRefresh();
    }

    bindEvents() {
        // View toggle buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleView(e.target));
        });

        // Theme change handler
        if (window.themeManager) {
            window.themeManager.onThemeChange(() => this.handleThemeChange());
        }
    }

    /**
     * Load initial market data from Django context or API
     */
    async loadInitialData() {
        try {
            // Check if we have initial data from Django context
            if (typeof window.marketData !== 'undefined') {
                this.processMarketData(window.marketData);
            } else {
                // Fallback to API call
                await this.fetchMarketData();
            }
            
            this.hideLoading();
        } catch (error) {
            console.error('Error loading initial market data:', error);
            this.showError('Failed to load market data');
        }
    }

    /**
     * Fetch market data from API endpoint
     */
    async fetchMarketData() {
        try {
            const response = await fetch('/api/market/data/');
            if (!response.ok) throw new Error('API response not ok');
            
            const data = await response.json();
            this.processMarketData(data);
        } catch (error) {
            console.error('Error fetching market data:', error);
            throw error;
        }
    }

    /**
     * Process market data from API response
     */
    processMarketData(data) {
        if (data.market_stats) {
            this.updateMarketStats(data.market_stats);
        }
        
        if (data.cryptocurrencies) {
            this.updateCryptoData(data.cryptocurrencies);
            this.updatePerformanceLists(data.cryptocurrencies);
        }
        
        this.updateLastUpdated();
    }

    /**
     * Update market overview statistics
     */
    updateMarketStats(stats) {
        const formatter = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

        // Global Market Cap
        const marketCapElement = document.getElementById('globalMarketCap');
        if (marketCapElement && stats.total_market_cap) {
            marketCapElement.textContent = `$${(stats.total_market_cap / 1e12).toFixed(2)}T`;
        }

        // 24h Volume
        const volumeElement = document.getElementById('totalVolume');
        if (volumeElement && stats.total_volume_24h) {
            volumeElement.textContent = `$${(stats.total_volume_24h / 1e9).toFixed(1)}B`;
        }

        // BTC Dominance
        const dominanceElement = document.getElementById('btcDominance');
        if (dominanceElement && stats.btc_dominance) {
            dominanceElement.textContent = `${stats.btc_dominance.toFixed(2)}%`;
        }

        // Active Cryptocurrencies
        const activeElement = document.getElementById('activeCryptos');
        if (activeElement && stats.active_cryptocurrencies) {
            activeElement.textContent = stats.active_cryptocurrencies.toLocaleString();
        }
    }

    /**
     * Update cryptocurrency data and UI
     */
    updateCryptoData(cryptos) {
        // Store crypto data for WebSocket updates
        cryptos.forEach(crypto => {
            this.cryptoData.set(crypto.symbol, crypto);
        });

        // Update table view
        this.updateTableView(cryptos);
        
        // Update cards view
        this.updateCardsView(cryptos);
    }

    /**
     * Update table view with crypto data
     */
    updateTableView(cryptos) {
        const tableBody = document.getElementById('cryptoTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = cryptos.map(crypto => this.createTableRow(crypto)).join('');
    }

    /**
     * Create table row HTML for a cryptocurrency
     */
    createTableRow(crypto) {
        const changeClass = this.getChangeClass(crypto.price_change_percentage_24h);
        const changeValue = parseFloat(crypto.price_change_percentage_24h || 0);
        const changeDisplay = changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`;

        return `
            <tr data-symbol="${crypto.symbol}" id="row-${crypto.symbol}">
                <td class="rank-col">${crypto.rank || '-'}</td>
                <td class="name-col">
                    <div class="crypto-name-cell">
                        <div class="crypto-icon">${crypto.symbol.substring(0, 3)}</div>
                        <div class="crypto-info">
                            <div class="crypto-symbol">${crypto.symbol}</div>
                            <div class="crypto-fullname">${crypto.name}</div>
                        </div>
                    </div>
                </td>
                <td class="price-col">
                    <div class="price-value" id="price-${crypto.symbol}">
                        $${parseFloat(crypto.current_price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                </td>
                <td class="change-col">
                    <div class="${changeClass}" id="change-${crypto.symbol}">
                        ${changeDisplay}
                    </div>
                </td>
                <td class="market-cap-col">
                    <div id="cap-${crypto.symbol}">
                        $${(parseFloat(crypto.market_cap) / 1e9).toFixed(1)}B
                    </div>
                </td>
                <td class="volume-col">
                    <div id="volume-${crypto.symbol}">
                        $${(parseFloat(crypto.volume_24h) / 1e9).toFixed(1)}B
                    </div>
                </td>
                <td class="chart-col">
                    <div class="chart-sparkline" id="chart-${crypto.symbol}">
                        <!-- Sparkline chart would be rendered here -->
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Update cards view with crypto data
     */
    updateCardsView(cryptos) {
        const cardsGrid = document.getElementById('cryptoCardsGrid');
        if (!cardsGrid) return;

        cardsGrid.innerHTML = cryptos.map(crypto => this.createCard(crypto)).join('');
    }

    /**
     * Create card HTML for a cryptocurrency
     */
    createCard(crypto) {
        const changeClass = this.getChangeClass(crypto.price_change_percentage_24h);
        const changeValue = parseFloat(crypto.price_change_percentage_24h || 0);
        const changeDisplay = changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`;

        return `
            <div class="crypto-card" data-symbol="${crypto.symbol}" id="card-${crypto.symbol}">
                <div class="card-header">
                    <div class="crypto-name-cell">
                        <div class="crypto-icon">${crypto.symbol.substring(0, 3)}</div>
                        <div class="crypto-info">
                            <div class="crypto-symbol">${crypto.symbol}</div>
                            <div class="crypto-fullname">${crypto.name}</div>
                        </div>
                    </div>
                    <div class="card-rank">#${crypto.rank || '-'}</div>
                </div>
                <div class="card-body">
                    <div class="card-metric">
                        <div class="metric-label">Price</div>
                        <div class="metric-value price-value" id="card-price-${crypto.symbol}">
                            $${parseFloat(crypto.current_price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                    </div>
                    <div class="card-metric">
                        <div class="metric-label">24h Change</div>
                        <div class="metric-value ${changeClass}" id="card-change-${crypto.symbol}">
                            ${changeDisplay}
                        </div>
                    </div>
                    <div class="card-metric">
                        <div class="metric-label">Market Cap</div>
                        <div class="metric-value" id="card-cap-${crypto.symbol}">
                            $${(parseFloat(crypto.market_cap) / 1e9).toFixed(1)}B
                        </div>
                    </div>
                    <div class="card-metric">
                        <div class="metric-label">Volume (24h)</div>
                        <div class="metric-value" id="card-volume-${crypto.symbol}">
                            $${(parseFloat(crypto.volume_24h) / 1e9).toFixed(1)}B
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Update top gainers and losers lists
     */
    updatePerformanceLists(cryptos) {
        // Sort by 24h change percentage
        const sorted = [...cryptos].sort((a, b) => 
            parseFloat(b.price_change_percentage_24h) - parseFloat(a.price_change_percentage_24h)
        );

        const gainers = sorted.slice(0, 5);
        const losers = sorted.slice(-5).reverse();

        this.updatePerformanceList('topGainers', gainers);
        this.updatePerformanceList('topLosers', losers);
    }

    /**
     * Update a performance list (gainers or losers)
     */
    updatePerformanceList(elementId, cryptos) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.innerHTML = cryptos.map(crypto => this.createPerformanceItem(crypto)).join('');
    }

    /**
     * Create performance list item
     */
    createPerformanceItem(crypto) {
        const changeClass = this.getChangeClass(crypto.price_change_percentage_24h);
        const changeValue = parseFloat(crypto.price_change_percentage_24h || 0);
        const changeDisplay = changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`;

        return `
            <div class="performance-item" data-symbol="${crypto.symbol}">
                <div class="perf-symbol">${crypto.symbol}</div>
                <div class="perf-price">
                    $${parseFloat(crypto.current_price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
                <div class="perf-change ${changeClass}">
                    ${changeDisplay}
                </div>
            </div>
        `;
    }

    /**
     * Connect to WebSocket for real-time updates
     */
    connectWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/market/`;
            
            this.ws = new WebSocket(wsUrl);
            this.updateConnectionStatus('connecting');

            this.ws.onopen = () => {
                console.log('WebSocket connected to market data');
                this.updateConnectionStatus('connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket disconnected:', event);
                this.updateConnectionStatus('disconnected');
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };

        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.updateConnectionStatus('error');
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'price_update':
                    this.handlePriceUpdate(data);
                    break;
                case 'market_data':
                    this.handleMarketDataUpdate(data);
                    break;
                case 'historical_data':
                    this.handleHistoricalData(data);
                    break;
                default:
                    console.log('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    /**
     * Handle real-time price updates
     */
    handlePriceUpdate(update) {
        const { symbol, data } = update;
        
        // Update price in table view
        const priceElement = document.getElementById(`price-${symbol}`);
        if (priceElement) {
            const oldPrice = this.extractPrice(priceElement.textContent);
            const newPrice = parseFloat(data.price);
            
            this.animatePriceUpdate(priceElement, oldPrice, newPrice);
            priceElement.textContent = `$${newPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        // Update price in card view
        const cardPriceElement = document.getElementById(`card-price-${symbol}`);
        if (cardPriceElement) {
            cardPriceElement.textContent = `$${parseFloat(data.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        // Update change percentage
        const changeElement = document.getElementById(`change-${symbol}`);
        const cardChangeElement = document.getElementById(`card-change-${symbol}`);
        const changeValue = parseFloat(data.change_percentage_24h || 0);
        const changeDisplay = changeValue >= 0 ? `+${changeValue.toFixed(2)}%` : `${changeValue.toFixed(2)}%`;
        const changeClass = this.getChangeClass(changeValue);

        if (changeElement) {
            changeElement.textContent = changeDisplay;
            changeElement.className = changeClass;
        }

        if (cardChangeElement) {
            cardChangeElement.textContent = changeDisplay;
            cardChangeElement.className = `metric-value ${changeClass}`;
        }

        // Update last updated timestamp
        this.updateLastUpdated();
    }

    /**
     * Handle market data updates
     */
    handleMarketDataUpdate(data) {
        if (data.data) {
            this.processMarketData(data.data);
        }
    }

    /**
     * Handle historical data
     */
    handleHistoricalData(data) {
        // Could be used for sparkline charts
        console.log('Historical data received:', data);
    }

    /**
     * Animate price updates with color feedback
     */
    animatePriceUpdate(element, oldPrice, newPrice) {
        if (oldPrice && newPrice) {
            const animationClass = newPrice > oldPrice ? 'price-update-increase' : 'price-update-decrease';
            element.classList.add(animationClass);
            setTimeout(() => element.classList.remove(animationClass), 1000);
        }
    }

    /**
     * Extract price from formatted string
     */
    extractPrice(priceString) {
        const match = priceString.replace(/[$,]/g, '').match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : null;
    }

    /**
     * Get CSS class for price change
     */
    getChangeClass(changeValue) {
        const value = parseFloat(changeValue || 0);
        if (value > 0) return 'change-positive';
        if (value < 0) return 'change-negative';
        return 'change-neutral';
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        if (!statusElement) return;

        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');

        indicator.className = 'status-indicator ' + status;
        
        switch (status) {
            case 'connected':
                text.textContent = 'Live market data connected';
                break;
            case 'connecting':
                text.textContent = 'Connecting to market data...';
                break;
            case 'disconnected':
                text.textContent = 'Market data disconnected';
                break;
            case 'error':
                text.textContent = 'Connection error';
                break;
        }

        this.isConnected = status === 'connected';
    }

    /**
     * Attempt to reconnect WebSocket
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connectWebSocket();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.log('Max reconnection attempts reached');
        }
    }

    /**
     * Start periodic API refresh as fallback
     */
    startApiRefresh() {
        setInterval(() => {
            if (!this.isConnected) {
                this.fetchMarketData().catch(error => {
                    console.error('API refresh failed:', error);
                });
            }
        }, this.apiRefreshInterval);
    }

    /**
     * Toggle between table and card views
     */
    toggleView(button) {
        const view = button.dataset.view;
        
        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Show/hide views
        document.getElementById('tableView').classList.toggle('active', view === 'table');
        document.getElementById('cardsView').classList.toggle('active', view === 'cards');
    }

    /**
     * Handle theme changes
     */
    handleThemeChange() {
        // Re-render charts or update colors if needed
        console.log('Theme changed, updating market display...');
    }

    /**
     * Update last updated timestamp
     */
    updateLastUpdated() {
        const timeElement = document.getElementById('updateTime');
        if (timeElement) {
            timeElement.textContent = new Date().toLocaleTimeString();
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
        }
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingElement = document.getElementById('loadingState');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // You could implement a toast or notification system here
        console.error('Market error:', message);
    }

    /**
     * Cleanup on page unload
     */
    destroy() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Initialize market page when DOM is loaded

document.addEventListener('DOMContentLoaded', () => {
    window.marketPage = new MarketPage();

    // If initial market data is available from backend, use it
    if (window.marketData) {
        window.marketPage.processMarketData(window.marketData);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.marketPage) {
        window.marketPage.destroy();
    }
});