// Portfolio WebSocket Manager - Real-time Portfolio Updates
(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        RECONNECT_INTERVAL: 3000,        // Initial reconnect delay
        MAX_RECONNECT_INTERVAL: 30000,   // Max reconnect delay
        RECONNECT_DECAY: 1.5,            // Exponential backoff multiplier
        PING_INTERVAL: 25000,            // Heartbeat interval
        PING_TIMEOUT: 5000,              // Ping response timeout
        MESSAGE_QUEUE_SIZE: 50           // Max queued messages
    };

    // ===== STATE =====
    const state = {
        ws: null,
        isConnected: false,
        reconnectTimer: null,
        reconnectAttempts: 0,
        pingTimer: null,
        pingTimeout: null,
        messageQueue: [],
        lastPongTime: null
    };

    // ===== DOM ELEMENTS =====
    const elements = {
        connectionStatus: document.getElementById('connection-status'),
        statusText: null,
        statusDot: null
    };

    // ===== INITIALIZATION =====
    function init() {
        setupConnectionStatus();
        connect();
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', disconnect);
    }

    // ===== CONNECTION MANAGEMENT =====
    function connect() {
        if (state.ws && (state.ws.readyState === WebSocket.CONNECTING || state.ws.readyState === WebSocket.OPEN)) {
            console.log('WebSocket already connected or connecting');
            return;
        }

        try {
            // Determine WebSocket protocol and URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/portfolio/`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            state.ws = new WebSocket(wsUrl);
            
            // Event handlers
            state.ws.onopen = handleOpen;
            state.ws.onmessage = handleMessage;
            state.ws.onclose = handleClose;
            state.ws.onerror = handleError;
            
            updateConnectionStatus('connecting', 'Connecting...');
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            updateConnectionStatus('disconnected', 'Connection failed');
            scheduleReconnect();
        }
    }

    function disconnect() {
        clearTimeout(state.reconnectTimer);
        clearInterval(state.pingTimer);
        clearTimeout(state.pingTimeout);
        
        if (state.ws) {
            state.ws.onclose = null; // Prevent reconnection
            state.ws.close(1000, 'Client disconnecting');
            state.ws = null;
        }
        
        state.isConnected = false;
        updateConnectionStatus('disconnected', 'Disconnected');
    }

    function scheduleReconnect() {
        if (state.reconnectTimer) {
            return;
        }

        const delay = Math.min(
            CONFIG.RECONNECT_INTERVAL * Math.pow(CONFIG.RECONNECT_DECAY, state.reconnectAttempts),
            CONFIG.MAX_RECONNECT_INTERVAL
        );

        console.log(`Scheduling reconnect in ${delay}ms (attempt ${state.reconnectAttempts + 1})`);
        
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            state.reconnectAttempts++;
            connect();
        }, delay);

        updateConnectionStatus('disconnected', `Reconnecting in ${Math.round(delay / 1000)}s...`);
    }

    // ===== EVENT HANDLERS =====
    function handleOpen(event) {
        console.log('WebSocket connected');
        state.isConnected = true;
        state.reconnectAttempts = 0;
        state.lastPongTime = Date.now();
        
        updateConnectionStatus('connected', 'Connected');
        
        // Start heartbeat
        startHeartbeat();
        
        // Send queued messages
        flushMessageQueue();
        
        // Subscribe to portfolio updates
        send({
            type: 'subscribe',
            channel: 'portfolio_updates'
        });

        // Trigger portfolio refresh
        if (window.PortfolioManager && window.PortfolioManager.refresh) {
            window.PortfolioManager.refresh();
        }
    }

    function handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);
            
            switch (data.type) {
                case 'pong':
                    handlePong();
                    break;
                    
                case 'price_update':
                    handlePriceUpdate(data);
                    break;
                    
                case 'portfolio_update':
                    handlePortfolioUpdate(data);
                    break;
                    
                case 'balance_update':
                    handleBalanceUpdate(data);
                    break;
                    
                case 'error':
                    handleServerError(data);
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    function handleClose(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        state.isConnected = false;
        
        clearInterval(state.pingTimer);
        clearTimeout(state.pingTimeout);
        
        updateConnectionStatus('disconnected', 'Disconnected');
        
        // Reconnect unless it was a clean close
        if (event.code !== 1000) {
            scheduleReconnect();
        }
    }

    function handleError(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus('error', 'Connection error');
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            // Page hidden - reduce activity
            clearInterval(state.pingTimer);
        } else {
            // Page visible - resume activity
            if (state.isConnected) {
                startHeartbeat();
            } else {
                connect();
            }
        }
    }

    // ===== MESSAGE HANDLERS =====
    function handlePong() {
        clearTimeout(state.pingTimeout);
        state.lastPongTime = Date.now();
    }

    function handlePriceUpdate(data) {
        // Update price displays
        if (data.prices && typeof data.prices === 'object') {
            Object.entries(data.prices).forEach(([crypto, priceData]) => {
                updateCryptoPrice(crypto, priceData);
            });
        }
        
        // Trigger portfolio recalculation if manager is available
        if (window.PortfolioManager && window.PortfolioManager.loadData) {
            window.PortfolioManager.loadData();
        }
    }

    function handlePortfolioUpdate(data) {
        // Full portfolio update
        if (window.PortfolioManager && window.PortfolioManager.loadData) {
            window.PortfolioManager.loadData();
        }
        
        showNotification('Portfolio updated', 'success');
    }

    function handleBalanceUpdate(data) {
        // Update specific balance
        if (data.cryptocurrency && data.balance) {
            updateHoldingBalance(data.cryptocurrency, data.balance);
        }
        
        // Refresh portfolio data
        if (window.PortfolioManager && window.PortfolioManager.loadData) {
            window.PortfolioManager.loadData();
        }
    }

    function handleServerError(data) {
        console.error('Server error:', data.message);
        showNotification(data.message || 'Server error occurred', 'error');
    }

    // ===== HEARTBEAT =====
    function startHeartbeat() {
        clearInterval(state.pingTimer);
        
        state.pingTimer = setInterval(() => {
            if (!state.isConnected) {
                clearInterval(state.pingTimer);
                return;
            }
            
            send({ type: 'ping' });
            
            // Set timeout for pong response
            state.pingTimeout = setTimeout(() => {
                console.warn('Ping timeout - connection may be dead');
                state.ws.close();
            }, CONFIG.PING_TIMEOUT);
            
        }, CONFIG.PING_INTERVAL);
    }

    // ===== MESSAGING =====
    function send(message) {
        if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
            // Queue message if not connected
            if (state.messageQueue.length < CONFIG.MESSAGE_QUEUE_SIZE) {
                state.messageQueue.push(message);
            }
            return false;
        }

        try {
            state.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Error sending message:', error);
            return false;
        }
    }

    function flushMessageQueue() {
        if (state.messageQueue.length === 0) {
            return;
        }

        console.log(`Flushing ${state.messageQueue.length} queued messages`);
        
        const queue = [...state.messageQueue];
        state.messageQueue = [];
        
        queue.forEach(message => send(message));
    }

    // ===== UI UPDATES =====
    function setupConnectionStatus() {
        if (!elements.connectionStatus) {
            return;
        }

        // Create status elements if they don't exist
        if (!elements.connectionStatus.querySelector('.status-dot')) {
            elements.connectionStatus.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-text"></span>
            `;
        }

        elements.statusDot = elements.connectionStatus.querySelector('.status-dot');
        elements.statusText = elements.connectionStatus.querySelector('.status-text');
    }

    function updateConnectionStatus(status, text) {
        if (!elements.connectionStatus) {
            return;
        }

        // Update status class
        elements.connectionStatus.className = 'connection-status';
        elements.connectionStatus.classList.add(status);

        // Update text
        if (elements.statusText) {
            elements.statusText.textContent = text;
        }

        // Add appropriate class to dot
        if (elements.statusDot) {
            elements.statusDot.className = 'status-dot';
            elements.statusDot.classList.add(status);
        }
    }

    function updateCryptoPrice(crypto, priceData) {
        // Update price in holdings list
        const holdingItems = document.querySelectorAll('.holding-item');
        holdingItems.forEach(item => {
            const symbolEl = item.querySelector('.holding-symbol');
            if (symbolEl && symbolEl.textContent === crypto) {
                const valueEl = item.querySelector('.holding-value');
                const quantity = parseFloat(item.querySelector('.holding-quantity').textContent);
                
                if (valueEl && !isNaN(quantity)) {
                    const newValue = quantity * priceData.price;
                    valueEl.textContent = `$${formatNumber(newValue, 2)}`;
                    
                    // Add flash animation
                    valueEl.classList.add('flash');
                    setTimeout(() => valueEl.classList.remove('flash'), 1000);
                }
            }
        });
    }

    function updateHoldingBalance(crypto, balance) {
        const holdingItems = document.querySelectorAll('.holding-item');
        holdingItems.forEach(item => {
            const symbolEl = item.querySelector('.holding-symbol');
            if (symbolEl && symbolEl.textContent === crypto) {
                const quantityEl = item.querySelector('.holding-quantity');
                if (quantityEl) {
                    quantityEl.textContent = `${formatNumber(balance, 8)} ${crypto}`;
                }
            }
        });
    }

    function showNotification(message, type) {
        // Use toast system if available
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            console.log(`Notification (${type}):`, message);
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===== UTILITIES =====
    function formatNumber(num, decimals) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // ===== PUBLIC API =====
    window.PortfolioSocket = {
        connect,
        disconnect,
        send,
        isConnected: () => state.isConnected,
        getStatus: () => ({
            connected: state.isConnected,
            attempts: state.reconnectAttempts,
            lastPong: state.lastPongTime
        })
    };

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
