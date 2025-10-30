/**
 * sell.js - Cryptocurrency Selling Interface
 * 
 * This script handles:
 * - Portfolio loading and display
 * - Form validation for selling crypto
 * - Real-time total calculation with currency conversion
 * - Email verification workflow
 * - Toast notifications
 * - Recent sales pagination
 * - Wallet address management
 * 
 * Architecture mirrors buy.js for consistency
 */

// ====================================================================
// GLOBAL VARIABLES
// ====================================================================

let userCurrencyType = 'USD'; // Default currency, will be updated from page
let userExchangeRate = 1; // Exchange rate from USD to user's currency
let currencySymbol = '$'; // Currency symbol for display
let verificationCode = ''; // Store the verification code from API response
let userPortfolio = []; // Store user's portfolio data
let currentCryptoData = {}; // Current selected crypto data
let marketPrices = {}; // Market prices from WebSocket

// ====================================================================
// DOM ELEMENTS
// ====================================================================

// Portfolio elements
const portfolioCardsContainer = document.getElementById('portfolio-cards-container');
const emptyPortfolio = document.getElementById('empty-portfolio');

// Form elements
const sellForm = document.getElementById('sell-crypto-form');
const cryptoSelect = document.getElementById('sell-crypto-select');
const amountInput = document.getElementById('sell-quantity-input');
const walletAddressInput = document.getElementById('wallet-address-input');
const cryptoInfoDisplay = document.getElementById('sell-crypto-info');
const currentPriceDisplay = document.getElementById('sell-current-price');
const cryptoBalanceDisplay = document.getElementById('crypto-balance');
const availableAmountDisplay = document.getElementById('available-amount');
const cryptoSymbolSpan = document.getElementById('sell-crypto-symbol');

// Calculation displays
const subtotalDisplay = document.getElementById('sell-subtotal');
const networkFeeDisplay = document.getElementById('sell-network-fee');
const totalReceiveDisplay = document.getElementById('sell-total-receive');

// Modal elements
const sellConfirmModal = new bootstrap.Modal(document.getElementById('sellConfirmModal'));
const sellVerificationModal = new bootstrap.Modal(document.getElementById('sellVerificationModal'));
const sellSuccessModal = new bootstrap.Modal(document.getElementById('sellSuccessModal'));

// Confirmation modal elements
const confirmCrypto = document.getElementById('confirm-sell-crypto');
const confirmQuantity = document.getElementById('confirm-sell-quantity');
const confirmPrice = document.getElementById('confirm-sell-price');
const confirmTotal = document.getElementById('confirm-sell-total');
const confirmWalletRow = document.getElementById('wallet-destination-row');
const confirmWalletAddress = document.getElementById('confirm-wallet-address');
const confirmSellBtn = document.getElementById('confirm-sell-btn');

// Verification code inputs
const codeDigits = document.querySelectorAll('.code-digit-sell');
const verifySellCodeBtn = document.getElementById('verify-sell-code-btn');
const resendSellCodeLink = document.getElementById('resend-sell-code');

// Confirmation modal elements
const confirmCrypto = document.getElementById('confirm-crypto');
const confirmAmount = document.getElementById('confirm-amount');
const confirmTotal = document.getElementById('confirm-total');
const confirmWallet = document.getElementById('confirm-wallet');
const confirmSellBtn = document.getElementById('confirmSellBtn');

// Recent sales pagination
const loadMoreSalesBtn = document.getElementById('loadMoreSales');
let currentSalesPage = 1;
const salesPerPage = 10;

// ====================================================================
// TOAST NOTIFICATION SYSTEM
// ====================================================================

/**
 * Display professional toast notifications
 * @param {string} message - The message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 * @param {number} duration - How long to show toast in ms (default: 5000)
 */
