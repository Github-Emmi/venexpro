// venex-dashboard-fallback.js
// Adaptive real-time data integration for Dashboard
// Falls back to HTTP polling if WebSocket is unavailable (PythonAnywhere free tier)

const DASHBOARD_USE_WEBSOCKET = false; // Set to false for PythonAnywhere free tier
const DASHBOARD_POLLING_INTERVAL = 10000; // 10 seconds for dashboard
const DASHBOARD_API_BASE_URL = window.location.origin;

let dashboardSocket = null;
let dashboardPollingTimer = null;
let dashboardIsConnected = false;

// Initialize dashboard connection
function initDashboardConnection() {
    if (DASHBOARD_USE_WEBSOCKET && window.location.protocol === 'https:') {
        tryDashboardWebSocket();
    } else {
        console.log('Dashboard using HTTP polling for real-time data');
        startDashboardPolling();
    }
}

// Try WebSocket with fallback
function tryDashboardWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/market/`;

    try {
        dashboardSocket = new WebSocket(wsUrl);

        dashboardSocket.onopen = function() {
            console.log('Dashboard WebSocket connected');
            dashboardIsConnected = true;
        };

        dashboardSocket.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'market_data') {
                    updateDashboardMarketData(data.data);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        dashboardSocket.onclose = function() {
            console.log('Dashboard WebSocket disconnected, using HTTP polling');
            dashboardIsConnected = false;
            dashboardSocket = null;
            startDashboardPolling();
        };

        dashboardSocket.onerror = function(error) {
            console.error('Dashboard WebSocket error:', error);
            dashboardIsConnected = false;
            dashboardSocket = null;
            startDashboardPolling();
        };

    } catch (error) {
        console.error('Dashboard WebSocket creation failed:', error);
        startDashboardPolling();
    }
}

// HTTP Polling for dashboard
function startDashboardPolling() {
    if (dashboardSocket) {
        dashboardSocket.close();
        dashboardSocket = null;
    }

    if (dashboardPollingTimer) {
        clearInterval(dashboardPollingTimer);
    }

    // Initial fetch
    fetchDashboardMarketData();

    // Set up polling
    dashboardPollingTimer = setInterval(fetchDashboardMarketData, DASHBOARD_POLLING_INTERVAL);
    console.log(`Dashboard HTTP polling started (every ${DASHBOARD_POLLING_INTERVAL/1000}s)`);
}

// Fetch market data for dashboard
async function fetchDashboardMarketData() {
    try {
        const response = await fetch(`${DASHBOARD_API_BASE_URL}/api/market/data/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            updateDashboardMarketData(data);
        }
    } catch (error) {
        console.error('Error fetching dashboard market data:', error);
    }
}

// Update dashboard market data
function updateDashboardMarketData(marketData) {
    // Update market statistics
    if (marketData.market_stats) {
        const activeCryptos = document.getElementById('activeCryptos');
        const totalMarketCap = document.getElementById('totalMarketCap');
        const totalVolume = document.getElementById('totalVolume');
        const btcDominance = document.getElementById('btcDominance');

        if (activeCryptos) {
            activeCryptos.textContent = marketData.market_stats.active_cryptocurrencies || '5';
        }
        if (totalMarketCap) {
            totalMarketCap.textContent = '$' + abbreviateNumber(marketData.market_stats.total_market_cap || 0);
        }
        if (totalVolume) {
            totalVolume.textContent = '$' + abbreviateNumber(marketData.market_stats.total_volume_24h || 0);
        }
        if (btcDominance) {
            btcDominance.textContent = `${parseFloat(marketData.market_stats.btc_dominance || 0).toFixed(2)}%`;
        }
    }

    // Update cryptocurrency cards
    if (marketData.cryptocurrencies) {
        if (Array.isArray(marketData.cryptocurrencies)) {
            marketData.cryptocurrencies.forEach(crypto => {
                updateDashboardCryptoCard(crypto);
            });
        } else {
            Object.values(marketData.cryptocurrencies).forEach(crypto => {
                updateDashboardCryptoCard(crypto);
            });
        }
    }

    // Update timestamp
    const updateTime = document.getElementById('updateTime');
    if (updateTime) {
        updateTime.textContent = new Date().toLocaleTimeString();
    }
}

// Update individual cryptocurrency card on dashboard
function updateDashboardCryptoCard(crypto) {
    const card = document.getElementById(`card-${crypto.symbol}`);
    if (!card) return;

    const priceElement = card.querySelector('.current-price');
    const changeElement = card.querySelector('.price-change');
    const marketCapElement = document.getElementById(`cap-${crypto.symbol}`);
    const volumeElement = document.getElementById(`vol-${crypto.symbol}`);

    if (priceElement) {
        priceElement.textContent = `$${parseFloat(crypto.current_price || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    if (changeElement) {
        const isPositive = parseFloat(crypto.price_change_percentage_24h || 0) >= 0;
        changeElement.textContent = `${isPositive ? '+' : ''}${parseFloat(crypto.price_change_percentage_24h || 0).toFixed(2)}%`;
        changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
    }

    if (marketCapElement) {
        marketCapElement.textContent = '$' + abbreviateNumber(parseFloat(crypto.market_cap || 0));
    }

    if (volumeElement) {
        volumeElement.textContent = '$' + abbreviateNumber(parseFloat(crypto.total_volume || 0));
    }
}

// Abbreviate numbers
function abbreviateNumber(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Cleanup
window.addEventListener('beforeunload', function() {
    if (dashboardSocket) {
        dashboardSocket.close();
    }
    if (dashboardPollingTimer) {
        clearInterval(dashboardPollingTimer);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing dashboard real-time data connection...');
    initDashboardConnection();
});

if (document.readyState !== 'loading') {
    console.log('Initializing dashboard real-time data connection (immediate)...');
    initDashboardConnection();
}
