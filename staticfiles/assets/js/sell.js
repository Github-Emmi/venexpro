/**
 * sell.js - Cryptocurrency Selling Interface
 * Handles portfolio display, sell form, verification, and real-time updates
 */

// ====================================================================
// GLOBAL VARIABLES
// ====================================================================

let userCurrencyType = 'USD';
let userExchangeRate = 1;
let currencySymbol = '$';
let userPortfolio = [];
let currentCryptoData = null;
let marketPrices = {};
let pendingTransactionData = null;

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
}

function formatNumber(num, decimals = 2) {
    return parseFloat(num).toFixed(decimals);
}

function formatCrypto(num) {
    return parseFloat(num).toFixed(8);
}

// ====================================================================
// TOAST NOTIFICATION SYSTEM
// ====================================================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type} show`;
    
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-times-circle',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ====================================================================
// PORTFOLIO LOADING
// ====================================================================

async function loadPortfolio() {
    try {
        // First try to load from Portfolio model
        const response = await fetch('/api/portfolio/data/');
        const data = await response.json();
        
        console.log('Portfolio API response:', data);
        
        if (data.portfolio && Array.isArray(data.portfolio) && data.portfolio.length > 0) {
            // Filter items with balance > 0 (using total_quantity field)
            userPortfolio = data.portfolio.filter(item => parseFloat(item.total_quantity || 0) > 0);
            console.log('Filtered portfolio:', userPortfolio);
            
            if (userPortfolio.length > 0) {
                renderPortfolio(userPortfolio);
                populateCryptoSelect(userPortfolio);
                return;
            }
        }
        
        // If no portfolio entries, try to load from user balances directly
        await loadFromUserBalances();
        
    } catch (error) {
        console.error('Error loading portfolio:', error);
        showToast('Failed to load portfolio', 'error');
        showEmptyPortfolio();
    }
}

async function loadFromUserBalances() {
    try {
        // Fetch user profile which includes crypto balances
        const response = await fetch('/api/user/profile/');
        const data = await response.json();
        
        console.log('User profile response:', data);
        
        if (data.user || data) {
            const user = data.user || data;
            
            // Create portfolio array from user balances
            const cryptos = [
                { symbol: 'BTC', field: 'btc_balance', name: 'Bitcoin' },
                { symbol: 'ETH', field: 'ethereum_balance', name: 'Ethereum' },
                { symbol: 'USDT', field: 'usdt_balance', name: 'Tether' },
                { symbol: 'LTC', field: 'litecoin_balance', name: 'Litecoin' },
                { symbol: 'TRX', field: 'tron_balance', name: 'Tron' }
            ];
            
            userPortfolio = [];
            
            for (const crypto of cryptos) {
                const balance = parseFloat(user[crypto.field] || 0);
                if (balance > 0) {
                    userPortfolio.push({
                        cryptocurrency: crypto.symbol,
                        total_quantity: balance,
                        current_value: 0, // Will be updated by WebSocket
                        profit_loss_percentage: 0,
                        average_buy_price: 0
                    });
                }
            }
            
            console.log('Portfolio from user balances:', userPortfolio);
            
            if (userPortfolio.length > 0) {
                renderPortfolio(userPortfolio);
                populateCryptoSelect(userPortfolio);
            } else {
                showEmptyPortfolio();
            }
        } else {
            showEmptyPortfolio();
        }
        
    } catch (error) {
        console.error('Error loading user balances:', error);
        showEmptyPortfolio();
    }
}

