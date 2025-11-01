/**
 * Wallet Page - Real-time Cryptocurrency Price Updates
 * Fetches live market prices and updates wallet balance conversions
 */

console.log('🚀 wallet.js loaded successfully');

// Configuration
const UPDATE_INTERVAL = 60000; // 60 seconds
const CRYPTO_SYMBOLS = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX'];

// User balances from template (will be initialized on page load)
const userBalances = {
    BTC: 0,
    ETH: 0,
    USDT: 0,
    LTC: 0,
    TRX: 0
};

// Currency mapping
const symbolMap = {
    'BTC': 'btc',
    'ETH': 'eth',
    'USDT': 'usdt',
    'LTC': 'ltc',
    'TRX': 'trx'
};

/**
 * Initialize wallet balances from DOM
 */
function initializeBalances() {
    console.log('Initializing balances from DOM...');
    
    CRYPTO_SYMBOLS.forEach(symbol => {
        const balanceElement = document.getElementById(`${symbolMap[symbol]}-balance`);
        if (balanceElement) {
            const balance = parseFloat(balanceElement.textContent) || 0;
            userBalances[symbol] = balance;
            console.log(`${symbol} balance initialized: ${balance}`);
        } else {
            console.error(`Balance element not found for ${symbol}: ${symbolMap[symbol]}-balance`);
        }
    });
    
    console.log('Final userBalances:', userBalances);
}

/**
 * Format number with commas and decimals
 */
function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined || isNaN(num)) {
        return '0.00';
    }
    return parseFloat(num).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

/**
 * Format percentage with sign
 */
function formatPercentage(percent) {
    if (percent === null || percent === undefined || isNaN(percent)) {
        return '--';
    }
    const sign = percent >= 0 ? '+' : '';
    const arrow = percent >= 0 ? '↑' : '↓';
    return `${sign}${percent.toFixed(2)}% ${arrow}`;
}

/**
 * Update a single wallet card with price data
 */
function updateWalletCard(symbol, priceData) {
    const symbolLower = symbolMap[symbol];
    const balance = userBalances[symbol];
    const currentPrice = priceData.price || 0;
    const changePercent = priceData.change_percentage_24h || 0;
    
    console.log(`updateWalletCard called:`, {
        symbol,
        symbolLower,
        balance,
        currentPrice,
        changePercent,
        priceData
    });
    
    // Calculate fiat value
    const fiatValue = balance * currentPrice;
    
    // Update fiat value
    const fiatElement = document.getElementById(`${symbolLower}-fiat-value`);
    if (fiatElement) {
        fiatElement.textContent = formatNumber(fiatValue, 2);
        fiatElement.classList.add('updated');
        setTimeout(() => fiatElement.classList.remove('updated'), 500);
    } else {
        console.error(`Element not found: ${symbolLower}-fiat-value`);
    }
    
    // Update price change percentage
    const changeElement = document.getElementById(`${symbolLower}-price-change`);
    if (changeElement) {
        changeElement.textContent = formatPercentage(changePercent);
        
        // Remove existing classes
        changeElement.classList.remove('positive', 'negative', 'neutral');
        
        // Add appropriate class based on change
        if (changePercent > 0) {
            changeElement.classList.add('positive');
        } else if (changePercent < 0) {
            changeElement.classList.add('negative');
        } else {
            changeElement.classList.add('neutral');
        }
    } else {
        console.error(`Element not found: ${symbolLower}-price-change`);
    }
    
    // Hide loading spinner
    const loadingElement = document.getElementById(`${symbolLower}-loading`);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show loading spinner for a crypto
 */
function showLoading(symbol) {
    const symbolLower = symbolMap[symbol];
    const loadingElement = document.getElementById(`${symbolLower}-loading`);
    if (loadingElement) {
        loadingElement.style.display = 'inline-block';
    }
}

/**
 * Fetch cryptocurrency prices from API
 */
async function loadCryptoPrices() {
    try {
        // Show loading spinners
        CRYPTO_SYMBOLS.forEach(symbol => showLoading(symbol));
        
        // Fetch prices for all cryptocurrencies
        const symbolsParam = CRYPTO_SYMBOLS.join(',');
        const response = await fetch(`/api/v1/prices/multiple/?symbols=${symbolsParam}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('API Response:', data); // Debug log
        
        if (data.success && data.prices) {
            console.log('Prices received:', data.prices); // Debug log
            
            // Update each wallet card
            CRYPTO_SYMBOLS.forEach(symbol => {
                if (data.prices[symbol]) {
                    console.log(`Updating ${symbol} with:`, data.prices[symbol]); // Debug log
                    updateWalletCard(symbol, data.prices[symbol]);
                } else {
                    console.warn(`No price data for ${symbol}`);
                    hideLoading(symbol);
                }
            });
        } else {
            console.error('Failed to fetch prices:', data);
            CRYPTO_SYMBOLS.forEach(symbol => hideLoading(symbol));
        }
    } catch (error) {
        console.error('Error fetching cryptocurrency prices:', error);
        CRYPTO_SYMBOLS.forEach(symbol => hideLoading(symbol));
        
        // Show error message to user (optional)
        showErrorNotification('Failed to update prices. Will retry shortly.');
    }
}

/**
 * Hide loading spinner for a crypto
 */
function hideLoading(symbol) {
    const symbolLower = symbolMap[symbol];
    const loadingElement = document.getElementById(`${symbolLower}-loading`);
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show error notification (reuses existing toast)
 */
function showErrorNotification(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = 'toast error';
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }
}

/**
 * Initialize price updates
 */
function initializePriceUpdates() {
    console.log('🎯 initializePriceUpdates called');
    
    // Initialize balances from DOM
    initializeBalances();
    
    // Load prices immediately
    loadCryptoPrices();
    
    // Set up periodic updates
    setInterval(loadCryptoPrices, UPDATE_INTERVAL);
    
    console.log(`✅ Wallet initialized. Prices will update every ${UPDATE_INTERVAL / 1000} seconds.`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    console.log('📄 DOM still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initializePriceUpdates);
} else {
    console.log('📄 DOM already loaded, initializing immediately...');
    initializePriceUpdates();
}

// Re-fetch prices when tab becomes visible (user returns to page)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('👀 Tab visible, refreshing prices...');
        loadCryptoPrices();
    }
});