function showToast(message, type = 'info', duration = 5000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast align-items-center border-0';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Set toast color based on type
    let bgClass = 'bg-primary';
    let icon = 'ℹ️';
    
    switch(type) {
        case 'success':
            bgClass = 'bg-success';
            icon = '✓';
            break;
        case 'error':
            bgClass = 'bg-danger';
            icon = '✕';
            break;
        case 'warning':
            bgClass = 'bg-warning';
            icon = '⚠';
            break;
        case 'info':
            bgClass = 'bg-info';
            icon = 'ℹ';
            break;
    }

    toast.classList.add(bgClass, 'text-white');

    // Toast HTML
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <span class="toast-icon me-2">${icon}</span>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: duration
    });
    bsToast.show();

    // Remove from DOM after hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });

    // Add custom styling if not already present
    if (!document.getElementById('toast-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-custom-styles';
        style.textContent = `
            .toast-container .toast {
                min-width: 300px;
                box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease-out;
            }
            
            .toast-icon {
                font-size: 1.2rem;
                font-weight: bold;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .toast .toast-body {
                padding: 0.75rem;
            }
        `;
        document.head.appendChild(style);
    }
}

// ====================================================================
// CURRENCY CONVERSION FUNCTIONS
// ====================================================================

/**
 * Fetch the user's exchange rate from the server
 */
async function fetchExchangeRate() {
    try {
        const response = await fetch('/api/exchange-rate/');
        if (response.ok) {
            const data = await response.json();
            userExchangeRate = data.rate;
            userCurrencyType = data.currency;
            currencySymbol = data.symbol;
            
            console.log(`Exchange rate loaded: 1 USD = ${userExchangeRate} ${userCurrencyType}`);
        } else {
            console.error('Failed to fetch exchange rate');
            showToast('Unable to load exchange rate. Using USD.', 'warning');
        }
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        showToast('Exchange rate fetch error. Using USD.', 'warning');
    }
}

/**
 * Convert USD amount to user's currency
 * @param {number} usdAmount - Amount in USD
 * @returns {number} - Amount in user's currency
 */
function convertToUserCurrency(usdAmount) {
    return usdAmount * userExchangeRate;
}

/**
 * Format currency amount with symbol
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
function formatCurrency(amount) {
    return `${currencySymbol}${amount.toFixed(2)}`;
}

// ====================================================================
// CALCULATION FUNCTIONS
// ====================================================================

/**
 * Calculate total value and update display
 */
function calculateTotal() {
    const amount = parseFloat(amountInput.value) || 0;
    const cryptoSymbol = cryptoSelect.value;
    const cryptoPrice = parseFloat(document.getElementById('crypto-price').textContent) || 0;
    
    if (amount > 0 && cryptoPrice > 0) {
        // Calculate USD value
        const totalUSD = amount * cryptoPrice;
        
        // Convert to user's currency
        const totalUserCurrency = convertToUserCurrency(totalUSD);
        
        // Update display
        if (userCurrencyType !== 'USD') {
            totalDisplay.innerHTML = `
                ${formatCurrency(totalUserCurrency)}
                <small class="text-muted" style="font-size: 0.75rem; display: block;">
                    ($${totalUSD.toFixed(2)} USD)
                </small>
            `;
        } else {
            totalDisplay.textContent = formatCurrency(totalUSD);
        }
    } else {
        totalDisplay.textContent = formatCurrency(0);
    }
}

/**
 * Validate crypto balance
 * @returns {boolean} - True if balance is sufficient
 */
function validateBalance() {
    const amount = parseFloat(amountInput.value) || 0;
    const cryptoSymbol = cryptoSelect.value;
    
    // Get crypto balance from page
    const balanceElement = document.getElementById(`${cryptoSymbol.toLowerCase()}-balance`);
    if (!balanceElement) {
        showToast('Unable to verify balance. Please try again.', 'error');
        return false;
    }
    
    const balance = parseFloat(balanceElement.textContent) || 0;
    
    if (amount > balance) {
        const shortfall = amount - balance;
        showToast(
            `Insufficient ${cryptoSymbol} balance. You need ${shortfall.toFixed(8)} more ${cryptoSymbol}.`,
            'error'
        );
        return false;
    }
    
    if (amount <= 0) {
        showToast('Please enter a valid amount greater than 0.', 'error');
        return false;
    }
    
    return true;
}

/**
 * Validate wallet address
 * @returns {boolean} - True if wallet address is valid
 */