function renderPortfolio(portfolio) {
    const container = document.getElementById('portfolio-cards-container');
    
    if (!portfolio || portfolio.length === 0) {
        showEmptyPortfolio();
        return;
    }
    
    container.innerHTML = '';
    
    portfolio.forEach(item => {
        const crypto = item.cryptocurrency; // This is a string like "BTC"
        const quantity = parseFloat(item.total_quantity || 0);
        const currentValue = parseFloat(item.current_value || 0);
        const profitLoss = parseFloat(item.profit_loss_percentage || 0);
        
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        card.innerHTML = `
            <div class="portfolio-card-header">
                <div class="crypto-info">
                    <span class="crypto-symbol">${crypto}</span>
                    <span class="crypto-name">${getCryptoName(crypto)}</span>
                </div>
                <div class="crypto-amount">
                    ${formatCrypto(quantity)} ${crypto}
                </div>
            </div>
            <div class="portfolio-card-body">
                <div class="portfolio-stat">
                    <span class="stat-label">Value</span>
                    <span class="stat-value">$${formatNumber(currentValue)}</span>
                </div>
                <div class="portfolio-stat">
                    <span class="stat-label">P/L</span>
                    <span class="stat-value ${profitLoss >= 0 ? 'positive' : 'negative'}">
                        ${profitLoss >= 0 ? '+' : ''}${formatNumber(profitLoss)}%
                    </span>
                </div>
            </div>
            <button class="btn-sell-asset" data-symbol="${crypto}">
                <i class="fas fa-hand-holding-usd"></i> Sell
            </button>
        `;
        
        card.querySelector('.btn-sell-asset').addEventListener('click', () => {
            selectCryptoFromPortfolio(item);
        });
        
        container.appendChild(card);
    });
    
    document.getElementById('empty-portfolio').style.display = 'none';
}

function getCryptoName(symbol) {
    const names = {
        'BTC': 'Bitcoin',
        'ETH': 'Ethereum',
        'USDT': 'Tether',
        'LTC': 'Litecoin',
        'TRX': 'Tron'
    };
    return names[symbol] || symbol;
}

function showEmptyPortfolio() {
    const container = document.getElementById('portfolio-cards-container');
    container.innerHTML = '';
    const emptyDiv = document.getElementById('empty-portfolio');
    if (emptyDiv) {
        emptyDiv.style.display = 'block';
    }
    
    // Also populate the select dropdown with all cryptos (disabled)
    populateCryptoSelect([]);
    
    showToast('Your portfolio is empty. Buy some cryptocurrency first!', 'info');
}

function populateCryptoSelect(portfolio) {
    const select = document.getElementById('sell-crypto-select');
    select.innerHTML = '<option value="">Choose cryptocurrency to sell</option>';
    
    if (!portfolio || portfolio.length === 0) {
        // If no portfolio, show all cryptos but user can't actually sell
        const allCryptos = [
            { symbol: 'BTC', name: 'Bitcoin' },
            { symbol: 'ETH', name: 'Ethereum' },
            { symbol: 'USDT', name: 'Tether' },
            { symbol: 'LTC', name: 'Litecoin' },
            { symbol: 'TRX', name: 'Tron' }
        ];
        
        allCryptos.forEach(crypto => {
            const option = document.createElement('option');
            option.value = crypto.symbol;
            option.textContent = `${crypto.name} (0.00000000 ${crypto.symbol})`;
            option.dataset.quantity = 0;
            option.dataset.symbol = crypto.symbol;
            option.disabled = true; // Disable since user has no balance
            select.appendChild(option);
        });
        return;
    }
    
    portfolio.forEach(item => {
        const crypto = item.cryptocurrency; // String like "BTC"
        const quantity = parseFloat(item.total_quantity || 0);
        const option = document.createElement('option');
        option.value = crypto;
        option.textContent = `${getCryptoName(crypto)} (${formatCrypto(quantity)} ${crypto})`;
        option.dataset.quantity = quantity;
        option.dataset.symbol = crypto;
        select.appendChild(option);
    });
}

function selectCryptoFromPortfolio(portfolioItem) {
    const select = document.getElementById('sell-crypto-select');
    select.value = portfolioItem.cryptocurrency; // String like "BTC"
    select.dispatchEvent(new Event('change'));
    
    // Scroll to form
    document.getElementById('sell-crypto-form').scrollIntoView({ behavior: 'smooth' });
}

// ====================================================================
// CURRENCY CONVERSION
// ====================================================================

async function fetchExchangeRate() {
    try {
        const response = await fetch('/api/exchange-rate/');
        const data = await response.json();
        
        console.log('Exchange rate API response:', data);
        
        if (data.success && data.exchange_rate) {
            userExchangeRate = data.exchange_rate;
            userCurrencyType = data.user_currency;
            currencySymbol = data.currency_symbol;
            console.log(`Currency set to: ${userCurrencyType}, Rate: ${userExchangeRate}, Symbol: ${currencySymbol}`);
        }
    } catch (error) {
        console.error('Exchange rate error:', error);
    }
}

function convertToUserCurrency(usdAmount) {
    return usdAmount * userExchangeRate;
}

// ====================================================================
// FORM HANDLING
// ====================================================================

