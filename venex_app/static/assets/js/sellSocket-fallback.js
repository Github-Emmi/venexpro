/**
 * sellSocket-fallback.js - HTTP Polling Fallback for Sell Page
 * 
 * PythonAnywhere free tier doesn't support WebSockets
 * This script uses HTTP polling as a fallback
 */

const SELL_POLLING_INTERVAL = 8000; // 8 seconds
const SELL_API_URL = window.location.origin + '/api/market/data/';

let sellPollingTimer = null;
let sellMarketData = {};

/**
 * Initialize connection (HTTP polling only)
 */
function initializeSellSocket() {
    console.log('Initializing sell page with HTTP polling (WebSocket not available)');
    startSellPolling();
}

/**
 * Start HTTP polling
 */
function startSellPolling() {
    // Initial fetch
    fetchSellMarketData();
    
    // Set up interval
    if (sellPollingTimer) {
        clearInterval(sellPollingTimer);
    }
    
    sellPollingTimer = setInterval(fetchSellMarketData, SELL_POLLING_INTERVAL);
    console.log(`Sell page polling started (every ${SELL_POLLING_INTERVAL/1000}s)`);
}

/**
 * Fetch market data via HTTP
 */
async function fetchSellMarketData() {
    try {
        const response = await fetch(SELL_API_URL, {
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
            sellMarketData = data.cryptocurrencies;
            
            // Update market data
            updateMarketData({ cryptocurrencies: sellMarketData });
            
            // Update selected cryptocurrency price if one is selected
            const selectedSymbol = document.getElementById('id_cryptocurrency')?.value;
            if (selectedSymbol) {
                const selectedCrypto = sellMarketData.find(c => c.symbol === selectedSymbol);
                if (selectedCrypto) {
                    updateSelectedCryptoPrice(selectedCrypto);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching sell market data:', error);
    }
}

/**
 * Update market data on the page
 */
function updateMarketData(data) {
    if (!data || !data.cryptocurrencies) return;

    const cryptos = Array.isArray(data.cryptocurrencies) ? data.cryptocurrencies : Object.values(data.cryptocurrencies);
    
    cryptos.forEach(crypto => {
        // Update price displays
        updateCryptoPriceDisplay(crypto);
    });
}

/**
 * Update individual cryptocurrency price display
 */
function updateCryptoPriceDisplay(crypto) {
    // Update any price elements for this cryptocurrency
    const priceElements = document.querySelectorAll(`[data-crypto="${crypto.symbol}"]`);
    priceElements.forEach(element => {
        if (element.classList.contains('crypto-price')) {
            element.textContent = `$${parseFloat(crypto.current_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
    });

    // Update change percentage
    const changeElements = document.querySelectorAll(`[data-crypto-change="${crypto.symbol}"]`);
    changeElements.forEach(element => {
        const change = parseFloat(crypto.price_change_percentage_24h || 0);
        const isPositive = change >= 0;
        element.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
        element.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
    });
}

/**
 * Update selected cryptocurrency price in the form
 */
function updateSelectedCryptoPrice(crypto) {
    // Store current price for calculations
    window.currentCryptoPrice = parseFloat(crypto.current_price);
    
    // Update price display if element exists
    const priceDisplay = document.getElementById('current-crypto-price');
    if (priceDisplay) {
        priceDisplay.textContent = `$${window.currentCryptoPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    // Recalculate total if quantity is entered
    const quantityInput = document.getElementById('id_quantity');
    if (quantityInput && quantityInput.value) {
        calculateSellTotal();
    }
}

/**
 * Handle price update (called when user selects a crypto)
 */
function handlePriceUpdate(data) {
    if (data && data.symbol) {
        const crypto = sellMarketData.find(c => c.symbol === data.symbol);
        if (crypto) {
            updateSelectedCryptoPrice(crypto);
        }
    }
}

/**
 * Calculate sell total (called by sell.js)
 */
function calculateSellTotal() {
    const quantityInput = document.getElementById('id_quantity');
    if (!quantityInput || !window.currentCryptoPrice) return;

    const quantity = parseFloat(quantityInput.value) || 0;
    const subtotal = quantity * window.currentCryptoPrice;
    
    // Update displays
    const subtotalElement = document.getElementById('sell-subtotal');
    if (subtotalElement) {
        subtotalElement.textContent = `$${subtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', function() {
    if (sellPollingTimer) {
        clearInterval(sellPollingTimer);
    }
});

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing sell page market data...');
    initializeSellSocket();
});

// Also initialize if DOM already loaded
if (document.readyState !== 'loading') {
    console.log('Initializing sell page market data (immediate)...');
    initializeSellSocket();
}