function validateWalletAddress() {
    const walletAddress = walletAddressInput.value.trim();
    
    if (!walletAddress) {
        showToast('Please enter a wallet address.', 'error');
        return false;
    }
    
    // Basic wallet address validation (length check)
    if (walletAddress.length < 26 || walletAddress.length > 62) {
        showToast('Wallet address appears to be invalid. Please check and try again.', 'error');
        return false;
    }
    
    return true;
}

// ====================================================================
// FORM SUBMISSION & VERIFICATION
// ====================================================================

/**
 * Handle sell form submission
 */
sellForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Validate balance
    if (!validateBalance()) {
        return;
    }
    
    // Validate wallet address
    if (!validateWalletAddress()) {
        return;
    }
    
    // Get form values
    const amount = parseFloat(amountInput.value);
    const cryptoSymbol = cryptoSelect.value;
    const cryptoPrice = parseFloat(document.getElementById('crypto-price').textContent);
    const totalUSD = amount * cryptoPrice;
    const totalUserCurrency = convertToUserCurrency(totalUSD);
    const walletAddress = walletAddressInput.value.trim();
    
    // Update confirmation modal
    confirmCrypto.textContent = cryptoSymbol;
    confirmAmount.textContent = `${amount} ${cryptoSymbol}`;
    confirmTotal.textContent = formatCurrency(totalUserCurrency);
    confirmWallet.textContent = walletAddress;
    
    // Show confirmation modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmSellModal'));
    confirmModal.show();
});

/**
 * Handle confirm sell button click
 */