document.getElementById('sell-crypto-select').addEventListener('change', function() {
    const symbol = this.value;
    
    if (!symbol) {
        document.getElementById('sell-crypto-info').style.display = 'none';
        document.getElementById('sell-crypto-symbol').textContent = 'CRYPTO';
        currentCryptoData = null;
        return;
    }
    
    // Find portfolio item
    const portfolioItem = userPortfolio.find(p => p.cryptocurrency === symbol);
    
    if (portfolioItem) {
        currentCryptoData = portfolioItem;
        
        // Get price from marketPrices or portfolio data
        const price = marketPrices[symbol] || parseFloat(portfolioItem.average_buy_price || 0);
        const balance = parseFloat(portfolioItem.total_quantity || 0);
        const profitLoss = parseFloat(portfolioItem.profit_loss_percentage || 0);
        
        document.getElementById('sell-current-price').textContent = `$${formatNumber(price)}`;
        document.getElementById('crypto-balance').textContent = formatCrypto(balance);
        document.getElementById('available-amount').textContent = formatCrypto(balance);
        document.getElementById('profit-loss').textContent = `${profitLoss >= 0 ? '+' : ''}${formatNumber(profitLoss)}%`;
        document.getElementById('profit-loss').className = `info-value ${profitLoss >= 0 ? 'positive' : 'negative'}`;
        document.getElementById('sell-crypto-symbol').textContent = symbol;
        document.getElementById('sell-crypto-info').style.display = 'block';
        
        calculateSellTotal();
    }
});

document.getElementById('sell-quantity-input').addEventListener('input', calculateSellTotal);

function calculateSellTotal() {
    const quantity = parseFloat(document.getElementById('sell-quantity-input').value) || 0;
    const symbol = document.getElementById('sell-crypto-select').value;
    
    if (!symbol || !currentCryptoData || quantity === 0) {
        const defaultDisplay = userCurrencyType !== 'USD' ? `${currencySymbol}0.00` : '$0.00';
        document.getElementById('sell-subtotal').textContent = defaultDisplay;
        document.getElementById('sell-network-fee').textContent = defaultDisplay;
        document.getElementById('sell-total-receive').textContent = defaultDisplay;
        return;
    }
    
    const price = marketPrices[symbol] || parseFloat(currentCryptoData.average_buy_price || 0);
    const subtotal = quantity * price;
    const networkFee = subtotal * 0.001; // 0.1%
    const total = subtotal - networkFee;
    
    // Convert all values to user currency
    const subtotalUserCurrency = convertToUserCurrency(subtotal);
    const networkFeeUserCurrency = convertToUserCurrency(networkFee);
    const totalUserCurrency = convertToUserCurrency(total);
    
    // Display in user's currency type
    if (userCurrencyType !== 'USD') {
        document.getElementById('sell-subtotal').textContent = 
            `${currencySymbol}${formatNumber(subtotalUserCurrency)} ${userCurrencyType}`;
        document.getElementById('sell-network-fee').textContent = 
            `${currencySymbol}${formatNumber(networkFeeUserCurrency)} ${userCurrencyType}`;
        document.getElementById('sell-total-receive').textContent = 
            `${currencySymbol}${formatNumber(totalUserCurrency)} ${userCurrencyType}`;
    } else {
        document.getElementById('sell-subtotal').textContent = `$${formatNumber(subtotal)}`;
        document.getElementById('sell-network-fee').textContent = `$${formatNumber(networkFee)}`;
        document.getElementById('sell-total-receive').textContent = `$${formatNumber(total)}`;
    }
}

// ====================================================================
// FORM SUBMISSION
// ====================================================================

