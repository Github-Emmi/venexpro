// VENEX WebSocket Manager for Real-Time Data
class VenexWebSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.subscribedSymbol = 'BTC';
        
        this.connect();
    }
    
    connect() {
        try {
            this.socket = new WebSocket(VENEX_CONFIG.api.wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected to VENEX price feed');
                this.reconnectAttempts = 0;
                this.subscribeToSymbol(this.subscribedSymbol);
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.handleReconnection();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'price_update':
                this.updatePriceDisplay(data.symbol, data.data);
                break;
            case 'historical_data':
                if (window.venexCharts) {
                    window.venexCharts.updateChartWithHistoricalData(data.symbol, data.data);
                }
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }
    
    updatePriceDisplay(symbol, data) {
        // Update price in crypto grid
        const priceElement = document.getElementById(`price-${symbol}`);
        const changeElement = document.getElementById(`change-${symbol}`);
        const cardElement = document.getElementById(`crypto-card-${symbol}`);
        
        if (priceElement) {
            priceElement.textContent = data.price.toFixed(2);
        }
        
        if (changeElement) {
            const isPositive = data.change_percentage_24h >= 0;
            changeElement.textContent = `${isPositive ? '+' : ''}${data.change_percentage_24h.toFixed(2)}%`;
            changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
        }
        
        // Add visual feedback for price update
        if (cardElement) {
            cardElement.style.transition = 'none';
            cardElement.style.backgroundColor = isPositive ? 
                'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            
            setTimeout(() => {
                cardElement.style.transition = 'background-color 0.5s ease';
                cardElement.style.backgroundColor = '';
            }, 500);
        }
        
        // Update trade form if this is the selected crypto
        const tradeSelect = document.getElementById('trade-crypto-select');
        if (tradeSelect && tradeSelect.value === symbol) {
            const option = tradeSelect.querySelector(`option[value="${symbol}"]`);
            if (option) {
                option.setAttribute('data-price', data.price);
            }
            // Trigger update of trade total
            const event = new Event('change');
            tradeSelect.dispatchEvent(event);
        }
    }
    
    subscribeToSymbol(symbol) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'subscribe',
                symbol: symbol
            }));
            this.subscribedSymbol = symbol;
        }
    }
    
    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached. Falling back to API polling.');
            this.startAPIPolling();
        }
    }
    
    startAPIPolling() {
        // Fallback to API polling if WebSocket fails
        setInterval(() => {
            this.fetchPricesViaAPI();
        }, 15000); // Poll every 15 seconds
    }
    
    async fetchPricesViaAPI() {
        try {
            const response = await fetch('/api/v1/prices/multiple/?symbols=BTC,ETH,USDT,LTC,TRX');
            const data = await response.json();
            
            if (data.success) {
                for (const [symbol, priceData] of Object.entries(data.prices)) {
                    this.updatePriceDisplay(symbol, priceData);
                }
            }
        } catch (error) {
            console.error('API polling failed:', error);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}