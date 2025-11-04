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

// User currency (from template, will be initialized)
let userCurrency = 'USD';
let currencySymbol = '$';

// Currency symbol mapping
const currencySymbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'NGN': '₦',
    'INR': '₹',
    'CNY': '¥',
    'KRW': '₩',
    'BRL': 'R$',
    'ZAR': 'R',
    'CAD': 'C$',
    'AUD': 'A$',
    'NZD': 'NZ$',
    'MXN': 'Mex$',
    'SGD': 'S$'
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
    
    // Get user currency from DOM
    const currencyElement = document.getElementById('btc-currency');
    if (currencyElement) {
        userCurrency = currencyElement.textContent.trim();
        currencySymbol = currencySymbols[userCurrency] || userCurrency;
        console.log(`User currency: ${userCurrency}, Symbol: ${currencySymbol}`);
    }
    
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
 * Format currency value with symbol and code
 * Format: USD 104,515.80 or NGN 149,956,926.30
 */
function formatCurrency(amount, currency, symbol) {
    const formatted = formatNumber(amount, 2);
    // Return format: "USD 104,515.80" or "NGN 149,956,926.30"
    return `${currency} ${formatted}`;
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
    const currentPriceUSD = priceData.price || 0;
    const changePercent = priceData.change_percentage_24h || 0;
    const convertedPrice = priceData.converted_price || currentPriceUSD;
    
    console.log(`updateWalletCard called:`, {
        symbol,
        symbolLower,
        balance,
        currentPriceUSD,
        convertedPrice,
        userCurrency,
        currencySymbol,
        changePercent,
        priceData
    });
    
    // Calculate fiat value in user's currency
    const fiatValue = balance * convertedPrice;
    
    // Update fiat value with proper formatting
    const fiatElement = document.getElementById(`${symbolLower}-fiat-value`);
    if (fiatElement) {
        // Format: ₦149,956,926.30 (for NGN) or $104,432.80 (for USD)
        const formattedValue = formatCurrency(fiatValue, userCurrency, currencySymbol);
        fiatElement.textContent = formattedValue;
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
        
        // Fetch prices for all cryptocurrencies with currency conversion
        const symbolsParam = CRYPTO_SYMBOLS.join(',');
        const response = await fetch(`/api/v1/prices/multiple/?symbols=${symbolsParam}&currency=${userCurrency}`);
        
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
