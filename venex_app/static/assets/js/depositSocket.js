/**
 * DEPOSIT WEBSOCKET - Real-time Updates
 * Handles WebSocket connection for live deposit status updates
 * Features: Auto-reconnect, balance updates, status notifications
 */

console.log('🔌 depositSocket.js loaded successfully');

// ========================================
// WEBSOCKET CONFIGURATION
// ========================================

let depositSocket = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let reconnectDelay = 3000;
let isConnected = false;
let reconnectTimeout = null;

// ========================================
// WEBSOCKET CONNECTION
// ========================================

/**
 * Initialize WebSocket connection
 */
function initializeDepositWebSocket() {
    // Get user ID from page (should be set by Django template)
    const userId = window.currentUserId || null;
    
    if (!userId) {
        console.warn('⚠️ User ID not found - WebSocket disabled');
        return;
    }
    
    // Determine WebSocket protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/deposits/${userId}/`;
    
    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    
    try {
        depositSocket = new WebSocket(wsUrl);
        
        depositSocket.onopen = handleWebSocketOpen;
        depositSocket.onmessage = handleWebSocketMessage;
        depositSocket.onerror = handleWebSocketError;
        depositSocket.onclose = handleWebSocketClose;
        
    } catch (error) {
        console.error('❌ Error creating WebSocket:', error);
        scheduleReconnect();
    }
}

/**
 * Handle WebSocket open
 */
function handleWebSocketOpen(event) {
    console.log('✅ WebSocket connected');
    isConnected = true;
    reconnectAttempts = 0;
    
    // Update connection status indicator
    updateConnectionStatus(true);
    
    // Send ping to keep connection alive
    startHeartbeat();
}

/**
 * Handle WebSocket message
 */
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data);
        
        // Route message to appropriate handler
        switch (data.type) {
            case 'deposit_status_update':
                handleDepositStatusUpdate(data);
                break;
                
            case 'balance_update':
                handleBalanceUpdate(data);
                break;
                
            case 'deposit_created':
                handleDepositCreated(data);
                break;
                
            case 'deposit_completed':
                handleDepositCompleted(data);
                break;
                
            case 'pong':
                // Heartbeat response
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
    }
}

/**
 * Handle WebSocket error
 */
function handleWebSocketError(error) {
    console.error('❌ WebSocket error:', error);
    updateConnectionStatus(false);
}

/**
 * Handle WebSocket close
 */
function handleWebSocketClose(event) {
    console.log('🔌 WebSocket closed:', event.code, event.reason);
    isConnected = false;
    stopHeartbeat();
    updateConnectionStatus(false);
    
    // Attempt to reconnect
    if (!event.wasClean && reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnect();
    }
}

// ========================================
// RECONNECTION LOGIC
// ========================================

/**
 * Schedule reconnection attempt
 */
function scheduleReconnect() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    
    reconnectAttempts++;
    const delay = reconnectDelay * Math.min(reconnectAttempts, 5);
    
    console.log(`🔄 Reconnecting in ${delay/1000}s (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
    
    reconnectTimeout = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        initializeDepositWebSocket();
    }, delay);
}

/**
 * Manually close WebSocket
 */
function closeDepositWebSocket() {
    if (depositSocket) {
        console.log('🔌 Closing WebSocket connection');
        depositSocket.close(1000, 'Client closing');
        depositSocket = null;
    }
    
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    
    stopHeartbeat();
}

// ========================================
// HEARTBEAT / KEEP-ALIVE
// ========================================

let heartbeatInterval = null;

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat() {
    // Send ping every 30 seconds
    heartbeatInterval = setInterval(() => {
        if (depositSocket && depositSocket.readyState === WebSocket.OPEN) {
            depositSocket.send(JSON.stringify({ type: 'ping' }));
        }
    }, 30000);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ========================================
// MESSAGE HANDLERS
// ========================================

/**
 * Handle deposit status update
 */
function handleDepositStatusUpdate(data) {
    const { transaction_id, status, old_status } = data;
    
    console.log(`📊 Deposit ${transaction_id} status: ${old_status} → ${status}`);
    
    // Show notification
    let message = '';
    let type = 'info';
    
    switch (status) {
        case 'COMPLETED':
            message = `✅ Deposit #${transaction_id} has been completed!`;
            type = 'success';
            break;
        case 'FAILED':
            message = `❌ Deposit #${transaction_id} failed`;
            type = 'error';
            break;
        case 'CANCELLED':
            message = `🚫 Deposit #${transaction_id} was cancelled`;
            type = 'warning';
            break;
        default:
            message = `Deposit #${transaction_id} status: ${status}`;
    }
    
    if (typeof showToast === 'function') {
        showToast(message, type);
    }
    
    // Refresh recent deposits
    if (typeof loadRecentDeposits === 'function') {
        setTimeout(loadRecentDeposits, 500);
    }
}

