/**
 * DEPOSIT SYSTEM - Main JavaScript
 * Handles cryptocurrency and bank deposit flows
 * Features: Multi-step forms, QR code generation, real-time price updates, validation
 */

console.log('🚀 deposit.js loaded successfully');

// ========================================
// CONFIGURATION & STATE
// ========================================

const API_ENDPOINTS = {
    ADMIN_WALLETS: '/api/deposit/admin-wallets/',
    ADMIN_BANKS: '/api/deposit/admin-banks/',
    CREATE_CRYPTO_DEPOSIT: '/api/deposit/crypto/',
    CREATE_BANK_DEPOSIT: '/api/deposit/bank/',
    CRYPTO_PRICES: '/api/v1/prices/multiple/',
    RECENT_TRANSACTIONS: '/api/transactions/recent/',
    CONVERT_CURRENCY: '/api/convert-currency/',
    TOTAL_CRYPTO_VALUE: '/api/portfolio/crypto-value/',
};

const MIN_DEPOSITS = {
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

let cryptoPrices = {};
let adminWallets = {};
let adminBanks = [];
let selectedCrypto = null;
let selectedBank = null;
let currentDepositData = null;
let qrCodeInstance = null;

// ========================================
// INITIALIZATION
// ========================================

function initializeDepositSystem() {
    console.log('🎯 Initializing Deposit System...');
    
    // Load initial data
    loadCryptoPrices();
    loadAdminWallets();
    loadAdminBanks();
    loadTotalCryptoBalance();
    loadRecentDeposits();
    
    // Set up periodic updates
    setInterval(loadCryptoPrices, 60000); // Update prices every minute
    setInterval(loadTotalCryptoBalance, 60000); // Update total crypto value every minute
    setInterval(loadRecentDeposits, 30000); // Update deposits every 30 seconds
    
    // Set up crypto amount input listener
    const cryptoAmountInput = document.getElementById('crypto-amount');
    if (cryptoAmountInput) {
        cryptoAmountInput.addEventListener('input', updateFiatEquivalent);
    }
    
    // Set up bank select listener
    const bankSelect = document.getElementById('bank-select');
    if (bankSelect) {
        bankSelect.addEventListener('change', handleBankSelection);
    }
    
    // Set up bank amount input listener
    const bankAmountInput = document.getElementById('bank-amount');
    if (bankAmountInput) {
        bankAmountInput.addEventListener('input', updateBankConvertedAmount);
    }
    
    console.log('✅ Deposit System initialized');
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
            updatePriceDisplays();
        }
    } catch (error) {
        console.error('❌ Error loading crypto prices:', error);
    }
}

/**
 * Update price displays in the UI
 */