confirmSellBtn.addEventListener('click', async function() {
    // Get CSRF token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    // Prepare request data
    const formData = {
        cryptocurrency: cryptoSelect.value,
        amount: parseFloat(amountInput.value),
        wallet_address: walletAddressInput.value.trim()
    };
    
    // Disable button and show loading state
    confirmSellBtn.disabled = true;
    confirmSellBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
    
    try {
        const response = await fetch('/api/trading/sell/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Store verification code
            verificationCode = data.verification_code;
            
            // Close confirmation modal
            const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmSellModal'));
            confirmModal.hide();
            
            // Show success toast
            showToast(
                `Verification code sent to ${data.email}. Please check your email.`,
                'success'
            );
            
            // Show email verification modal
            emailVerificationModal.show();
            
            // Focus on verification input
            setTimeout(() => {
                verificationCodeInput.focus();
            }, 500);
            
            // Start countdown for resend button
            startResendCountdown();
            
        } else {
            // Show error
            showToast(data.message || 'Sale failed. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error processing sale:', error);
        showToast('An error occurred. Please try again.', 'error');
        
    } finally {
        // Re-enable button
        confirmSellBtn.disabled = false;
        confirmSellBtn.innerHTML = 'Confirm Sale';
    }
});

/**
 * Handle verification code submission
 */
verifyCodeBtn.addEventListener('click', async function() {
    const code = verificationCodeInput.value.trim();
    
    if (!code || code.length !== 6) {
        showToast('Please enter a valid 6-digit verification code.', 'error');
        return;
    }
    
    // Get CSRF token
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    
    // Disable button and show loading state
    verifyCodeBtn.disabled = true;
    verifyCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';
    
    try {
        const response = await fetch('/api/trading/verify-sell-code/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({ code: code })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Close verification modal
            emailVerificationModal.hide();
            
            // Show success message
            showToast(
                data.message || 'Sale completed successfully! Funds have been added to your balance.',
                'success',
                7000
            );
            
            // Reset form
            sellForm.reset();
            calculateTotal();
            
            // Update balance display
            if (data.new_currency_balance) {
                const balanceElement = document.getElementById('currency-balance');
                if (balanceElement) {
                    balanceElement.textContent = parseFloat(data.new_currency_balance).toFixed(2);
                }
            }
            
            // Reload page after 2 seconds to update all balances
            setTimeout(() => {
                location.reload();
            }, 2000);
            
        } else {
            // Show error
            showToast(data.message || 'Verification failed. Please check your code and try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error verifying code:', error);
        showToast('Verification error. Please try again.', 'error');
        
    } finally {
        // Re-enable button
        verifyCodeBtn.disabled = false;
        verifyCodeBtn.innerHTML = 'Verify & Complete Sale';
    }
});

/**
 * Handle resend code button click
 */
resendCodeBtn.addEventListener('click', async function() {
    // Disable button
    resendCodeBtn.disabled = true;
    
    // Re-submit the sell form to get a new code
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
    const formData = {
        cryptocurrency: cryptoSelect.value,
        amount: parseFloat(amountInput.value),
        wallet_address: walletAddressInput.value.trim()
    };
    
    try {
        const response = await fetch('/api/trading/sell/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            verificationCode = data.verification_code;
            showToast('New verification code sent!', 'success');
            startResendCountdown();
        } else {
            showToast('Failed to resend code. Please try again.', 'error');
            resendCodeBtn.disabled = false;
        }
        
    } catch (error) {
        console.error('Error resending code:', error);
        showToast('Error resending code. Please try again.', 'error');
        resendCodeBtn.disabled = false;
    }
});

/**
 * Start countdown for resend button (60 seconds)
 */
function startResendCountdown() {
    let countdown = 60;
    resendCodeBtn.disabled = true;
    resendCodeBtn.textContent = `Resend Code (${countdown}s)`;
    
    const interval = setInterval(() => {
        countdown--;
        resendCodeBtn.textContent = `Resend Code (${countdown}s)`;
        
        if (countdown <= 0) {
            clearInterval(interval);
            resendCodeBtn.disabled = false;
            resendCodeBtn.textContent = 'Resend Code';
        }
    }, 1000);
}

// ====================================================================
// RECENT SALES PAGINATION
// ====================================================================

/**
 * Load more sales transactions
 */
if (loadMoreSalesBtn) {
    loadMoreSalesBtn.addEventListener('click', async function() {
        currentSalesPage++;
        
        // Disable button and show loading state
        loadMoreSalesBtn.disabled = true;
        loadMoreSalesBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';
        
        try {
            const response = await fetch(`/api/transactions/history/?page=${currentSalesPage}&type=SELL&limit=${salesPerPage}`);
            const data = await response.json();
            
            if (response.ok && data.transactions && data.transactions.length > 0) {
                // Append transactions to table
                const tbody = document.querySelector('#recentSalesTable tbody');
                data.transactions.forEach(tx => {
                    const row = createSalesRow(tx);
                    tbody.insertAdjacentHTML('beforeend', row);
                });
                
                // Hide button if no more transactions
                if (!data.has_more) {
                    loadMoreSalesBtn.style.display = 'none';
                }
            } else {
                loadMoreSalesBtn.style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error loading sales:', error);
            showToast('Failed to load more sales.', 'error');
            
        } finally {
            // Re-enable button
            loadMoreSalesBtn.disabled = false;
            loadMoreSalesBtn.innerHTML = 'Load More';
        }
    });
}

/**
 * Create HTML for sales table row
 * @param {object} tx - Transaction object
 * @returns {string} - HTML string
 */
function createSalesRow(tx) {
    const date = new Date(tx.created_at).toLocaleString();
    const statusBadge = tx.status === 'COMPLETED' ? 
        '<span class="badge bg-success">Completed</span>' : 
        '<span class="badge bg-warning">Pending</span>';
    
    return `
        <tr>
            <td>${date}</td>
            <td>${tx.cryptocurrency}</td>
            <td>${parseFloat(tx.amount).toFixed(8)}</td>
            <td>${formatCurrency(parseFloat(tx.total_cost))}</td>
            <td>${statusBadge}</td>
        </tr>
    `;
}

// ====================================================================
// EVENT LISTENERS
// ====================================================================

// Recalculate total when amount or crypto changes
amountInput.addEventListener('input', calculateTotal);
cryptoSelect.addEventListener('change', calculateTotal);

// Clear verification code input when modal is closed
document.getElementById('emailVerificationModal').addEventListener('hidden.bs.modal', function() {
    verificationCodeInput.value = '';
});

// ====================================================================
// INITIALIZATION
// ====================================================================

/**
 * Initialize page on load
 */
document.addEventListener('DOMContentLoaded', async function() {
    // Fetch exchange rate
    await fetchExchangeRate();
    
    // Calculate initial total
    calculateTotal();
    
    // Show welcome toast
    showToast('Sell cryptocurrency and receive funds in your account.', 'info', 3000);
});