document.getElementById('sell-crypto-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const symbol = document.getElementById('sell-crypto-select').value;
    const quantity = parseFloat(document.getElementById('sell-quantity-input').value) || 0;
    const walletAddress = document.getElementById('wallet-address-input').value.trim();
    
    // Validation
    if (!symbol) {
        showToast('Please select a cryptocurrency', 'error');
        return;
    }
    
    if (quantity <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    if (!currentCryptoData) {
        showToast('No portfolio data found', 'error');
        return;
    }
    
    const balance = parseFloat(currentCryptoData.total_quantity || 0);
    if (quantity > balance) {
        showToast(`Insufficient balance. You have ${formatCrypto(balance)} ${symbol}`, 'error');
        return;
    }
    
    // Prepare confirmation data
    const price = marketPrices[symbol] || parseFloat(currentCryptoData.average_buy_price || 0);
    const subtotal = quantity * price;
    const networkFee = subtotal * 0.001;
    const total = subtotal - networkFee;
    const totalUserCurrency = convertToUserCurrency(total);
    
    // Update confirmation modal
    document.getElementById('confirm-sell-crypto').textContent = symbol;
    document.getElementById('confirm-sell-quantity').textContent = `${formatCrypto(quantity)} ${symbol}`;
    document.getElementById('confirm-sell-price').textContent = `$${formatNumber(price)}`;
    
    if (userCurrencyType !== 'USD') {
        document.getElementById('confirm-sell-total').textContent = 
            `${currencySymbol}${formatNumber(totalUserCurrency)} ${userCurrencyType}`;
    } else {
        document.getElementById('confirm-sell-total').textContent = `$${formatNumber(total)}`;
    }
    
    if (walletAddress) {
        document.getElementById('wallet-destination-row').style.display = 'flex';
        document.getElementById('confirm-wallet-address').textContent = walletAddress;
    } else {
        document.getElementById('wallet-destination-row').style.display = 'none';
    }
    
    // Show confirmation modal
    const modal = new bootstrap.Modal(document.getElementById('sellConfirmModal'));
    modal.show();
});

// ====================================================================
// CONFIRMATION & API SUBMISSION
// ====================================================================

document.getElementById('confirm-sell-btn').addEventListener('click', async function() {
    const btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    const symbol = document.getElementById('sell-crypto-select').value;
    const quantity = parseFloat(document.getElementById('sell-quantity-input').value);
    const walletAddress = document.getElementById('wallet-address-input').value.trim();
    
    try {
        const response = await fetch('/api/trading/sell/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                cryptocurrency: symbol,
                amount: quantity,
                wallet_address: walletAddress || 'ACCOUNT_BALANCE'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            pendingTransactionData = data;
            
            // Close confirmation modal
            bootstrap.Modal.getInstance(document.getElementById('sellConfirmModal')).hide();
            
            // Show verification modal
            showToast('Verification code sent to your email', 'success');
            const verifyModal = new bootstrap.Modal(document.getElementById('sellVerificationModal'));
            verifyModal.show();
            
            // Focus first code input
            setTimeout(() => {
                document.querySelector('.code-digit-sell').focus();
            }, 500);
            
        } else {
            showToast(data.message || 'Sale failed', 'error');
        }
        
    } catch (error) {
        console.error('Sell error:', error);
        showToast('An error occurred. Please try again', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Confirm Sale';
    }
});

// ====================================================================
// VERIFICATION CODE HANDLING
// ====================================================================

// Auto-advance code inputs
document.querySelectorAll('.code-digit-sell').forEach((input, index) => {
    input.addEventListener('input', function(e) {
        if (this.value.length === 1 && index < 5) {
            document.querySelectorAll('.code-digit-sell')[index + 1].focus();
        }
    });
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && this.value === '' && index > 0) {
            document.querySelectorAll('.code-digit-sell')[index - 1].focus();
        }
    });
});

