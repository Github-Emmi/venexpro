// buySocket-fallback.js
// Adaptive real-time data integration for Buy Crypto page
// Falls back to HTTP polling if WebSocket is unavailable (PythonAnywhere free tier)

const USE_WEBSOCKET = false; // Set to false for PythonAnywhere free tier
const POLLING_INTERVAL = 5000; // 5 seconds
const API_BASE_URL = window.location.origin;

let buySocket = null;
let pollingTimer = null;
let marketData = {};
let isConnected = false;

// Initialize connection based on environment
function initBuyConnection() {
    if (USE_WEBSOCKET && window.location.protocol === 'https:') {
        tryWebSocketConnection();
    } else {
        // Use HTTP polling fallback
        console.log('Using HTTP polling for real-time data');
        startPolling();
    }
}

// Try WebSocket connection with fallback
function tryWebSocketConnection() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/market/`;

    try {
        buySocket = new WebSocket(wsUrl);

        buySocket.onopen = function() {
            console.log('WebSocket connected successfully');
            isConnected = true;
            sendMarketSubscribe();
            hideLoadingSpinner();
        };

        buySocket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'market_data') {
                marketData = data.data.cryptocurrencies;
                updateCryptoCards(marketData);
            } else if (data.type === 'price_update') {
                updateCryptoPrice(data.data);
            }
        };

        buySocket.onclose = function() {
            console.log('WebSocket disconnected, falling back to HTTP polling');
            isConnected = false;
            buySocket = null;
            // Fallback to polling
            startPolling();
        };

        buySocket.onerror = function(error) {
            console.error('WebSocket error, using HTTP polling:', error);
            isConnected = false;
            buySocket = null;
            // Fallback to polling
            startPolling();
        };

    } catch (error) {
        console.error('WebSocket creation failed, using HTTP polling:', error);
        startPolling();
    }
}

// HTTP Polling fallback
function startPolling() {
    // Stop WebSocket if running
    if (buySocket) {
        buySocket.close();
        buySocket = null;
    }

    // Clear existing timer
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }

    // Initial fetch
    fetchMarketData();

    // Set up polling
    pollingTimer = setInterval(fetchMarketData, POLLING_INTERVAL);
    console.log(`HTTP polling started (every ${POLLING_INTERVAL/1000}s)`);
}

// Fetch market data via HTTP API
async function fetchMarketData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/market/data/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.cryptocurrencies) {
            marketData = data.cryptocurrencies;
            updateCryptoCards(marketData);
            hideLoadingSpinner();
        } else {
            console.error('Invalid market data format:', data);
        }
    } catch (error) {
        console.error('Error fetching market data:', error);
        showError('Unable to load market data. Please refresh the page.');
    }
}

// WebSocket message sender
function sendMarketSubscribe() {
    if (buySocket && buySocket.readyState === WebSocket.OPEN) {
        buySocket.send(JSON.stringify({ 
            type: 'subscribe_market',
            symbols: ['BTC', 'ETH', 'USDT', 'TRX', 'LTC']
        }));
    }
}

// Update cryptocurrency cards
function updateCryptoCards(cryptos) {
    const container = document.getElementById('crypto-cards-container');
    if (!container) return;

    // Store data globally for other functions
    window.cryptoMarketData = cryptos;

    // If there's a loading spinner, hide it
    hideLoadingSpinner();

    // Clear container
    container.innerHTML = '';

    // Create cards for each cryptocurrency
    if (Array.isArray(cryptos)) {
        cryptos.forEach(crypto => {
            const card = createCryptoCard(crypto);
            container.appendChild(card);
        });
    } else {
        // Handle object format
        Object.values(cryptos).forEach(crypto => {
            const card = createCryptoCard(crypto);
            container.appendChild(card);
        });
    }

    // Call external render function if exists
    if (typeof window.renderCryptoCards === 'function') {
        window.renderCryptoCards(cryptos);
    }
}

// Create cryptocurrency card element
function createCryptoCard(crypto) {
    const card = document.createElement('div');
    card.className = 'crypto-card';
    card.id = `crypto-${crypto.symbol}`;
    
    const isPositive = parseFloat(crypto.price_change_percentage_24h || 0) >= 0;
    const changeClass = isPositive ? 'positive' : 'negative';
    const changeIcon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
    
    card.innerHTML = `
        <div class="crypto-header">
            <div class="crypto-icon">
                <img src="/static/assets/images/crypto/${crypto.symbol.toLowerCase()}.png" 
                     alt="${crypto.name}" 
                     onerror="this.src='/static/assets/images/crypto/default.png'">
            </div>
            <div class="crypto-info">
                <h3 class="crypto-name">${crypto.name}</h3>
                <span class="crypto-symbol">${crypto.symbol}</span>
            </div>
        </div>
        <div class="crypto-price">
            <span class="current-price">$${parseFloat(crypto.current_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            <span class="price-change ${changeClass}">
                <i class="fas ${changeIcon}"></i>
                ${parseFloat(crypto.price_change_percentage_24h || 0).toFixed(2)}%
            </span>
        </div>
        <div class="crypto-stats">
            <div class="stat">
                <span class="stat-label">Market Cap</span>
                <span class="stat-value">$${abbreviateNumber(crypto.market_cap || 0)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">24h Volume</span>
                <span class="stat-value">$${abbreviateNumber(crypto.total_volume || 0)}</span>
            </div>
        </div>
        <button class="btn-buy-crypto" onclick="selectCrypto('${crypto.symbol}', '${crypto.name}', ${crypto.current_price})">
            Buy ${crypto.symbol}
        </button>
    `;
    
    return card;
}

// Update individual crypto price
function updateCryptoPrice(priceData) {
    const card = document.getElementById(`crypto-${priceData.symbol}`);
    if (!card) return;

    const priceElement = card.querySelector('.current-price');
    const changeElement = card.querySelector('.price-change');

    if (priceElement) {
        priceElement.textContent = `$${parseFloat(priceData.price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    if (changeElement && priceData.change_24h !== undefined) {
        const isPositive = parseFloat(priceData.change_24h) >= 0;
        const changeIcon = isPositive ? 'fa-arrow-up' : 'fa-arrow-down';
        changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
        changeElement.innerHTML = `
            <i class="fas ${changeIcon}"></i>
            ${parseFloat(priceData.change_24h).toFixed(2)}%
        `;
    }

    // Call external update function if exists
    if (typeof window.updateCryptoCardPrice === 'function') {
        window.updateCryptoCardPrice(priceData);
    }
}

// Utility: Abbreviate large numbers
function abbreviateNumber(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Hide loading spinner
function hideLoadingSpinner() {
    const spinner = document.querySelector('.loading-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const container = document.getElementById('crypto-cards-container');
    if (container) {
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn-retry">Retry</button>
            </div>
        `;
    }
}

// Select cryptocurrency for buying
function selectCrypto(symbol, name, price) {
    // Populate buy form if it exists
    const cryptoSelect = document.getElementById('id_cryptocurrency');
    const amountInput = document.getElementById('id_fiat_amount');
    
    if (cryptoSelect) {
        cryptoSelect.value = symbol;
        // Trigger change event to update form
        cryptoSelect.dispatchEvent(new Event('change'));
    }
    
    // Scroll to form
    const form = document.querySelector('.trading-form-section');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // Store selected crypto data
    window.selectedCrypto = { symbol, name, price };
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (buySocket) {
        buySocket.close();
    }
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing buy page real-time data connection...');
    initBuyConnection();
});

// Also initialize immediately if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // Do nothing, DOMContentLoaded will fire
} else {
    // DOM already loaded
    console.log('Initializing buy page real-time data connection (immediate)...');
    initBuyConnection();
}