function updatePriceDisplays() {
    Object.keys(cryptoPrices).forEach(symbol => {
        const priceElement = document.getElementById(`${symbol.toLowerCase()}-price`);
        if (priceElement && cryptoPrices[symbol]) {
            const price = parseFloat(cryptoPrices[symbol].price);
            priceElement.textContent = `$${price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }
    });
}

/**
 * Load admin wallet addresses
 */
async function loadAdminWallets() {
    try {
        const response = await fetch(API_ENDPOINTS.ADMIN_WALLETS);
        
        if (!response.ok) throw new Error('Failed to load admin wallets');
        
        const data = await response.json();
        
        if (data.success && data.wallets) {
            adminWallets = data.wallets;
            console.log('🏦 Admin wallets loaded:', adminWallets);
        }
    } catch (error) {
        console.error('❌ Error loading admin wallets:', error);
        showToast('Failed to load deposit wallets. Please contact support.', 'error');
    }
}

/**
 * Load admin bank accounts
 */
async function loadAdminBanks() {
    try {
        const response = await fetch(API_ENDPOINTS.ADMIN_BANKS);
        
        if (!response.ok) throw new Error('Failed to load admin banks');
        
        const data = await response.json();
        
        if (data.success && data.banks) {
            adminBanks = data.banks;
            console.log('🏦 Admin banks loaded:', adminBanks);
            populateBankSelector();
        }
    } catch (error) {
        console.error('❌ Error loading admin banks:', error);
        showToast('Failed to load bank accounts. Please contact support.', 'error');
    }
}

/**
 * Populate bank selector dropdown
 */
function populateBankSelector() {
    const bankSelect = document.getElementById('bank-select');
    if (!bankSelect) return;
    
    bankSelect.innerHTML = '<option value="">Select a bank...</option>';
    
    adminBanks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = `${bank.bank_name} (${bank.currency_type})`;
        option.dataset.bankData = JSON.stringify(bank);
        bankSelect.appendChild(option);
    });
}

/**
 * Load total crypto balance
 */
async function loadTotalCryptoBalance() {
    try {
        const totalValueElement = document.getElementById('total-crypto-value');
        if (!totalValueElement) return;
        
        // Show loading state
        totalValueElement.textContent = '...';
        
        const response = await fetch(API_ENDPOINTS.TOTAL_CRYPTO_VALUE, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            throw new Error('Failed to load crypto value');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Format the total value with commas
            const formattedValue = parseFloat(data.total_value).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            totalValueElement.textContent = formattedValue;
            
            // Log breakdown for debugging
            console.log('💰 Total Crypto Value:', data.total_value, data.currency);
            console.log('📊 Breakdown:', data.breakdown);
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
 * Load recent deposits
 */
/**
 * Load recent deposits
 */
async function loadRecentDeposits() {
    try {
        const response = await fetch(`${API_ENDPOINTS.RECENT_TRANSACTIONS}?type=DEPOSIT&limit=4`);
        
        if (!response.ok) throw new Error('Failed to load deposits');
        
        const data = await response.json();
        
        if (data.success && data.transactions) {
            renderRecentDeposits(data.transactions);
        }
    } catch (error) {
        console.error('❌ Error loading recent deposits:', error);
    }
}

/**
 * Render recent deposits
 */
function renderRecentDeposits(deposits) {
    const depositsGrid = document.getElementById('deposits-grid');
    const emptyState = document.getElementById('deposits-empty-state');
    
    if (!depositsGrid) return;
    
    if (deposits.length === 0) {
        depositsGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    depositsGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    let html = '';
    deposits.forEach(deposit => {
        html += createDepositCard(deposit);
    });
    
    depositsGrid.innerHTML = html;
}

/**
 * Create deposit card HTML
 */
function createDepositCard(deposit) {
    const statusClass = getStatusClass(deposit.status);
    const statusIcon = getStatusIcon(deposit.status);
    
    // Handle cryptocurrency - it could be a string symbol or an object
    let cryptoSymbol = null;
    if (deposit.cryptocurrency) {
        if (typeof deposit.cryptocurrency === 'string') {
            cryptoSymbol = deposit.cryptocurrency;
        } else if (deposit.cryptocurrency.symbol) {
            cryptoSymbol = deposit.cryptocurrency.symbol;
        }
    }
    
    const isCrypto = cryptoSymbol && cryptoSymbol !== 'UNKNOWN';
    
    // Get currency for bank deposits (defaults to USD if not provided)
    const currency = deposit.currency || 'USD';
    
    return `
        <div class="deposit-card ${statusClass}">
            <div class="deposit-card-header">
                <div class="deposit-type">
                    <i class="fas ${isCrypto ? 'fa-bitcoin' : 'fa-university'}"></i>
                    <span class="deposit-type-label">${isCrypto ? cryptoSymbol : 'Bank Transfer'}</span>
                </div>
                <span class="deposit-status ${statusClass}">
                    ${statusIcon} ${deposit.status}
                </span>
            </div>
            <div class="deposit-card-body">
                <div class="deposit-amount">
                    ${isCrypto 
                        ? `${parseFloat(deposit.quantity || 0).toFixed(8)} ${cryptoSymbol}`
                        : `${currency} ${parseFloat(deposit.fiat_amount || deposit.amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                    }
                </div>
                <div class="deposit-date">
                    <i class="far fa-clock"></i>
                    ${formatDate(deposit.created_at)}
                </div>
                ${deposit.wallet_address ? `
                    <div class="deposit-wallet">
                        <i class="fas fa-wallet"></i>
                        <small>${deposit.wallet_address.substring(0, 12)}...${deposit.wallet_address.substring(deposit.wallet_address.length - 6)}</small>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Get status CSS class
 */
function getStatusClass(status) {
    const classes = {
        'PENDING': 'status-pending',
        'COMPLETED': 'status-completed',
        'FAILED': 'status-failed',
        'CANCELLED': 'status-cancelled',
    };
    return classes[status] || 'status-default';
}

/**
 * Get status icon
 */
function getStatusIcon(status) {
    const icons = {
        'PENDING': '⏳',
        'COMPLETED': '✅',
        'FAILED': '❌',
        'CANCELLED': '🚫',
    };
    return icons[status] || '📄';
}

/**
 * Format date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========================================
// CRYPTO DEPOSIT FLOW
// ========================================

/**
 * Show crypto deposit modal
 */
function showCryptoDepositModal() {
    const modal = document.getElementById('cryptoDepositModal');
    if (modal) {
        modal.classList.add('active');
        resetCryptoForm();
        showCryptoStep(1);
    }
}

/**
 * Close crypto deposit modal
 */
function closeCryptoDepositModal() {
    const modal = document.getElementById('cryptoDepositModal');
    if (modal) {
        modal.classList.remove('active');
        resetCryptoForm();
    }
}

/**
 * Reset crypto form
 */
function resetCryptoForm() {
    const form = document.getElementById('crypto-deposit-form');
    if (form) {
        form.reset();
    }
    selectedCrypto = null;
    currentDepositData = null;
    if (qrCodeInstance) {
        qrCodeInstance.clear();
    }
}

/**
 * Show crypto step
 */
function showCryptoStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('#cryptoDepositModal .form-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show target step
    const targetStep = document.getElementById(`crypto-step-${stepNumber}`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
}

/**
 * Next crypto step
 */
function nextCryptoStep() {
    // Validate cryptocurrency selection
    const selectedRadio = document.querySelector('input[name="cryptocurrency"]:checked');
    if (!selectedRadio) {
        showToast('Please select a cryptocurrency', 'warning');
        return;
    }
    
    selectedCrypto = selectedRadio.value;
    updateStep2Display();
    showCryptoStep(2);
}

/**
 * Previous crypto step
 */
function previousCryptoStep() {
    showCryptoStep(1);
}

/**
 * Update step 2 display
 */
function updateStep2Display() {
    if (!selectedCrypto) return;
    
    // Update icon
    const iconElement = document.getElementById('crypto-info-icon');
    if (iconElement) {
        iconElement.textContent = CRYPTO_ICONS[selectedCrypto];
    }
    
    // Update name
    const nameElement = document.getElementById('crypto-info-name');
    if (nameElement) {
        nameElement.textContent = CRYPTO_NAMES[selectedCrypto];
    }
    
    // Update price
    const priceElement = document.getElementById('crypto-info-price');
    if (priceElement && cryptoPrices[selectedCrypto]) {
        const price = parseFloat(cryptoPrices[selectedCrypto].price);
        priceElement.textContent = `$${price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
    // Update symbol
    const symbolElement = document.getElementById('crypto-symbol');
    if (symbolElement) {
        symbolElement.textContent = selectedCrypto;
    }
    
    // Update minimum deposit
    const minDepositElement = document.getElementById('min-deposit');
    if (minDepositElement) {
        minDepositElement.textContent = `Minimum: ${MIN_DEPOSITS[selectedCrypto]} ${selectedCrypto}`;
    }
}

/**
 * Update fiat equivalent
 */
function updateFiatEquivalent() {
    if (!selectedCrypto) return;
    
    const amountInput = document.getElementById('crypto-amount');
    const fiatElement = document.getElementById('fiat-equivalent');
    
    if (!amountInput || !fiatElement) return;
    
    const amount = parseFloat(amountInput.value) || 0;
    const price = cryptoPrices[selectedCrypto] ? parseFloat(cryptoPrices[selectedCrypto].price) : 0;
    const fiatValue = amount * price;
    
    fiatElement.textContent = `≈ $${fiatValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/**
 * Submit crypto deposit
 */
async function submitCryptoDeposit() {
    const amountInput = document.getElementById('crypto-amount');
    if (!amountInput || !selectedCrypto) return;
    
    const amount = parseFloat(amountInput.value);
    
    // Validate amount
    if (!amount || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
    }
    
    if (amount < MIN_DEPOSITS[selectedCrypto]) {
        showToast(`Minimum deposit is ${MIN_DEPOSITS[selectedCrypto]} ${selectedCrypto}`, 'error');
        return;
    }
    
    // Check if admin wallet exists
    if (!adminWallets[selectedCrypto]) {
        showToast('Admin wallet not configured for this cryptocurrency', 'error');
        return;
    }
    
    try {
        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        
        // Show loading state
        const submitBtn = event.target;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Deposit...';
        
        // Create deposit
        const response = await fetch(API_ENDPOINTS.CREATE_CRYPTO_DEPOSIT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                cryptocurrency: selectedCrypto,
                amount: amount
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentDepositData = data;
            showToast(data.message, 'success');
            updateStep3Display(data);
            showCryptoStep(3);
        } else {
            throw new Error(data.error || 'Failed to create deposit');
        }
    } catch (error) {
        console.error('❌ Error creating crypto deposit:', error);
        showToast(error.message || 'Failed to create deposit', 'error');
    } finally {
        const submitBtn = document.querySelector('#crypto-step-2 .modal-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Continue to Deposit <i class="fas fa-arrow-right"></i>';
        }
    }
}

/**
 * Update step 3 display with deposit details
 */
function updateStep3Display(data) {
    // Update amount display
    const amountDisplay = document.getElementById('deposit-amount-display');
    if (amountDisplay) {
        amountDisplay.textContent = parseFloat(data.transaction.amount).toFixed(8);
    }
    
    const cryptoDisplay = document.getElementById('deposit-crypto-display');
    if (cryptoDisplay) {
        cryptoDisplay.textContent = selectedCrypto;
    }
    
    // Update fiat display
    const fiatDisplay = document.getElementById('deposit-fiat-display');
    if (fiatDisplay && data.transaction.fiat_equivalent) {
        fiatDisplay.textContent = `≈ $${parseFloat(data.transaction.fiat_equivalent).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${data.transaction.currency}`;
    }
    
    // Update wallet address
    const walletAddressElement = document.getElementById('admin-wallet-address');
    if (walletAddressElement) {
        walletAddressElement.textContent = data.admin_wallet_address;
        walletAddressElement.dataset.address = data.admin_wallet_address;
    }
    
    // Update warning
    const warningCrypto = document.getElementById('warning-crypto');
    if (warningCrypto) {
        warningCrypto.textContent = selectedCrypto;
    }
    
    // Update transaction ID
    const transactionId = document.getElementById('transaction-id');
    if (transactionId) {
        transactionId.textContent = data.transaction.id;
    }
    
    // Generate QR code
    generateQRCode(data.admin_wallet_address);
}

/**
 * Generate QR code
 */
function generateQRCode(address) {
    const qrContainer = document.getElementById('qr-code-container');
    if (!qrContainer || !address) return;
    
    // Clear existing QR code
    qrContainer.innerHTML = '<canvas id="qr-code"></canvas>';
    
    // Generate new QR code
    try {
        if (typeof QRCode !== 'undefined') {
            qrCodeInstance = new QRCode(document.getElementById('qr-code'), {
                text: address,
                width: 250,
                height: 250,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    } catch (error) {
        console.error('❌ Error generating QR code:', error);
    }
}

/**
 * Copy wallet address
 */
function copyWalletAddress() {
    const walletAddressElement = document.getElementById('admin-wallet-address');
    if (!walletAddressElement) return;
    
    const address = walletAddressElement.dataset.address || walletAddressElement.textContent;
    
    navigator.clipboard.writeText(address).then(() => {
        showToast('Wallet address copied!', 'success');
    }).catch(error => {
        console.error('❌ Error copying address:', error);
        showToast('Failed to copy address', 'error');
    });
}

// ========================================
// BANK DEPOSIT FLOW
// ========================================

/**
 * Show bank deposit modal
 */
function showBankDepositModal() {
    const modal = document.getElementById('bankDepositModal');
    if (modal) {
        modal.classList.add('active');
        resetBankForm();
        showBankStep(1);
    }
}

/**
 * Close bank deposit modal
 */
function closeBankDepositModal() {
    const modal = document.getElementById('bankDepositModal');
    if (modal) {
        modal.classList.remove('active');
        resetBankForm();
    }
}

/**
 * Reset bank form
 */
function resetBankForm() {
    const form = document.getElementById('bank-deposit-form');
    if (form) {
        form.reset();
    }
    selectedBank = null;
    currentDepositData = null;
    
    const selectedBankInfo = document.getElementById('selected-bank-info');
    if (selectedBankInfo) {
        selectedBankInfo.style.display = 'none';
    }
}

/**
 * Show bank step
 */
function showBankStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('#bankDepositModal .form-step').forEach(step => {
        step.classList.remove('active');
    });
    
    // Show target step
    const targetStep = document.getElementById(`bank-step-${stepNumber}`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
}

/**
 * Handle bank selection
 */
function handleBankSelection(event) {
    const selectedOption = event.target.selectedOptions[0];
    if (!selectedOption || !selectedOption.dataset.bankData) {
        selectedBank = null;
        document.getElementById('selected-bank-info').style.display = 'none';
        return;
    }
    
    selectedBank = JSON.parse(selectedOption.dataset.bankData);
    
    // Show bank info
    const bankInfoCard = document.getElementById('selected-bank-info');
    if (bankInfoCard) {
        bankInfoCard.style.display = 'block';
        
        document.getElementById('bank-name-display').textContent = selectedBank.bank_name;
        document.getElementById('bank-currency-display').textContent = selectedBank.currency_type;
    }
}

/**
 * Update bank converted amount
 */
async function updateBankConvertedAmount() {
    if (!selectedBank) return;
    
    const amountInput = document.getElementById('bank-amount');
    const convertedElement = document.getElementById('bank-converted-amount');
    
    if (!amountInput || !convertedElement) return;
    
    const amount = parseFloat(amountInput.value) || 0;
    
    if (amount > 0 && selectedBank.currency_type !== 'USD') {
        try {
            // This would call currency conversion API
            convertedElement.textContent = `≈ ${amount.toFixed(2)} ${selectedBank.currency_type}`;
        } catch (error) {
            console.error('Error converting currency:', error);
        }
    } else {
        convertedElement.textContent = '';
    }
}

/**
 * Submit bank deposit
 */
async function submitBankDeposit() {
    const amountInput = document.getElementById('bank-amount');
    const bankSelect = document.getElementById('bank-select');
    
    if (!amountInput || !bankSelect || !selectedBank) return;
    
    const amount = parseFloat(amountInput.value);
    
    // Validate amount
    if (!amount || amount < 10) {
        showToast('Minimum deposit is $10 (or equivalent)', 'error');
        return;
    }
    
    try {
        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        
        // Show loading state
        const submitBtn = event.target;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Deposit...';
        
        // Create deposit
        const response = await fetch(API_ENDPOINTS.CREATE_BANK_DEPOSIT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                amount: amount,
                bank_id: selectedBank.id
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentDepositData = data;
            showToast(data.message, 'success');
            updateBankStep2Display(data);
            showBankStep(2);
        } else {
            throw new Error(data.error || 'Failed to create deposit');
        }
    } catch (error) {
        console.error('❌ Error creating bank deposit:', error);
        showToast(error.message || 'Failed to create deposit', 'error');
    } finally {
        const submitBtn = document.querySelector('#bank-step-1 .modal-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
        }
    }
}

/**
 * Update bank step 2 display
 */
function updateBankStep2Display(data) {
    // Update amount display
    const amountDisplay = document.getElementById('bank-amount-display');
    if (amountDisplay) {
        amountDisplay.textContent = parseFloat(data.transaction.amount).toFixed(2);
    }
    
    // Update converted amount if different currency
    const convertedDisplay = document.getElementById('bank-amount-converted-display');
    if (convertedDisplay && data.transaction.amount_in_bank_currency) {
        convertedDisplay.textContent = `= ${parseFloat(data.transaction.amount_in_bank_currency).toFixed(2)} ${data.transaction.bank_currency}`;
    }
    
    // Update bank details
    if (data.bank_details) {
        document.getElementById('detail-bank-name').textContent = data.bank_details.bank_name || '--';
        document.getElementById('detail-account-number').textContent = data.bank_details.account_number || '--';
        document.getElementById('detail-routing-number').textContent = data.bank_details.routing_number || '--';
        document.getElementById('detail-swift-code').textContent = data.bank_details.swift_code || '--';
        document.getElementById('detail-iban').textContent = data.bank_details.iban || '--';
        
        // Hide rows with no data
        if (!data.bank_details.routing_number) {
            document.getElementById('routing-number-row').style.display = 'none';
        }
        if (!data.bank_details.swift_code) {
            document.getElementById('swift-code-row').style.display = 'none';
        }
        if (!data.bank_details.iban) {
            document.getElementById('iban-row').style.display = 'none';
        }
    }
    
    // Update transaction ID
    const transactionId = document.getElementById('bank-transaction-id');
    if (transactionId) {
        transactionId.textContent = data.transaction.id;
    }
}

/**
 * Copy bank detail
 */
function copyBankDetail(type) {
    let textToCopy = '';
    
    switch(type) {
        case 'account':
            textToCopy = document.getElementById('detail-account-number').textContent;
            break;
        case 'routing':
            textToCopy = document.getElementById('detail-routing-number').textContent;
            break;
        case 'swift':
            textToCopy = document.getElementById('detail-swift-code').textContent;
            break;
        case 'iban':
            textToCopy = document.getElementById('detail-iban').textContent;
            break;
    }
    
    if (textToCopy && textToCopy !== '--') {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Copied!', 'success');
        }).catch(error => {
            console.error('❌ Error copying:', error);
            showToast('Failed to copy', 'error');
        });
    }
}

/**
 * Copy reference code
 */
function copyReference() {
    const referenceElement = document.querySelector('.reference-code code');
    if (referenceElement) {
        const reference = referenceElement.textContent;
        navigator.clipboard.writeText(reference).then(() => {
            showToast('Reference copied!', 'success');
        }).catch(error => {
            console.error('❌ Error copying reference:', error);
            showToast('Failed to copy', 'error');
        });
    }
}

// ========================================
// TOAST NOTIFICATIONS
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
    document.addEventListener('DOMContentLoaded', initializeDepositSystem);
} else {
    initializeDepositSystem();
}

// Close modals when clicking outside
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});

// Reload deposits when page becomes visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadRecentDeposits();
        loadCryptoPrices();
        loadTotalCryptoBalance();
    }
});

console.log('✅ deposit.js fully loaded and ready');