document.getElementById('verify-sell-code-btn').addEventListener('click', async function() {
    const btn = this;
    const digits = Array.from(document.querySelectorAll('.code-digit-sell'));
    const code = digits.map(d => d.value).join('');
    
    if (code.length !== 6) {
        showToast('Please enter the complete 6-digit code', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    
    try {
        const response = await fetch('/api/trading/verify-sell-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ code: code })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Close verification modal
            bootstrap.Modal.getInstance(document.getElementById('sellVerificationModal')).hide();
            
            // Show success modal
            const proceeds = convertToUserCurrency(pendingTransactionData.net_proceeds || 0);
            document.getElementById('success-amount').textContent = 
                `${currencySymbol}${formatNumber(proceeds)} ${userCurrencyType}`;
            
            const successModal = new bootstrap.Modal(document.getElementById('sellSuccessModal'));
            successModal.show();
            
            // Reset form
            document.getElementById('sell-crypto-form').reset();
            document.getElementById('sell-crypto-info').style.display = 'none';
            calculateSellTotal();
            
            // Clear code inputs
            digits.forEach(d => d.value = '');
            
            // Reload portfolio after 2 seconds
            setTimeout(() => {
                location.reload();
            }, 2000);
            
        } else {
            showToast(data.message || 'Verification failed', 'error');
        }
        
    } catch (error) {
        console.error('Verification error:', error);
        showToast('Verification error. Please try again', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Verify & Complete';
    }
});

// Resend code
document.getElementById('resend-sell-code').addEventListener('click', async function(e) {
    e.preventDefault();
    
    const symbol = document.getElementById('sell-crypto-select').value;
    const quantity = parseFloat(document.getElementById('sell-quantity-input').value);
    const walletAddress = document.getElementById('wallet-address-input').value.trim();
    
    try {
        const response = await fetch('/api/trading/sell/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                cryptocurrency: symbol,
                amount: quantity,
                wallet_address: walletAddress || 'ACCOUNT_BALANCE'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('New verification code sent', 'success');
        } else {
            showToast('Failed to resend code', 'error');
        }
        
    } catch (error) {
        showToast('Error resending code', 'error');
    }
});

// ====================================================================
// WEBSOCKET PRICE UPDATES
// ====================================================================

window.updateSellPagePrice = function(symbol, price) {
    marketPrices[symbol] = price;
    
    // Update if currently selected
    if (document.getElementById('sell-crypto-select').value === symbol) {
        document.getElementById('sell-current-price').textContent = `$${formatNumber(price)}`;
        calculateSellTotal();
    }
    
    // Update portfolio card if visible
    const portfolioCards = document.querySelectorAll('.portfolio-card');
    portfolioCards.forEach(card => {
        const btnSymbol = card.querySelector('.btn-sell-asset')?.dataset.symbol;
        if (btnSymbol === symbol) {
            // Optionally update card display
        }
    });
};

// ====================================================================
// RECENT TRANSACTIONS
// ====================================================================

async function loadRecentSellTransactions() {
    try {
        const response = await fetch('/api/transactions/recent/?type=sell&limit=4');
        const data = await response.json();
        
        const container = document.getElementById('recent-sell-transactions');
        
        if (!data.transactions || data.transactions.length === 0) {
            container.innerHTML = `
                <p class="empty-state" style="text-align: center; color: rgba(255,255,255,0.5); padding: 2rem; font-size: 0.875rem;">
                    <i class="fas fa-inbox" style="display: block; font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    No recent sales
                </p>
            `;
            return;
        }
        
        container.innerHTML = data.transactions.map(txn => {
            const statusClass = txn.status.toLowerCase();
            const statusText = txn.status;
            const date = new Date(txn.created_at);
            const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            
            // Convert amount to user currency if needed
            const amount = parseFloat(txn.amount || 0);
            const amountDisplay = userCurrencyType !== 'USD' 
                ? `${currencySymbol}${formatNumber(amount * userExchangeRate)} ${userCurrencyType}`
                : `$${formatNumber(amount)}`;
            
            return `
                <div class="transaction-item">
                    <div class="transaction-header">
                        <span class="transaction-crypto">
                            <i class="fas fa-arrow-down" style="color: #ef4444; margin-right: 0.25rem;"></i>
                            ${txn.cryptocurrency}
                        </span>
                        <span class="transaction-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-row">
                            <span class="transaction-label">Amount</span>
                            <span class="transaction-value">${formatCrypto(txn.quantity)} ${txn.cryptocurrency}</span>
                        </div>
                        <div class="transaction-row">
                            <span class="transaction-label">Value</span>
                            <span class="transaction-value">${amountDisplay}</span>
                        </div>
                    </div>
                    <div class="transaction-date">
                        <i class="fas fa-clock"></i>
                        ${formattedDate} at ${formattedTime}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading recent transactions:', error);
        const container = document.getElementById('recent-sell-transactions');
        container.innerHTML = `
            <p class="empty-state" style="text-align: center; color: rgba(239, 68, 68, 0.6); padding: 2rem; font-size: 0.875rem;">
                <i class="fas fa-exclamation-circle" style="display: block; font-size: 2rem; margin-bottom: 0.5rem;"></i>
                Failed to load transactions
            </p>
        `;
    }
}

// ====================================================================
// INITIALIZATION
// ====================================================================

document.addEventListener('DOMContentLoaded', async function() {
    // Load initial data
    await fetchExchangeRate();
    await loadPortfolio();
    await loadRecentSellTransactions();
    
    showToast('Sell page loaded. Select a cryptocurrency to begin', 'info');
});

