// buy.js
// Buy Crypto page logic: UI, API, and email verification integration

// Toast Notification System
function showToast(message, type = 'info', duration = 4000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    // Set icon based on type
    let icon = '';
    switch(type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i>';
            break;
    }

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add styles
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 500px;
        padding: 16px 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease-out;
        border-left: 4px solid;
    `;

    // Set border color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    toast.style.borderLeftColor = colors[type] || colors.info;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add toast animations to document
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        .toast-notification {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }
        .toast-icon {
            font-size: 20px;
            flex-shrink: 0;
        }
        .toast-success .toast-icon { color: #10b981; }
        .toast-error .toast-icon { color: #ef4444; }
        .toast-warning .toast-icon { color: #f59e0b; }
        .toast-info .toast-icon { color: #3b82f6; }
        .toast-message {
            flex: 1;
            color: #1f2937;
            font-size: 14px;
            line-height: 1.5;
        }
        .toast-close {
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        .toast-close:hover {
            background-color: #f3f4f6;
        }
    `;
    document.head.appendChild(style);
}

// DOM Elements
const cryptoCardsContainer = document.getElementById('crypto-cards-container');
const cryptoSelect = document.getElementById('crypto-select');
const selectedCryptoInfo = document.getElementById('selected-crypto-info');
const currentPriceSpan = document.getElementById('current-price');
const priceChangeSpan = document.getElementById('price-change');
const quantityInput = document.getElementById('quantity-input');
const cryptoSymbolSpan = document.getElementById('crypto-symbol');
const subtotalAmount = document.getElementById('subtotal-amount');
const networkFee = document.getElementById('network-fee');
const totalCost = document.getElementById('total-cost');
const buyForm = document.getElementById('buy-crypto-form');
const buySubmitBtn = document.getElementById('buy-submit-btn');
const buyConfirmModal = document.getElementById('buyConfirmModal');
const confirmCrypto = document.getElementById('confirm-crypto');
const confirmQuantity = document.getElementById('confirm-quantity');
const confirmPrice = document.getElementById('confirm-price');
const confirmTotal = document.getElementById('confirm-total');
const confirmBuyBtn = document.getElementById('confirm-buy-btn');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const emailVerificationModal = document.getElementById('emailVerificationModal');
const successModal = document.getElementById('successModal');
const availableBalanceSpan = document.getElementById('currency-balance');
const recentTransactionsList = document.getElementById('recent-transactions');

// State
let selectedCrypto = null;
let selectedCryptoData = null;
let buyAmount = 0;
let buyPrice = 0;
let buyTotal = 0;
let buyNetworkFee = 0;
let buySubtotal = 0;
let confirmationCode = '';
let exchangeRate = 1.0; // USD to user's currency
let userCurrency = 'USD';
let currencySymbol = '$';

// Fetch exchange rate on page load
async function fetchExchangeRate() {
    try {
        const response = await fetch('/api/exchange-rate/', {
            headers: {
                'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
            }
        });
        const data = await response.json();
        if (data.success) {
            exchangeRate = data.exchange_rate;
            userCurrency = data.user_currency;
            currencySymbol = data.currency_symbol;
            console.log(`Exchange rate loaded: 1 USD = ${exchangeRate} ${userCurrency}`);
        }
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        // Use defaults (USD)
    }
}

// Call on page load
fetchExchangeRate();

// Render crypto cards from market data
window.renderCryptoCards = function(cryptos) {
    cryptoCardsContainer.innerHTML = '';
    if (!cryptos || cryptos.length === 0) {
        cryptoCardsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>No market data available.</p></div>';
        return;
    }
    cryptos.forEach(crypto => {
        const card = document.createElement('div');
        card.className = 'crypto-card';
        card.innerHTML = `
            <div class="crypto-header">
                <span class="crypto-symbol">${crypto.symbol}</span>
                <span class="crypto-name">${crypto.name}</span>
            </div>
            <div class="crypto-details">
                <div class="detail-row"><span>Price:</span> <span>$${parseFloat(crypto.current_price).toFixed(2)}</span></div>
                <div class="detail-row"><span>Market Cap:</span> <span>$${parseFloat(crypto.market_cap).toLocaleString()}</span></div>
                <div class="detail-row"><span>24h Change:</span> <span class="${crypto.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">${parseFloat(crypto.price_change_percentage_24h).toFixed(2)}%</span></div>
            </div>
            <button class="btn-buy" data-symbol="${crypto.symbol}">Buy</button>
        `;
        card.querySelector('.btn-buy').addEventListener('click', () => {
            selectCrypto(crypto);
            showBuyModal();
        });
        cryptoCardsContainer.appendChild(card);
    });
    // Populate select dropdown
    cryptoSelect.innerHTML = '<option value="">-- Select Crypto --</option>';
    cryptos.forEach(crypto => {
        const option = document.createElement('option');
        option.value = crypto.symbol;
        option.textContent = `${crypto.name} (${crypto.symbol})`;
        cryptoSelect.appendChild(option);
    });
};

