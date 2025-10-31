// buySocket.js
// Real-time WebSocket integration for Buy Crypto page

const BUY_WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'wss://') + window.location.host + '/wss/market/';
let buySocket = null;
let marketData = {};

function connectBuySocket() {
    buySocket = new WebSocket(BUY_WS_URL);

    buySocket.onopen = function() {
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
