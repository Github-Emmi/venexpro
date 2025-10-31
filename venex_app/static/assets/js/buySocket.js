// buySocket.js
// Real-time WebSocket integration for Buy Crypto page

// Dynamic WebSocket URL based on current hostname (works on any domain)
const BUY_WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const BUY_WS_URL = `${BUY_WS_PROTOCOL}//${window.location.host}/ws/market/`;

let buySocket = null;
let marketData = {};

function connectBuySocket() {
    console.log('Connecting to WebSocket:', BUY_WS_URL);
    buySocket = new WebSocket(BUY_WS_URL);

    buySocket.onopen = function() {
        console.log('✅ Buy page WebSocket connected');
        // Subscribe to initial chart data for all cryptos
        sendMarketSubscribe();
    };

    buySocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'market_data') {
            marketData = data.data.cryptocurrencies;
            updateCryptoCards(marketData);
        } else if (data.type === 'price_update') {
            updateCryptoPrice(data.data);
        } else if (data.type === 'chart_data') {
            // Optionally handle chart data for selected crypto
        }
    };

    buySocket.onclose = function() {
        setTimeout(connectBuySocket, 3000); // Reconnect on disconnect
    };
}

function sendMarketSubscribe() {
    if (buySocket && buySocket.readyState === WebSocket.OPEN) {
        buySocket.send(JSON.stringify({ type: 'subscribe_chart', symbol: 'BTC', timeframe: '1d' }));
        // You can loop through all supported cryptos if needed
    }
}

function updateCryptoCards(cryptos) {
    // This function will be called by buy.js to update UI
    window.cryptoMarketData = cryptos;
    if (typeof window.renderCryptoCards === 'function') {
        window.renderCryptoCards(cryptos);
    }
}

function updateCryptoPrice(priceData) {
    // Optionally update price for a specific crypto card
    if (typeof window.updateCryptoCardPrice === 'function') {
        window.updateCryptoCardPrice(priceData);
    }
}

// Initialize connection
connectBuySocket();
