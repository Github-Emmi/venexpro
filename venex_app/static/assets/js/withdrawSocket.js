/**
 * WITHDRAW WEBSOCKET - Real-time withdrawal updates
 * Handles WebSocket connections for live withdrawal status updates
 */

console.log('🔌 withdrawSocket.js loaded');

class WithdrawSocketHandler {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isConnected = false;
    }

    /**
     * Initialize WebSocket connection
     */
    connect() {
        try {
            // Get protocol (ws or wss based on http or https)
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/withdrawals/`;
            
            console.log('🔌 Connecting to withdrawal WebSocket:', wsUrl);
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('✅ Withdrawal WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(event);
            };
            
            this.socket.onerror = (error) => {
                console.error('❌ Withdrawal WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
            
            this.socket.onclose = () => {
                console.log('🔌 Withdrawal WebSocket closed');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };
            
        } catch (error) {
            console.error('❌ Error creating withdrawal WebSocket:', error);
            this.attemptReconnect();
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Withdrawal WebSocket message received:', data);
            
            switch (data.type) {
                case 'withdrawal_status_update':
                    this.handleWithdrawalStatusUpdate(data);
                    break;
                
                case 'withdrawal_completed':
                    this.handleWithdrawalCompleted(data);
                    break;
                
                case 'withdrawal_failed':
                    this.handleWithdrawalFailed(data);
                    break;
                
                case 'balance_update':
                    this.handleBalanceUpdate(data);
                    break;
                
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Error handling withdrawal WebSocket message:', error);
        }
    }

    /**
     * Handle withdrawal status update
     */
    handleWithdrawalStatusUpdate(data) {
        console.log('🔄 Withdrawal status updated:', data.withdrawal);
        
        // Reload recent withdrawals
        if (typeof loadRecentWithdrawals === 'function') {
            loadRecentWithdrawals();
        }
        
        // Show notification
        const status = data.withdrawal.status;
        if (status === 'COMPLETED') {
            this.showNotification(
                'Withdrawal Completed',
                `Your ${data.withdrawal.cryptocurrency} withdrawal has been processed!`,
                'success'
            );
        } else if (status === 'FAILED') {
            this.showNotification(
                'Withdrawal Failed',
                `Your ${data.withdrawal.cryptocurrency} withdrawal could not be processed.`,
                'error'
            );
        } else {
            this.showNotification(
                'Withdrawal Update',
                `Your withdrawal status has been updated to: ${status}`,
                'info'
            );
        }
    }

    /**
     * Handle withdrawal completed
     */
    handleWithdrawalCompleted(data) {
        console.log('✅ Withdrawal completed:', data.withdrawal);
        
        // Reload data
        if (typeof loadRecentWithdrawals === 'function') {
            loadRecentWithdrawals();
        }
        if (typeof loadTotalCryptoBalance === 'function') {
            loadTotalCryptoBalance();
        }
        
        // Show success notification
        this.showNotification(
            '✅ Withdrawal Completed!',
            `Your ${data.withdrawal.quantity} ${data.withdrawal.cryptocurrency} withdrawal has been successfully processed.`,
            'success'
        );
    }

    /**
     * Handle withdrawal failed
     */
    handleWithdrawalFailed(data) {
        console.log('❌ Withdrawal failed:', data.withdrawal);
        
        // Reload data
        if (typeof loadRecentWithdrawals === 'function') {
            loadRecentWithdrawals();
        }
        
        // Show error notification
        this.showNotification(
            '❌ Withdrawal Failed',
            data.message || 'Your withdrawal could not be processed. Please contact support.',
            'error'
        );
    }

    /**
     * Handle balance update
     */
    handleBalanceUpdate(data) {
        console.log('💰 Balance updated:', data.balance);
        
        // Reload balance
        if (typeof loadTotalCryptoBalance === 'function') {
            loadTotalCryptoBalance();
        }
        
        // Update balance display if element exists
        const balanceElement = document.getElementById('fiat-balance');
        if (balanceElement && data.balance.fiat) {
            balanceElement.textContent = parseFloat(data.balance.fiat).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }

    /**
     * Show notification
     */
    showNotification(title, message, type = 'info') {
        // Try to use the page's toast function if available
        if (typeof showToast === 'function') {
            showToast(`${title}: ${message}`, type);
            return;
        }
        
        // Fallback to browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: '/static/assets/images/logo.png'
            });
        } else {
            console.log(`${title}: ${message}`);
        }
    }

    /**
     * Update connection status indicator
     */
    updateConnectionStatus(connected) {
        // Add a visual indicator if needed
        const statusIndicator = document.getElementById('ws-status-indicator');
        if (statusIndicator) {
            statusIndicator.className = connected ? 'ws-connected' : 'ws-disconnected';
            statusIndicator.title = connected ? 'Connected' : 'Disconnected';
        }
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('❌ Max reconnection attempts reached');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        
        setTimeout(() => {
            this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    /**
     * Send message through WebSocket
     */
    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            console.log('📤 Sent WebSocket message:', data);
        } else {
            console.warn('⚠️ WebSocket not connected, cannot send message');
        }
    }

    /**
     * Close WebSocket connection
     */
    disconnect() {
        if (this.socket) {
            console.log('🔌 Closing withdrawal WebSocket connection');
            this.socket.close();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// ========================================
// INITIALIZATION
// ========================================

// Create global WebSocket handler instance
let withdrawSocketHandler;

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithdrawSocket);
} else {
    initializeWithdrawSocket();
}

function initializeWithdrawSocket() {
    console.log('🎯 Initializing withdrawal WebSocket handler...');
    
    // Only initialize if on withdraw page
    const withdrawContainer = document.querySelector('.withdraw-container');
    if (!withdrawContainer) {
        console.log('ℹ️ Not on withdraw page, skipping WebSocket initialization');
        return;
    }
    
    withdrawSocketHandler = new WithdrawSocketHandler();
    withdrawSocketHandler.connect();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('🔔 Notification permission:', permission);
        });
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (withdrawSocketHandler) {
        withdrawSocketHandler.disconnect();
    }
});

// Reconnect when page becomes visible
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && withdrawSocketHandler && !withdrawSocketHandler.isConnected) {
        console.log('🔄 Page visible, reconnecting WebSocket...');
        withdrawSocketHandler.connect();
    }
});

console.log('✅ withdrawSocket.js fully loaded and ready');