// Update price for a specific crypto card (real-time)
window.updateCryptoCardPrice = function(priceData) {
    // Optionally update card UI if needed
};

// Select crypto from card or dropdown
function selectCrypto(crypto) {
    selectedCrypto = crypto.symbol;
    selectedCryptoData = crypto;
    cryptoSelect.value = crypto.symbol;
    updateSelectedCryptoInfo();
}

cryptoSelect.addEventListener('change', function() {
    const symbol = this.value;
    if (!symbol) {
        selectedCrypto = null;
        selectedCryptoData = null;
        selectedCryptoInfo.style.display = 'none';
        cryptoSymbolSpan.textContent = 'CRYPTO';
        return;
    }
    // Find crypto data
    const crypto = (window.cryptoMarketData || []).find(c => c.symbol === symbol);
    if (crypto) {
        selectCrypto(crypto);
    }
});

function updateSelectedCryptoInfo() {
    if (!selectedCryptoData) {
        selectedCryptoInfo.style.display = 'none';
        cryptoSymbolSpan.textContent = 'CRYPTO';
        return;
    }
    selectedCryptoInfo.style.display = 'block';
    currentPriceSpan.textContent = `$${parseFloat(selectedCryptoData.current_price).toFixed(2)}`;
    priceChangeSpan.textContent = `${parseFloat(selectedCryptoData.price_change_percentage_24h).toFixed(2)}%`;
    cryptoSymbolSpan.textContent = selectedCryptoData.symbol;
    buyPrice = parseFloat(selectedCryptoData.current_price);
    calculateTotals();
}

quantityInput.addEventListener('input', function() {
    buyAmount = parseFloat(this.value) || 0;
    calculateTotals();
});

function calculateTotals() {
    if (!selectedCryptoData || !buyAmount || buyAmount <= 0) {
        subtotalAmount.textContent = '$0.00';
        networkFee.textContent = '$0.00';
        totalCost.textContent = '$0.00';
        return;
    }
    // Calculate in USD first
    buySubtotal = buyAmount * buyPrice;
    buyNetworkFee = buySubtotal * 0.001;
    buyTotal = buySubtotal + buyNetworkFee;
    
    // Convert to user's currency
    const subtotalInUserCurrency = buySubtotal * exchangeRate;
    const feeInUserCurrency = buyNetworkFee * exchangeRate;
    const totalInUserCurrency = buyTotal * exchangeRate;
    
    // Display in user's currency
    subtotalAmount.textContent = `${currencySymbol}${subtotalInUserCurrency.toFixed(2)}`;
    networkFee.textContent = `${currencySymbol}${feeInUserCurrency.toFixed(2)}`;
    totalCost.textContent = `${currencySymbol}${totalInUserCurrency.toFixed(2)}`;
    
    // Show USD equivalent if not USD
    if (userCurrency !== 'USD') {
        subtotalAmount.title = `USD $${buySubtotal.toFixed(2)}`;
        networkFee.title = `USD $${buyNetworkFee.toFixed(2)}`;
        totalCost.title = `USD $${buyTotal.toFixed(2)}`;
    }
}

buyForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validate cryptocurrency selection
    if (!selectedCryptoData || !buyAmount || buyAmount <= 0) {
        showToast('Please select a cryptocurrency and enter a valid amount.', 'warning');
        return;
    }
    
    // Check available balance before showing confirmation
    const availableBalance = parseFloat(availableBalanceSpan.textContent.replace(/,/g, ''));
    
    if (isNaN(availableBalance)) {
        showToast('Unable to verify balance. Please refresh the page.', 'error');
        return;
    }
    
    // Calculate total in user's currency
    const totalInUserCurrency = buyTotal * exchangeRate;
    
    // Check if user has sufficient balance (comparing in user's currency)
    if (totalInUserCurrency > availableBalance) {
        const shortfall = totalInUserCurrency - availableBalance;
        showToast(
            `Insufficient balance! You need ${currencySymbol}${totalInUserCurrency.toFixed(2)} but only have ${currencySymbol}${availableBalance.toFixed(2)}. Shortfall: ${currencySymbol}${shortfall.toFixed(2)}`,
            'error',
            6000
        );
        return;
    }
    
    // Balance is sufficient - show success toast and confirmation modal
    showToast(
        `Balance verified! Proceeding with purchase of ${buyAmount} ${selectedCryptoData.symbol}`,
        'success',
        3000
    );
    
    // Show confirmation modal (amounts in user's currency)
    confirmCrypto.textContent = selectedCryptoData.symbol;
    confirmQuantity.textContent = buyAmount;
    confirmPrice.textContent = `${currencySymbol}${(buyPrice * exchangeRate).toFixed(2)}`;
    confirmTotal.textContent = `${currencySymbol}${totalInUserCurrency.toFixed(2)}`;
    showModal(buyConfirmModal);
});

