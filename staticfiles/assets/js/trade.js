// static/assets/js/trade.js
// Unified trading functionality for both buy and sell pages

class TradePage {
    constructor(pageType) {
        this.pageType = pageType; // 'buy' or 'sell'
        this.currentPrices = {};
        this.userBalances = {};
        this.userPortfolio = {};
        this.selectedCrypto = null;
        this.pendingTransaction = null;
        this.isLimitOrder = false;
        this.init();
    }

    init() {
        this.loadInitialData();
        this.setupEventListeners();
        this.setupWebSocketListeners();
    }

    async loadInitialData() {
        try {
            if (this.pageType === 'buy') {
                await this.loadMarketData();
                await this.loadUserBalances();
            } else {
                await this.loadPortfolioData();
                await this.loadMarketData();
            }
            await this.loadRecentTransactions();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load initial data. Please refresh the page.');
        }
    }

    setupEventListeners() {
        // Quick trade form
        const formId = this.pageType === 'buy' ? 'quickBuyForm' : 'quickSellForm';
        document.getElementById(formId).addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQuickTrade();
        });

        // Amount and quantity sync
        const amountField = this.pageType === 'buy' ? 'buyAmount' : 'sellAmount';
        const quantityField = this.pageType === 'buy' ? 'buyQuantity' : 'sellQuantity';
        
        document.getElementById(amountField).addEventListener('input', (e) => {
            this.syncAmountToQuantity(e.target.value);
        });

        document.getElementById(quantityField).addEventListener('input', (e) => {
            this.syncQuantityToAmount(e.target.value);
        });

        // Crypto selection change
        const cryptoSelect = this.pageType === 'buy' ? 'buyCryptoSelect' : 'sellCryptoSelect';
        document.getElementById(cryptoSelect).addEventListener('change', (e) => {
            this.updateCryptoDetails(e.target.value);
        });

        // Limit order toggle
        const limitToggle = this.pageType === 'buy' ? 'enableLimitOrder' : 'enableSellLimitOrder';
        document.getElementById(limitToggle).addEventListener('change', (e) => {
            this.toggleLimitOrder(e.target.checked);
        });

        // Confirmation modal buttons
        const confirmBtn = this.pageType === 'buy' ? 'confirmBuyBtn' : 'confirmSellBtn';
        document.getElementById(confirmBtn).addEventListener('click', () => {
            this.executeTrade();
        });

        // Resend code buttons
        const resendBtn = this.pageType === 'buy' ? 'resendCodeBtn' : 'resendSellCodeBtn';
        document.getElementById(resendBtn).addEventListener('click', () => {
            this.resendVerificationCode();
        });

        // Verification code input
        const verifyCode = this.pageType === 'buy' ? 'verificationCode' : 'sellVerificationCode';
        document.getElementById(verifyCode).addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                this.verifyCode(e.target.value);
            }
        });
    }

    setupWebSocketListeners() {
        if (window.tradingWebSocket) {
            window.tradingWebSocket.subscribe('price_update', (prices) => {
                this.handlePriceUpdates(prices);
            });

            window.tradingWebSocket.subscribe('portfolio_update', (portfolio) => {
                if (this.pageType === 'sell') {
                    this.updatePortfolioData(portfolio);
                } else {
                    this.updateUserBalances(portfolio);
                }
            });

            window.tradingWebSocket.subscribe('market_data', (marketData) => {
                this.updateMarketStats(marketData);
            });
        }
    }

    async loadMarketData() {
        try {
            const response = await fetch('/api/market/data/');
            const data = await response.json();

            if (data.cryptocurrencies) {
                if (this.pageType === 'buy') {
                    this.renderCryptoGrid(data.cryptocurrencies);
                }
                this.storeCurrentPrices(data.cryptocurrencies);
                this.updateMarketStats(data.market_stats);
            }
        } catch (error) {
            console.error('Error loading market data:', error);
            this.showError('Failed to load market data');
        }
    }

    async loadPortfolioData() {
        try {
            const response = await fetch('/api/portfolio/data/');
            const data = await response.json();

            if (data.portfolio) {
                this.userPortfolio = this.processPortfolioData(data.portfolio);
                this.renderPortfolioGrid(this.userPortfolio);
                this.updatePortfolioSummary(data.summary);
                this.populateSellDropdown(this.userPortfolio);
            }
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            this.showError('Failed to load portfolio data');
        }
    }

    async loadUserBalances() {
        try {
            const response = await fetch('/api/user/profile/');
            const data = await response.json();

            if (data.balances) {
                this.userBalances = data.balances;
                this.updateBalanceDisplay();
            }
        } catch (error) {
            console.error('Error loading user balances:', error);
        }
    }

    async loadRecentTransactions() {
        try {
            const type = this.pageType === 'buy' ? 'BUY' : 'SELL';
            const response = await fetch(`/api/transactions/history/?type=${type}&limit=10`);
            const data = await response.json();

            if (data.transactions) {
                const tableId = this.pageType === 'buy' ? 'recentTransactions' : 'recentSellTransactions';
                this.renderRecentTransactions(data.transactions, tableId);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    }

    // Buy Page Methods
    renderCryptoGrid(cryptocurrencies) {
        const grid = document.getElementById('cryptoGrid');
        if (!grid) return;

        grid.innerHTML = '';

        cryptocurrencies.forEach(crypto => {
            const card = this.createCryptoCard(crypto);
            grid.appendChild(card);
            this.currentPrices[crypto.symbol] = parseFloat(crypto.current_price);
        });
    }

    createCryptoCard(crypto) {
        const card = document.createElement('div');
        card.className = 'crypto-card';
        card.setAttribute('data-symbol', crypto.symbol);
        
        const changeValue = parseFloat(crypto.price_change_percentage_24h);
        const changeClass = changeValue >= 0 ? 'change-positive' : 'change-negative';
        const changeSign = changeValue >= 0 ? '+' : '';

        card.innerHTML = `
            <div class="crypto-header">
                <div>
                    <div class="crypto-name">${crypto.name}</div>
                    <div class="crypto-symbol">${crypto.symbol}</div>
                </div>
                <div class="crypto-price">$${this.formatPrice(crypto.current_price)}</div>
            </div>
            <div class="crypto-change ${changeClass}">
                ${changeSign}${changeValue.toFixed(2)}%
            </div>
            <div class="crypto-stats">
                <div class="stat">
                    <span class="stat-label">Market Cap</span>
                    <span class="stat-value">$${(parseFloat(crypto.market_cap) / 1e9).toFixed(2)}B</span>
                </div>
                <div class="stat">
                    <span class="stat-label">24h Volume</span>
                    <span class="stat-value">$${(parseFloat(crypto.volume_24h) / 1e6).toFixed(2)}M</span>
                </div>
            </div>
            <button class="buy-btn" onclick="tradePage.quickTradeFromCard('${crypto.symbol}')">
                <i class="fas fa-shopping-cart me-1"></i>
                Buy ${crypto.symbol}
            </button>
        `;

        return card;
    }

    // Sell Page Methods
    processPortfolioData(portfolio) {
        return portfolio.filter(item => 
            parseFloat(item.total_quantity) > 0 && 
            parseFloat(item.current_value) > 0
        );
    }

    renderPortfolioGrid(portfolio) {
        const grid = document.getElementById('portfolioGrid');
        if (!grid) return;

        grid.innerHTML = '';

        portfolio.forEach(item => {
            const card = this.createPortfolioCard(item);
            grid.appendChild(card);
        });
    }

    createPortfolioCard(item) {
        const card = document.createElement('div');
        card.className = 'portfolio-card';
        card.setAttribute('data-symbol', item.cryptocurrency);
        
        const profitLoss = parseFloat(item.profit_loss_percentage);
        const changeClass = profitLoss >= 0 ? 'change-positive' : 'change-negative';
        const changeSign = profitLoss >= 0 ? '+' : '';

        card.innerHTML = `
            <div class="portfolio-header">
                <div>
                    <div class="crypto-name">${item.cryptocurrency_name || item.cryptocurrency}</div>
                    <div class="crypto-symbol">${item.cryptocurrency}</div>
                </div>
                <div class="crypto-price">$${this.formatPrice(item.current_value, 2)}</div>
            </div>
            <div class="portfolio-details">
                <div class="detail-row">
                    <span>Quantity:</span>
                    <span>${this.formatPrice(item.total_quantity, 8)}</span>
                </div>
                <div class="detail-row">
                    <span>Avg Buy Price:</span>
                    <span>$${this.formatPrice(item.average_buy_price, 8)}</span>
                </div>
                <div class="detail-row">
                    <span>P/L:</span>
                    <span class="${changeClass}">${changeSign}${profitLoss.toFixed(2)}%</span>
                </div>
            </div>
            <button class="sell-btn" onclick="tradePage.quickTradeFromCard('${item.cryptocurrency}')">
                <i class="fas fa-dollar-sign me-1"></i>
                Sell ${item.cryptocurrency}
            </button>
        `;

        return card;
    }

    // Common Methods
    quickTradeFromCard(symbol) {
        const cryptoSelect = this.pageType === 'buy' ? 'buyCryptoSelect' : 'sellCryptoSelect';
        document.getElementById(cryptoSelect).value = symbol;
        this.updateCryptoDetails(symbol);
        
        const quantityField = this.pageType === 'buy' ? 'buyQuantity' : 'sellQuantity';
        document.getElementById(quantityField).focus();
    }

    updateCryptoDetails(symbol) {
        const price = this.currentPrices[symbol];
        
        if (price) {
            const priceDisplay = this.pageType === 'buy' ? 'currentPriceDisplay' : 'sellCurrentPrice';
            document.getElementById(priceDisplay).textContent = `$${this.formatPrice(price)}`;

            // Update available balance for sell page
            if (this.pageType === 'sell') {
                const portfolioItem = this.userPortfolio.find(item => item.cryptocurrency === symbol);
                if (portfolioItem) {
                    document.getElementById('availableCryptoBalance').textContent = 
                        this.formatPrice(portfolioItem.total_quantity, 8);
                }
            }

            // Update calculated totals
            const quantityField = this.pageType === 'buy' ? 'buyQuantity' : 'sellQuantity';
            const quantity = parseFloat(document.getElementById(quantityField).value) || 0;
            if (quantity > 0) {
                this.syncQuantityToAmount(quantity);
            }
        }
    }

    syncAmountToQuantity(amount) {
        const symbol = this.getSelectedCrypto();
        const price = this.currentPrices[symbol];
        
        if (price && amount > 0) {
            const quantity = amount / price;
            const quantityField = this.pageType === 'buy' ? 'buyQuantity' : 'sellQuantity';
            document.getElementById(quantityField).value = quantity.toFixed(8);
            this.updateEstimatedTotal(amount);
        }
    }

    syncQuantityToAmount(quantity) {
        const symbol = this.getSelectedCrypto();
        const price = this.currentPrices[symbol];
        
        if (price && quantity > 0) {
            const amount = quantity * price;
            const amountField = this.pageType === 'buy' ? 'buyAmount' : 'sellAmount';
            document.getElementById(amountField).value = amount.toFixed(2);
            this.updateEstimatedTotal(amount);
        }
    }

    updateEstimatedTotal(amount) {
        if (this.pageType === 'buy') {
            document.getElementById('estimatedTotal').textContent = `$${this.formatPrice(amount, 2)}`;
        }
    }

    toggleLimitOrder(enabled) {
        this.isLimitOrder = enabled;
        const sectionId = this.pageType === 'buy' ? 'limitOrderSection' : 'sellLimitOrderSection';
        document.getElementById(sectionId).style.display = enabled ? 'block' : 'none';
    }

    async handleQuickTrade() {
        const symbol = this.getSelectedCrypto();
        const quantity = parseFloat(this.getQuantityField().value);
        const amount = parseFloat(this.getAmountField().value);
        const price = this.currentPrices[symbol];

        if (!symbol) {
            this.showError('Please select a cryptocurrency');
            return;
        }

        if (quantity <= 0 || amount <= 0) {
            this.showError('Please enter a valid amount');
            return;
        }

        // Validate balances
        if (this.pageType === 'buy') {
            const usdtBalance = this.userBalances.usdt_balance || 0;
            if (amount > usdtBalance) {
                this.showInsufficientBalanceModal();
                return;
            }
        } else {
            const portfolioItem = this.userPortfolio.find(item => item.cryptocurrency === symbol);
            if (!portfolioItem || quantity > parseFloat(portfolioItem.total_quantity)) {
                this.showInsufficientCryptoModal(symbol);
                return;
            }
        }

        // Prepare transaction data
        this.pendingTransaction = {
            transaction_type: this.pageType === 'buy' ? 'BUY' : 'SELL',
            cryptocurrency: symbol,
            quantity: quantity,
            price_per_unit: price,
            total_amount: amount,
            currency: 'USD'
        };

        // Add limit order data if enabled
        if (this.isLimitOrder) {
            const priceField = this.pageType === 'buy' ? 'limitPrice' : 'sellLimitPrice';
            const timeField = this.pageType === 'buy' ? 'timeInForce' : 'sellTimeInForce';
            
            const limitPrice = parseFloat(document.getElementById(priceField).value);
            const timeInForce = document.getElementById(timeField).value;

            if (!limitPrice || limitPrice <= 0) {
                this.showError('Please enter a valid limit price');
                return;
            }

            this.pendingTransaction.order_type = 'LIMIT';
            this.pendingTransaction.price = limitPrice;
            this.pendingTransaction.time_in_force = timeInForce;
        }

        this.showConfirmationModal();
    }

    showConfirmationModal() {
        const { cryptocurrency, quantity, price_per_unit, total_amount, order_type } = this.pendingTransaction;
        
        const modal = this.pageType === 'buy' ? 'buyConfirmationModal' : 'sellConfirmationModal';
        
        document.getElementById(`confirm${this.capitalizeFirst(this.pageType)}Crypto`).textContent = cryptocurrency;
        document.getElementById(`confirm${this.capitalizeFirst(this.pageType)}Quantity`).textContent = 
            this.formatPrice(quantity, 8);
        document.getElementById(`confirm${this.capitalizeFirst(this.pageType)}Price`).textContent = 
            `$${this.formatPrice(price_per_unit)}`;
        document.getElementById(`confirm${this.capitalizeFirst(this.pageType)}OrderType`).textContent = 
            order_type === 'LIMIT' ? 'Limit' : 'Market';
        document.getElementById(`confirm${this.capitalizeFirst(this.pageType)}Total`).textContent = 
            `$${this.formatPrice(total_amount, 2)}`;

        // Reset verification section
        const verifySection = this.pageType === 'buy' ? 'emailVerificationSection' : 'sellEmailVerificationSection';
        document.getElementById(verifySection).style.display = 'none';
        document.getElementById(`${this.pageType}VerificationCode`).value = '';

        const modalInstance = new bootstrap.Modal(document.getElementById(modal));
        modalInstance.show();
    }

    async executeTrade() {
        const confirmBtn = this.pageType === 'buy' ? 'confirmBuyBtn' : 'confirmSellBtn';
        const button = document.getElementById(confirmBtn);
        const originalText = button.innerHTML;
        
        try {
            button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
            button.disabled = true;

            const endpoint = this.pageType === 'buy' ? '/api/trading/buy/' : '/api/trading/sell/';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(this.pendingTransaction)
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(`${this.capitalizeFirst(this.pageType)} order executed successfully!`);
                this.resetForm();
                
                // Reload data
                if (this.pageType === 'buy') {
                    await this.loadUserBalances();
                } else {
                    await this.loadPortfolioData();
                }
                await this.loadRecentTransactions();
                
                // Close modal
                const modalId = this.pageType === 'buy' ? 'buyConfirmationModal' : 'sellConfirmationModal';
                const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
                modal.hide();
            } else {
                if (data.error && data.error.includes('email verification')) {
                    this.showEmailVerification();
                } else {
                    this.showError(data.error || `Failed to execute ${this.pageType} order`);
                }
            }
        } catch (error) {
            console.error(`Error executing ${this.pageType}:`, error);
            this.showError('Network error. Please try again.');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    showEmailVerification() {
        const verifySection = this.pageType === 'buy' ? 'emailVerificationSection' : 'sellEmailVerificationSection';
        document.getElementById(verifySection).style.display = 'block';
        this.showSuccess('Verification code sent to your email');
    }

    async verifyCode(code) {
        try {
            // This would call your email verification endpoint
            const response = await fetch('/api/verify-email-code/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    code: code,
                    transaction_id: this.pendingTransaction.id
                })
            });

            if (response.ok) {
                this.executeTrade(); // Retry the trade
            } else {
                this.showError('Invalid verification code');
            }
        } catch (error) {
            console.error('Error verifying code:', error);
            this.showError('Verification failed');
        }
    }

    async resendVerificationCode() {
        try {
            const response = await fetch('/api/resend-verification-code/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    transaction_id: this.pendingTransaction.id
                })
            });

            if (response.ok) {
                this.showSuccess('Verification code resent to your email');
            } else {
                this.showError('Failed to resend code');
            }
        } catch (error) {
            console.error('Error resending code:', error);
            this.showError('Failed to resend code');
        }
    }

    showInsufficientBalanceModal() {
        const modal = new bootstrap.Modal(document.getElementById('insufficientBalanceModal'));
        modal.show();
    }

    showInsufficientCryptoModal(symbol) {
        document.getElementById('insufficientCryptoName').textContent = symbol;
        const modal = new bootstrap.Modal(document.getElementById('insufficientCryptoModal'));
        modal.show();
    }

    resetForm() {
        const formId = this.pageType === 'buy' ? 'quickBuyForm' : 'quickSellForm';
        document.getElementById(formId).reset();
        
        if (this.pageType === 'buy') {
            document.getElementById('estimatedTotal').textContent = '$0.00';
        }
        
        this.pendingTransaction = null;
        this.isLimitOrder = false;
        this.toggleLimitOrder(false);
    }

    // Utility Methods
    getSelectedCrypto() {
        const cryptoSelect = this.pageType === 'buy' ? 'buyCryptoSelect' : 'sellCryptoSelect';
        return document.getElementById(cryptoSelect).value;
    }

    getQuantityField() {
        return document.getElementById(this.pageType === 'buy' ? 'buyQuantity' : 'sellQuantity');
    }

    getAmountField() {
        return document.getElementById(this.pageType === 'buy' ? 'buyAmount' : 'sellAmount');
    }

    formatPrice(price, decimals = 8) {
        return parseFloat(price).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: decimals
        });
    }

    capitalizeFirst(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    getCSRFToken() {
        return document.querySelector('[name=csrfmiddlewaretoken]').value;
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.minWidth = '300px';
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>
                <span>${message}</span>
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // Data Update Methods
    handlePriceUpdates(prices) {
        prices.forEach(priceData => {
            this.currentPrices[priceData.symbol] = parseFloat(priceData.price);
            
            // Update UI if this crypto is selected
            const selectedSymbol = this.getSelectedCrypto();
            if (selectedSymbol === priceData.symbol) {
                this.updateCryptoDetails(selectedSymbol);
            }
        });
    }

    updateUserBalances(portfolio) {
        if (portfolio.balances) {
            this.userBalances = portfolio.balances;
            this.updateBalanceDisplay();
        }
    }

    updatePortfolioData(portfolio) {
        if (portfolio.portfolio) {
            this.userPortfolio = this.processPortfolioData(portfolio.portfolio);
            this.renderPortfolioGrid(this.userPortfolio);
            this.updatePortfolioSummary(portfolio.summary);
            this.populateSellDropdown(this.userPortfolio);
        }
    }

    updateMarketStats(marketData) {
        if (marketData.total_market_cap) {
            document.getElementById('totalMarketCap').textContent = 
                `$${(marketData.total_market_cap / 1e9).toFixed(2)}B`;
        }
        
        if (marketData.total_volume) {
            document.getElementById('totalVolume').textContent = 
                `$${(marketData.total_volume / 1e9).toFixed(2)}B`;
        }
    }

    updateBalanceDisplay() {
        const usdtBalance = this.userBalances.usdt_balance || 0;
        document.getElementById('availableBalance').textContent = 
            `$${this.formatPrice(usdtBalance, 2)}`;
    }

    updatePortfolioSummary(summary) {
        if (summary.current_value) {
            document.getElementById('portfolioValue').textContent = 
                `$${this.formatPrice(summary.current_value, 2)}`;
        }
        
        if (summary.total_profit_loss) {
            document.getElementById('totalProfitLoss').textContent = 
                `$${this.formatPrice(summary.total_profit_loss, 2)}`;
        }
        
        if (summary.total_profit_loss_percentage) {
            const changeValue = parseFloat(summary.total_profit_loss_percentage);
            document.getElementById('portfolioChange').textContent = 
                `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)}%`;
            document.getElementById('portfolioChange').className = 
                `stat-value ${changeValue >= 0 ? 'change-positive' : 'change-negative'}`;
        }
    }

    populateSellDropdown(portfolio) {
        const dropdown = document.getElementById('sellCryptoSelect');
        if (!dropdown) return;
        
        // Clear existing options except the first one
        while (dropdown.options.length > 1) {
            dropdown.remove(1);
        }

        portfolio.forEach(item => {
            const option = document.createElement('option');
            option.value = item.cryptocurrency;
            option.textContent = `${item.cryptocurrency_name || item.cryptocurrency} (${item.cryptocurrency})`;
            dropdown.appendChild(option);
        });

        if (portfolio.length > 0) {
            this.updateCryptoDetails(portfolio[0].cryptocurrency);
        }
    }

    storeCurrentPrices(cryptocurrencies) {
        cryptocurrencies.forEach(crypto => {
            this.currentPrices[crypto.symbol] = parseFloat(crypto.current_price);
        });
    }

    renderRecentTransactions(transactions, tableId) {
        const tbody = document.querySelector(`#${tableId} tbody`);
        if (!tbody) return;

        tbody.innerHTML = '';

        transactions.forEach(transaction => {
            const row = this.createTransactionRow(transaction);
            tbody.appendChild(row);
        });
    }

    createTransactionRow(transaction) {
        const row = document.createElement('tr');
        const date = new Date(transaction.created_at).toLocaleDateString();
        
        row.innerHTML = `
            <td>${date}</td>
            <td>${transaction.cryptocurrency_name || transaction.cryptocurrency}</td>
            <td>${this.formatPrice(transaction.quantity, 8)}</td>
            <td>$${this.formatPrice(transaction.price_per_unit)}</td>
            <td>$${this.formatPrice(transaction.total_amount, 2)}</td>
            <td><span class="status-badge status-${transaction.status.toLowerCase()}">${transaction.status_display}</span></td>
        `;

        return row;
    }
}