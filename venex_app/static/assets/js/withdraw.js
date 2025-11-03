/**
 * WITHDRAW SYSTEM - Main JavaScript
 * Handles cryptocurrency withdrawal flows
 * Features: Multi-step forms, balance validation, real-time price updates
 */

console.log('🚀 withdraw.js loaded successfully');

// ========================================
// CONFIGURATION & STATE
// ========================================

const API_ENDPOINTS = {
    WITHDRAW_FUNDS: '/api/trading/withdraw/',
    CRYPTO_PRICES: '/api/v1/prices/multiple/',
    RECENT_TRANSACTIONS: '/api/transactions/recent/',
    TOTAL_CRYPTO_VALUE: '/api/portfolio/crypto-value/',
};

const MIN_WITHDRAWALS = {
    BTC: 0.0001,
    ETH: 0.001,
    USDT: 10,
    LTC: 0.01,
    TRX: 100,
};

const CRYPTO_ICONS = {
    BTC: '₿',
    ETH: 'Ξ',
    USDT: '₮',
    LTC: 'Ł',
    TRX: '⚡',
};

const CRYPTO_NAMES = {
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    USDT: 'Tether',
    LTC: 'Litecoin',
    TRX: 'Tron',
};

const USER_BALANCES = {
    BTC: parseFloat(document.querySelector('.crypto-balance-card:nth-child(1) .balance-amount')?.textContent || 0),
    ETH: parseFloat(document.querySelector('.crypto-balance-card:nth-child(2) .balance-amount')?.textContent || 0),
    USDT: parseFloat(document.querySelector('.crypto-balance-card:nth-child(3) .balance-amount')?.textContent || 0),
    LTC: parseFloat(document.querySelector('.crypto-balance-card:nth-child(4) .balance-amount')?.textContent || 0),
    TRX: parseFloat(document.querySelector('.crypto-balance-card:nth-child(5) .balance-amount')?.textContent || 0),
};

let cryptoPrices = {};
let selectedCrypto = null;
let currentWithdrawalData = null;

// ========================================
// INITIALIZATION
// ========================================

function initializeWithdrawSystem() {
    console.log('🎯 Initializing Withdraw System...');
    
    // Load initial data
    loadCryptoPrices();
    loadTotalCryptoBalance();
    loadRecentWithdrawals();
    
    // Set up periodic updates
    setInterval(loadCryptoPrices, 60000); // Update prices every minute
    setInterval(loadTotalCryptoBalance, 60000); // Update total crypto value every minute
    setInterval(loadRecentWithdrawals, 30000); // Update withdrawals every 30 seconds
    
    // Set up amount input listener
    const withdrawAmountInput = document.getElementById('withdraw-amount');
    if (withdrawAmountInput) {
        withdrawAmountInput.addEventListener('input', updateWithdrawFiatEquivalent);
    }
    
    console.log('✅ Withdraw System initialized');
}

// ========================================
// DATA LOADING
// ========================================

/**
 * Load cryptocurrency prices
 */
async function loadCryptoPrices() {
    try {
        const symbols = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX'].join(',');
        const response = await fetch(`${API_ENDPOINTS.CRYPTO_PRICES}?symbols=${symbols}`);
        
        if (!response.ok) throw new Error('Failed to load prices');
        
        const data = await response.json();
        
        if (data.success && data.prices) {
            cryptoPrices = data.prices;
            console.log('💰 Crypto prices loaded:', cryptoPrices);
            updateBalanceValues();
        }
    } catch (error) {
        console.error('❌ Error loading crypto prices:', error);
    }
}

/**
 * Update balance USD values
 */
