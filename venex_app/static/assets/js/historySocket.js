/**
 * WebSocket handler for real-time transaction history updates
 * Currently using polling as alternative since HistoryConsumer is not implemented in backend
 */

(function() {
    'use strict';

    // Configuration
    const POLLING_INTERVAL = 30000; // 30 seconds
    let pollingTimer = null;
    let lastUpdateTime = Date.now();

    console.log('Transaction History: Using polling for updates (WebSocket not available)');

    /**
     * Poll for new transactions
     * This will periodically check if there are new transactions
     */
    function startPolling() {
        // Only poll if the page is visible
        if (document.hidden) {
            return;
        }

        // Check for updates
        checkForUpdates();

        // Schedule next poll
        pollingTimer = setTimeout(startPolling, POLLING_INTERVAL);
    }

    /**
     * Check if there are new transactions since last update
     */
    function checkForUpdates() {
        fetch('/api/transactions/history/?page=1&per_page=1', {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.transactions && data.transactions.length > 0) {
                const latestTransaction = data.transactions[0];
                const transactionTime = new Date(latestTransaction.created_at).getTime();
                
                // If there's a newer transaction, refresh the page data
                if (transactionTime > lastUpdateTime) {
                    lastUpdateTime = transactionTime;
                    
                    // Trigger refresh if the app is available
                    if (window.historyApp && typeof window.historyApp.refresh === 'function') {
                        console.log('New transaction detected, refreshing...');
                        window.historyApp.refresh();
                    }
                }
            }
        })
        .catch(error => {
            console.warn('Polling check failed:', error);
        });
    }

    /**
     * Stop polling when page is hidden
     */
    function handleVisibilityChange() {
        if (document.hidden) {
            if (pollingTimer) {
                clearTimeout(pollingTimer);
                pollingTimer = null;
            }
        } else {
            // Resume polling when page becomes visible
            if (!pollingTimer) {
                startPolling();
            }
        }
    }

    /**
     * Initialize polling system
     */
    function init() {
        // Set initial update time
        lastUpdateTime = Date.now();

        // Listen for visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start polling
        startPolling();

        console.log(`Polling started: checking every ${POLLING_INTERVAL / 1000} seconds`);
    }

    /**
     * Cleanup on page unload
     */
    function cleanup() {
        if (pollingTimer) {
            clearTimeout(pollingTimer);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    // Add cleanup listener
    window.addEventListener('beforeunload', cleanup);

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ====================================================================
    // WebSocket Implementation (for future use when backend is ready)
    // ====================================================================
    // To enable WebSocket:
    // 1. Create HistoryConsumer in venex_app/consumers.py
    // 2. Add route in venex_app/routing.py: path('ws/history/', HistoryConsumer.as_asgi())
    // 3. Uncomment the code below and comment out polling above
    // ====================================================================

    /*
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/history/`;
    
    let socket = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    function connect() {
        try {
            socket = new WebSocket(wsUrl);
            
            socket.onopen = function() {
                console.log('Transaction History WebSocket connected');
                reconnectAttempts = 0;
            };
            
            socket.onmessage = function(event) {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };
            
            socket.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
            
            socket.onclose = function() {
                console.log('WebSocket closed');
                attemptReconnect();
            };
        } catch (error) {
            console.error('Failed to create WebSocket:', error);
        }
    }
    
    function handleWebSocketMessage(data) {
        if (data.type === 'transaction_update') {
            // Refresh transaction list when new transaction comes in
            if (window.historyApp && typeof window.historyApp.refresh === 'function') {
                window.historyApp.refresh();
            }
        } else if (data.type === 'transaction_status_change') {
            // Update specific transaction status without full refresh
            if (window.historyApp && typeof window.historyApp.updateTransactionStatus === 'function') {
                window.historyApp.updateTransactionStatus(data.transaction_id, data.status);
            }
        }
    }
    
    function attemptReconnect() {
        if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = 3000 * reconnectAttempts;
            setTimeout(() => {
                console.log(`Reconnecting WebSocket... (${reconnectAttempts}/${maxReconnectAttempts})`);
                connect();
            }, delay);
        } else {
            console.warn('Max reconnection attempts reached. Falling back to polling.');
            // Could fall back to polling here
        }
    }
    
    function disconnect() {
        if (socket) {
            socket.close();
            socket = null;
        }
    }
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', connect);
    } else {
        connect();
    }
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', disconnect);
    */

})();
