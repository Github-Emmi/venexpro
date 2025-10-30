/**
 * sellSocket.js - WebSocket Real-Time Price Updates for Sell Page
 * 
 * This script:
 * - Connects to the market WebSocket
 * - Updates cryptocurrency prices in real-time
 * - Recalculates total sale value automatically
 * - Handles reconnection on disconnect
 * - Updates portfolio values
 */

// ====================================================================
// WEBSOCKET CONNECTION
// ====================================================================

let sellSocket = null;
let reconnectInterval = null;
const RECONNECT_DELAY = 5000; // 5 seconds

/**
 * Initialize WebSocket connection
 */
function initializeSellSocket() {
    // Determine WebSocket protocol (ws or wss)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/market/`;
    
    console.log('Connecting to market WebSocket:', wsUrl);
    
    try {
        sellSocket = new WebSocket(wsUrl);
        
        sellSocket.onopen = function(e) {
            console.log('✓ Market WebSocket connected');
            clearReconnectInterval();
            
            // Request initial market data
            if (sellSocket.readyState === WebSocket.OPEN) {
                sellSocket.send(JSON.stringify({
                    type: 'get_market_data'
                }));
            }
        };
        
        sellSocket.onmessage = function(e) {
            try {
                const data = JSON.parse(e.data);
                
                if (data.type === 'market_data') {
                    // Initial market data received
                    updateMarketData(data.data);
                } else if (data.type === 'price_update') {
                    // Single price update
                    updateCryptoPrice(data.data.symbol, data.data.price);
                }
                
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };
        
        sellSocket.onerror = function(e) {
            console.error('WebSocket error:', e);
        };
        
        sellSocket.onclose = function(e) {
            console.log('Market WebSocket closed');
            
            if (e.code !== 1000) {
                // Abnormal closure, attempt to reconnect
                console.log('Attempting to reconnect in', RECONNECT_DELAY / 1000, 'seconds...');
                scheduleReconnect();
            }
        };
        
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        scheduleReconnect();
    }
}

/**
 * Schedule WebSocket reconnection
 */
function scheduleReconnect() {
    clearReconnectInterval();
    
    reconnectInterval = setInterval(() => {
        console.log('Reconnecting to market WebSocket...');
        initializeSellSocket();
    }, RECONNECT_DELAY);
}

/**
 * Clear reconnection interval
 */
function clearReconnectInterval() {
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
}

// ====================================================================
// PRICE UPDATE HANDLERS
// ====================================================================

/**
 * Update cryptocurrency price display
 * @param {string} symbol - Crypto symbol (BTC, ETH, etc.)
 * @param {number} price - New price in USD
 */
function updateCryptoPrice(symbol, price) {
    console.log(`Price update: ${symbol} = $${price}`);
    
    // Call sell.js function if available
    if (typeof window.updateSellPagePrice === 'function') {
        window.updateSellPagePrice(symbol, price);
    }
}

/**
 * Update market data (multiple cryptocurrencies)
 * @param {object} marketData - Object containing multiple crypto prices
 */
function updateMarketData(marketData) {
    if (!marketData || typeof marketData !== 'object') {
        return;
    }
    
    console.log('Market data received:', marketData);
    
    // Handle different data structures
    if (marketData.cryptocurrencies && Array.isArray(marketData.cryptocurrencies)) {
        // Array of crypto objects
        marketData.cryptocurrencies.forEach(crypto => {
            if (crypto.symbol && crypto.current_price) {
                updateCryptoPrice(crypto.symbol, crypto.current_price);
            }
        });
    } else if (typeof marketData === 'object') {
        // Object with symbol keys
        Object.keys(marketData).forEach(symbol => {
            const data = marketData[symbol];
            if (data && data.price) {
                updateCryptoPrice(symbol, data.price);
            } else if (typeof data === 'number') {
                updateCryptoPrice(symbol, data);
            }
        });
    }
}

// ====================================================================
// INITIALIZATION
// ====================================================================

/**
 * Initialize WebSocket when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing sell page WebSocket connection...');
    initializeSellSocket();
});

/**
 * Clean up WebSocket on page unload
 */
window.addEventListener('beforeunload', function() {
    clearReconnectInterval();
    
    if (sellSocket && sellSocket.readyState === WebSocket.OPEN) {
        sellSocket.close(1000, 'Page unload');
    }
});

/**
 * Handle page visibility change (pause/resume updates)
 */
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('Page hidden - WebSocket still active');
    } else {
        console.log('Page visible - WebSocket active');
        
        // Reconnect if socket is closed
        if (!sellSocket || sellSocket.readyState === WebSocket.CLOSED) {
            initializeSellSocket();
        }
    }
});