function showBuyModal() {
    // Pre-fill modal with selected crypto
    confirmCrypto.textContent = selectedCryptoData.symbol;
    confirmQuantity.textContent = buyAmount;
    confirmPrice.textContent = `$${buyPrice.toFixed(2)}`;
    confirmTotal.textContent = `$${buyTotal.toFixed(2)}`;
    showModal(buyConfirmModal);
}

function showModal(modal) {
    if (modal) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

// Confirm buy button event listener
confirmBuyBtn.addEventListener('click', function() {
    // Double-check balance before API call
    const availableBalance = parseFloat(availableBalanceSpan.textContent.replace(/,/g, ''));
    
    if (buyTotal > availableBalance) {
        showToast('Insufficient balance. Please deposit funds before buying crypto.', 'error', 5000);
        return;
    }
    
    // Call backend API to create buy transaction and send email code
    buySubmitBtn.disabled = true;
    confirmBuyBtn.disabled = true;
    
    showToast('Processing your purchase...', 'info', 3000);
    
    fetch('/api/trading/buy/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({
            transaction_type: 'BUY',
            cryptocurrency: selectedCryptoData.symbol,
            quantity: buyAmount,
            price_per_unit: buyPrice,
            total_amount: buyTotal,
            currency: 'USD',
        })
    })
    .then(response => response.json())
    .then(data => {
        buySubmitBtn.disabled = false;
        confirmBuyBtn.disabled = false;
        
        if (data.error) {
            // Show error toast with details
            const errorMessage = data.message || data.error;
            showToast(errorMessage, 'error', 6000);
            return;
        }
        
        // Success - show verification modal
        showToast('Purchase initiated! Check your email for verification code.', 'success', 4000);
        
        // Close confirmation modal
        const confirmModal = bootstrap.Modal.getInstance(buyConfirmModal);
        if (confirmModal) confirmModal.hide();
        
        // Show email verification modal
        showModal(emailVerificationModal);
        
        // Store transaction ID for verification
        window.currentBuyTransactionId = data.transaction ? data.transaction.id : null;
    })
    .catch(error => {
        buySubmitBtn.disabled = false;
        confirmBuyBtn.disabled = false;
        showToast('Failed to execute buy order. Please try again.', 'error', 5000);
        console.error('Buy API error:', error);
    });
});

// Email code verification
verifyCodeBtn.addEventListener('click', function() {
    // Collect code from input fields
    const codeInputs = emailVerificationModal.querySelectorAll('.code-digit');
    let code = '';
    codeInputs.forEach(input => {
        code += input.value;
    });
    
    if (code.length !== 6) {
        showToast('Please enter the complete 6-digit verification code.', 'warning', 4000);
        return;
    }
    
    // Disable button during verification
    verifyCodeBtn.disabled = true;
    showToast('Verifying code...', 'info', 2000);
    
    // Call backend API to verify code
    fetch('/api/trading/verify-buy-code/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.json())
    .then(data => {
        verifyCodeBtn.disabled = false;
        
        if (data.success) {
            showToast('Purchase verified successfully! Your crypto has been added to your wallet.', 'success', 5000);
            
            // Close verification modal
            const verifyModal = bootstrap.Modal.getInstance(emailVerificationModal);
            if (verifyModal) verifyModal.hide();
            
            // Show success modal
            showModal(successModal);
            
            // Update portfolio UI
            updatePortfolioUI();
        } else {
            const errorMsg = data.message || data.error || 'Invalid or expired code.';
            showToast(errorMsg, 'error', 5000);
        }
    })
    .catch(error => {
        verifyCodeBtn.disabled = false;
        showToast('Failed to verify code. Please try again.', 'error', 5000);
        console.error('Verify code error:', error);
    });
});

// Resend code
const resendCodeBtn = document.getElementById('resend-code');
resendCodeBtn.addEventListener('click', function(e) {
    e.preventDefault();
    
    showToast('Resending verification code...', 'info', 2000);
    
    fetch('/password-reset/resend-code/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
        },
        body: JSON.stringify({ email: '{{ user.email }}' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Verification code resent to your email successfully!', 'success', 4000);
        } else {
            showToast(data.error || 'Failed to resend code. Please try again.', 'error', 4000);
        }
    })
    .catch(error => {
        showToast('Failed to resend code. Please try again later.', 'error', 4000);
        console.error('Resend code error:', error);
    });
});

function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') return value;
    }
    return '';
}

function updatePortfolioUI() {
    // Optionally fetch and update portfolio section in real-time
    // You can use WebSocket or API to refresh holdings
    // For now, reload page
    window.location.reload();
}

// Initial fetch if needed
if (window.cryptoMarketData) {
    window.renderCryptoCards(window.cryptoMarketData);
}
