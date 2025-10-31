/**
 * portfolioSocket-fallback.js - HTTP Polling Fallback for Portfolio Page
 * 
 * PythonAnywhere free tier doesn't support WebSockets
 * This script uses HTTP polling as a fallback
 */

const PORTFOLIO_POLLING_INTERVAL = 10000; // 10 seconds
const PORTFOLIO_API_URL = window.location.origin + '/api/market/data/';

let portfolioPollingTimer = null;

/**
 * Initialize connection (HTTP polling only)
 */
function initializePortfolioSocket() {
    console.log('Initializing portfolio page with HTTP polling (WebSocket not available)');
    startPortfolioPolling();
}

/**
 * Start HTTP polling
 */
function startPortfolioPolling() {
    // Initial fetch
    fetchPortfolioMarketData();
    
    // Set up interval
    if (portfolioPollingTimer) {
        clearInterval(portfolioPollingTimer);
    }
    
    portfolioPollingTimer = setInterval(fetchPortfolioMarketData, PORTFOLIO_POLLING_INTERVAL);
    console.log(`Portfolio page polling started (every ${PORTFOLIO_POLLING_INTERVAL/1000}s)`);
}

/**
 * Fetch market data via HTTP
 */
async function fetchPortfolioMarketData() {
    try {
        const response = await fetch(PORTFOLIO_API_URL, {
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
            updatePortfolioPrices(data.cryptocurrencies);
        }
    } catch (error) {
        console.error('Error fetching portfolio market data:', error);
    }
}

/**
 * Update portfolio prices
 */
function updatePortfolioPrices(cryptocurrencies) {
    const cryptos = Array.isArray(cryptocurrencies) ? cryptocurrencies : Object.values(cryptocurrencies);
    
    cryptos.forEach(crypto => {
        // Update price elements
        const priceElements = document.querySelectorAll(`[data-crypto-price="${crypto.symbol}"]`);
        priceElements.forEach(element => {
            element.textContent = `$${parseFloat(crypto.current_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        });

        // Update change percentage
        const changeElements = document.querySelectorAll(`[data-crypto-change="${crypto.symbol}"]`);
        changeElements.forEach(element => {
            const change = parseFloat(crypto.price_change_percentage_24h || 0);
            const isPositive = change >= 0;
            element.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
            element.className = `change ${isPositive ? 'positive' : 'negative'}`;
        });

        // Recalculate portfolio values if function exists
        if (typeof window.updatePortfolioValue === 'function') {
            window.updatePortfolioValue(crypto);
        }
    });
}

/**
 * Cleanup on page unload
 */
window.addEventListener('beforeunload', function() {
    if (portfolioPollingTimer) {
        clearInterval(portfolioPollingTimer);
    }
});

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing portfolio page market data...');
    initializePortfolioSocket();
});

// Also initialize if DOM already loaded
if (document.readyState !== 'loading') {
    console.log('Initializing portfolio page market data (immediate)...');
    initializePortfolioSocket();
}