/**
 * Handle balance update
 */
function handleBalanceUpdate(data) {
    const { currency_balance, crypto_balance } = data;
    
    console.log('💰 Balance updated:', { currency_balance, crypto_balance });
    
    // Update balance displays
    updateBalanceDisplay('currency_balance', currency_balance);
    updateBalanceDisplay('crypto_balance', crypto_balance);
    
    // Show notification
    if (typeof showToast === 'function') {
        showToast('💰 Your balance has been updated', 'success');
    }
}

/**
 * Handle deposit created
 */
function handleDepositCreated(data) {
    const { transaction_id, cryptocurrency, amount } = data;
    
    console.log('📝 New deposit created:', transaction_id);
    
    // Refresh recent deposits
    if (typeof loadRecentDeposits === 'function') {
        setTimeout(loadRecentDeposits, 500);
    }
}

/**
 * Handle deposit completed
 */
function handleDepositCompleted(data) {
    const { transaction_id, cryptocurrency, amount, new_balance } = data;
    
    console.log('✅ Deposit completed:', transaction_id);
    
    let message = '';
    if (cryptocurrency && cryptocurrency !== 'UNKNOWN') {
        message = `🎉 ${amount} ${cryptocurrency} has been credited to your account!`;
    } else {
        message = `🎉 $${parseFloat(amount).toFixed(2)} has been credited to your account!`;
    }
    
    if (typeof showToast === 'function') {
        showToast(message, 'success');
    }
    
    // Update balance
    if (new_balance) {
        updateBalanceDisplay(cryptocurrency ? 'crypto_balance' : 'currency_balance', new_balance);
    }
    
    // Refresh recent deposits
    if (typeof loadRecentDeposits === 'function') {
        setTimeout(loadRecentDeposits, 1000);
    }
    
    // Play success sound (optional)
    playNotificationSound();
}

// ========================================
// UI UPDATE HELPERS
// ========================================

/**
 * Update balance display
 */
function updateBalanceDisplay(type, value) {
    let elementId = '';
    
    if (type === 'currency_balance') {
        elementId = 'currency-balance-value';
    } else if (type === 'crypto_balance' || type === 'total_crypto_value') {
        elementId = 'total-crypto-value';
    }
    
    const element = document.getElementById(elementId);
    if (element) {
        const formattedValue = parseFloat(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        // Animate the change
        element.classList.add('balance-update-pulse');
        element.textContent = `$${formattedValue}`;
        
        setTimeout(() => {
            element.classList.remove('balance-update-pulse');
        }, 1000);
    }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
    // This could update a status indicator in the UI
    const statusIndicator = document.getElementById('ws-status-indicator');
    
    if (statusIndicator) {
        if (connected) {
            statusIndicator.classList.add('connected');
            statusIndicator.classList.remove('disconnected');
            statusIndicator.title = 'Live updates active';
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusIndicator.title = 'Connection lost - attempting to reconnect';
        }
    }
}

/**
 * Play notification sound
 */
function playNotificationSound() {
    try {
        // Simple beep using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        // Silently fail if audio not supported
    }
}

// ========================================
// PAGE LIFECYCLE
// ========================================

/**
 * Handle page visibility change
 */
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('📴 Page hidden - maintaining connection');
        // Keep connection alive but reduce heartbeat
    } else {
        console.log('📱 Page visible - resuming normal operation');
        // Reconnect if disconnected
        if (!isConnected) {
            initializeDepositWebSocket();
        }
    }
});

/**
 * Handle page unload
 */
window.addEventListener('beforeunload', function() {
    closeDepositWebSocket();
});

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize WebSocket when page loads
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDepositWebSocket);
} else {
    initializeDepositWebSocket();
}

// Export functions for external use
window.depositWebSocket = {
    connect: initializeDepositWebSocket,
    disconnect: closeDepositWebSocket,
    isConnected: () => isConnected,
    send: (data) => {
        if (depositSocket && depositSocket.readyState === WebSocket.OPEN) {
            depositSocket.send(JSON.stringify(data));
        }
    }
};

console.log('✅ depositSocket.js fully loaded and ready');