function updateBalanceValues() {
    const symbols = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX'];
    
    symbols.forEach(symbol => {
        const valueElement = document.getElementById(`${symbol.toLowerCase()}-value`);
        if (valueElement && cryptoPrices[symbol] && USER_BALANCES[symbol]) {
            const price = parseFloat(cryptoPrices[symbol].price || 0);
            const balance = USER_BALANCES[symbol];
            const value = price * balance;
            valueElement.textContent = `≈ $${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
    });
}

/**
 * Load total crypto balance
 */
async function loadTotalCryptoBalance() {
    try {
        const totalValueElement = document.getElementById('total-crypto-value');
        if (!totalValueElement) return;
        
        totalValueElement.textContent = '...';
        
        const response = await fetch(API_ENDPOINTS.TOTAL_CRYPTO_VALUE, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) throw new Error('Failed to load crypto value');
        
        const data = await response.json();
        
        if (data.success) {
            const formattedValue = parseFloat(data.total_value).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            totalValueElement.textContent = formattedValue;
        } else {
            totalValueElement.textContent = '0.00';
        }
    } catch (error) {
        console.error('❌ Error loading crypto balance:', error);
        const totalValueElement = document.getElementById('total-crypto-value');
        if (totalValueElement) {
            totalValueElement.textContent = '0.00';
        }
    }
}

/**
 * Load recent withdrawals
 */
async function loadRecentWithdrawals() {
    try {
        const response = await fetch(`${API_ENDPOINTS.RECENT_TRANSACTIONS}?type=WITHDRAWAL&limit=4`);
        
        if (!response.ok) throw new Error('Failed to load withdrawals');
        
        const data = await response.json();
        
        if (data.success && data.transactions) {
            renderRecentWithdrawals(data.transactions);
        }
    } catch (error) {
        console.error('❌ Error loading recent withdrawals:', error);
    }
}

/**
 * Render recent withdrawals
 */
function renderRecentWithdrawals(withdrawals) {
    const withdrawalsGrid = document.getElementById('withdrawals-grid');
    const emptyState = document.getElementById('withdrawals-empty-state');
    
    if (!withdrawalsGrid) return;
    
    if (!withdrawals || withdrawals.length === 0) {
        withdrawalsGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    withdrawalsGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    withdrawalsGrid.innerHTML = withdrawals.map(withdrawal => createWithdrawalCard(withdrawal)).join('');
}

/**
 * Create withdrawal card HTML
 */
function createWithdrawalCard(withdrawal) {
    const crypto = withdrawal.cryptocurrency;
    const amount = parseFloat(withdrawal.quantity || withdrawal.amount || 0);
    const status = withdrawal.status || 'PENDING';
    const date = new Date(withdrawal.created_at);
    const icon = CRYPTO_ICONS[crypto] || '₿';
    
    const statusClass = status.toLowerCase();
    const statusText = status.charAt(0) + status.slice(1).toLowerCase();
    
    // Get icon background class
    let iconClass = 'btc-icon';
    if (crypto === 'ETH') iconClass = 'eth-icon';
    else if (crypto === 'USDT') iconClass = 'usdt-icon';
    else if (crypto === 'LTC') iconClass = 'ltc-icon';
    else if (crypto === 'TRX') iconClass = 'trx-icon';
    
    return `
        <div class="withdrawal-card">
            <div class="withdrawal-header">
                <div class="withdrawal-crypto">
                    <div class="withdrawal-crypto-icon ${iconClass}">${icon}</div>
                    <div class="withdrawal-crypto-info">
                        <h4>Withdrawal</h4>
                        <div class="amount">${amount.toFixed(8)} ${crypto}</div>
                    </div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="withdrawal-details">
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${date.toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${date.toLocaleTimeString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ID:</span>
                    <span class="detail-value">${withdrawal.id.substring(0, 8)}...</span>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// MODAL FUNCTIONS
// ========================================

/**
 * Show withdraw modal for specific cryptocurrency
 */
function showWithdrawModal(crypto) {
    selectedCrypto = crypto;
    const modal = document.getElementById('withdrawModal');
    if (!modal) return;
    
    // Reset form
    document.getElementById('withdraw-form').reset();
    showWithdrawStep(1);
    
    // Update crypto info
    const icon = CRYPTO_ICONS[crypto];
    const name = CRYPTO_NAMES[crypto];
    const balance = USER_BALANCES[crypto];
    
    // Update icon background
    const cryptoInfoIcon = document.getElementById('crypto-info-icon');
    cryptoInfoIcon.textContent = icon;
    cryptoInfoIcon.className = 'crypto-info-icon';
    if (crypto === 'BTC') cryptoInfoIcon.style.background = 'linear-gradient(135deg, #f7931a, #e67e00)';
    else if (crypto === 'ETH') cryptoInfoIcon.style.background = 'linear-gradient(135deg, #627eea, #4c63c9)';
    else if (crypto === 'USDT') cryptoInfoIcon.style.background = 'linear-gradient(135deg, #26a17b, #1e8a66)';
    else if (crypto === 'LTC') cryptoInfoIcon.style.background = 'linear-gradient(135deg, #345d9d, #2a4a7c)';
    else if (crypto === 'TRX') cryptoInfoIcon.style.background = 'linear-gradient(135deg, #eb0029, #c40023)';
    
    document.getElementById('modal-crypto-name').textContent = name;
    document.getElementById('crypto-info-name').textContent = name;
    document.getElementById('crypto-info-balance').textContent = balance.toFixed(8);
    document.getElementById('crypto-info-symbol').textContent = crypto;
    document.getElementById('withdraw-crypto-symbol').textContent = crypto;
    
    // Set minimum withdrawal
    const minWithdraw = MIN_WITHDRAWALS[crypto];
    document.getElementById('min-withdraw').textContent = `Minimum: ${minWithdraw} ${crypto}`;
    document.getElementById('withdraw-amount').setAttribute('min', minWithdraw);
    document.getElementById('withdraw-amount').setAttribute('max', balance);
    
    modal.classList.add('active');
}

/**
 * Close withdraw modal
 */
function closeWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (modal) {
        modal.classList.remove('active');
        selectedCrypto = null;
        currentWithdrawalData = null;
    }
}

/**
 * Show specific step
 */
function showWithdrawStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(`withdraw-step-${stepNumber}`).classList.add('active');
}

/**
 * Go to previous step
 */
function previousWithdrawStep() {
    showWithdrawStep(1);
}

// ========================================
// WITHDRAWAL FLOW
// ========================================

/**
 * Set withdrawal amount by percentage
 */
function setWithdrawAmount(percentage) {
    const balance = USER_BALANCES[selectedCrypto];
    const amount = (balance * percentage) / 100;
    document.getElementById('withdraw-amount').value = amount.toFixed(8);
    updateWithdrawFiatEquivalent();
}

/**
 * Update fiat equivalent
 */
function updateWithdrawFiatEquivalent() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value) || 0;
    const price = cryptoPrices[selectedCrypto]?.price || 0;
    const fiatValue = amount * price;
    
    document.getElementById('withdraw-fiat-equivalent').textContent = 
        `≈ $${fiatValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/**
 * Review withdrawal before submission
 */
function reviewWithdrawal() {
    const walletAddress = document.getElementById('wallet-address').value.trim();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    
    // Validation
    if (!walletAddress) {
        showToast('Please enter a wallet address', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    const minAmount = MIN_WITHDRAWALS[selectedCrypto];
    if (amount < minAmount) {
        showToast(`Minimum withdrawal is ${minAmount} ${selectedCrypto}`, 'error');
        return;
    }
    
    const balance = USER_BALANCES[selectedCrypto];
    if (amount > balance) {
        showToast('Insufficient balance', 'error');
        return;
    }
    
    // Update review screen
    const price = cryptoPrices[selectedCrypto]?.price || 0;
    const fiatValue = amount * price;
    const finalAmount = amount * 0.99; // Estimate 1% network fee
    
    document.getElementById('review-crypto').textContent = `${CRYPTO_NAMES[selectedCrypto]} (${selectedCrypto})`;
    document.getElementById('review-amount').textContent = `${amount.toFixed(8)} ${selectedCrypto}`;
    document.getElementById('review-usd').textContent = `$${fiatValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('review-address').textContent = walletAddress;
    document.getElementById('review-final-amount').textContent = `~${finalAmount.toFixed(8)} ${selectedCrypto}`;
    
    // Store withdrawal data
    currentWithdrawalData = {
        cryptocurrency: selectedCrypto,
        quantity: amount,
        wallet_address: walletAddress
    };
    
    showWithdrawStep(2);
}

/**
 * Submit withdrawal request
 */
async function submitWithdrawal() {
    if (!currentWithdrawalData) return;
    
    try {
        // Show loading state
        const submitBtn = document.querySelector('#withdraw-step-2 .modal-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        submitBtn.disabled = true;
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
        
        const response = await fetch(API_ENDPOINTS.WITHDRAW_FUNDS, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken,
            },
            body: JSON.stringify(currentWithdrawalData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.message) {
            // Update success screen
            const transaction = data.transaction;
            document.getElementById('success-transaction-id').textContent = transaction.id;
            document.getElementById('success-amount').textContent = 
                `${parseFloat(transaction.quantity).toFixed(8)} ${selectedCrypto}`;
            
            showWithdrawStep(3);
            showToast('Withdrawal request submitted successfully!', 'success');
            
            // Reload withdrawals and balance
            setTimeout(() => {
                loadRecentWithdrawals();
                loadTotalCryptoBalance();
            }, 1000);
        } else {
            throw new Error(data.error || 'Withdrawal failed');
        }
    } catch (error) {
        console.error('❌ Error submitting withdrawal:', error);
        showToast(error.message || 'Failed to submit withdrawal', 'error');
        
        // Restore button
        const submitBtn = document.querySelector('#withdraw-step-2 .modal-btn');
        submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirm Withdrawal';
        submitBtn.disabled = false;
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    }[type] || 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// INITIALIZATION ON PAGE LOAD
// ========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithdrawSystem);
} else {
    initializeWithdrawSystem();
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});

// Reload withdrawals when page becomes visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadRecentWithdrawals();
        loadCryptoPrices();
    }
});

console.log('✅ withdraw.js fully loaded and ready');
