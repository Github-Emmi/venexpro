// static/js/portfolio.js - Portfolio Main Functionality
class VenexPortfolio {
    constructor() {
        this.portfolioData = null;
        this.analyticsData = null;
        this.currentTimeframe = '1D';
        this.socket = null;
        this.isConnected = false;
        this.chartManager = null;
        this.socketManager = null;
        this.init();
    }

    init() {
        console.log('VENEX Portfolio Initialized');
        this.setupEventListeners();
        this.initializeCharts();
        this.connectWebSocket();
        this.loadInitialData();
        this.setupModal();
    }

    setupEventListeners() {
        // Timeframe buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleTimeframeChange(e.target.dataset.timeframe);
            });
        });

        // Add transaction button
        document.getElementById('add-transaction-btn').addEventListener('click', () => {
            this.showTransactionModal();
        });

        document.getElementById('empty-add-btn').addEventListener('click', () => {
            this.showTransactionModal();
        });

        // Transaction form
        document.getElementById('transaction-form').addEventListener('submit', (e) => {
            this.handleTransactionSubmit(e);
        });

        // Modal close events
        document.querySelector('.close').addEventListener('click', () => {
            this.hideTransactionModal();
        });

        document.getElementById('cancel-transaction').addEventListener('click', () => {
            this.hideTransactionModal();
        });

        // Auto-calculate total amount
        document.getElementById('transaction-amount').addEventListener('input', () => {
            this.calculateTransactionTotal();
        });

        document.getElementById('transaction-price').addEventListener('input', () => {
            this.calculateTransactionTotal();
        });
    }

    initializeCharts() {
        // Initialize chart manager
        if (typeof PortfolioCharts !== 'undefined') {
            this.chartManager = new PortfolioCharts();
        } else {
            console.warn('PortfolioCharts not found');
        }
    }

    connectWebSocket() {
        // Initialize socket manager
        if (typeof PortfolioSocket !== 'undefined') {
            this.socketManager = new PortfolioSocket(this);
        } else {
            console.warn('PortfolioSocket not found, using REST API only');
            this.startPolling();
        }
    }

    async loadInitialData() {
        await this.fetchPortfolioData();
        await this.fetchAnalyticsData(this.currentTimeframe);
    }

    async fetchPortfolioData() {
        try {
            const response = await fetch('/api/portfolio/');
            const data = await response.json();
            
            if (data.success) {
                this.portfolioData = data;
                this.updatePortfolioUI();
            } else {
                throw new Error(data.error || 'Failed to fetch portfolio data');
            }
        } catch (error) {
            console.error('Error fetching portfolio data:', error);
            this.showToast('Failed to load portfolio data', 'error');
        }
    }

    async fetchAnalyticsData(timeframe) {
        try {
            const response = await fetch(`/api/portfolio/analytics/?timeframe=${timeframe}`);
            const data = await response.json();
            
            if (data.success) {
                this.analyticsData = data.analytics;
                this.updateAnalyticsUI();
                
                if (this.chartManager) {
                    this.chartManager.updatePerformanceChart(this.analyticsData);
                    this.chartManager.updateRiskMetrics(this.analyticsData.risk_metrics);
                }
            } else {
                throw new Error(data.error || 'Failed to fetch analytics data');
            }
        } catch (error) {
            console.error('Error fetching analytics data:', error);
        }
    }

    updatePortfolioUI() {
        if (!this.portfolioData) return;

        const portfolio = this.portfolioData.portfolio;
        const holdings = this.portfolioData.holdings;

        // Update summary cards
        document.getElementById('total-value').textContent = 
            `$${portfolio.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        document.getElementById('unrealized-pl').textContent = 
            `$${portfolio.unrealized_pl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        // Update daily change
        const dailyChangeElement = document.getElementById('daily-change');
        const isPositive = portfolio.daily_change_percentage >= 0;
        dailyChangeElement.textContent = `${isPositive ? '+' : ''}${portfolio.daily_change_percentage.toFixed(2)}%`;
        dailyChangeElement.className = `card-change ${isPositive ? 'positive' : 'negative'}`;

        // Update P/L percentage
        const plPercentageElement = document.getElementById('pl-percentage');
        const plIsPositive = portfolio.unrealized_pl >= 0;
        const plPercentage = portfolio.initial_investment > 0 ? 
            (portfolio.unrealized_pl / portfolio.initial_investment * 100) : 0;
        plPercentageElement.textContent = `${plIsPositive ? '+' : ''}${plPercentage.toFixed(2)}%`;
        plPercentageElement.className = `card-change ${plIsPositive ? 'positive' : 'negative'}`;

        // Update holdings table
        this.updateHoldingsTable(holdings);

        // Update allocation chart
        if (this.chartManager) {
            this.chartManager.updateAllocationChart(holdings);
        }
    }

    updateHoldingsTable(holdings) {
        const tbody = document.getElementById('holdings-table-body');
        const emptyRow = document.getElementById('empty-holdings');
        
        if (!holdings || holdings.length === 0) {
            tbody.innerHTML = '';
            emptyRow.style.display = '';
            return;
        }

        emptyRow.style.display = 'none';
        tbody.innerHTML = '';

        holdings.forEach(holding => {
            const row = document.createElement('tr');
            const isPLPositive = holding.unrealized_pl >= 0;
            const is24hPositive = holding['24h_change'] >= 0;

            row.innerHTML = `
                <td>
                    <div class="coin-info">
                        <div class="coin-logo">
                            ${holding.symbol.slice(0, 3)}
                        </div>
                        <div class="coin-name">
                            <span class="coin-symbol">${holding.symbol}</span>
                            <span class="coin-full-name">${holding.name}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div>${parseFloat(holding.amount).toLocaleString('en-US', { 
                        minimumFractionDigits: 4, 
                        maximumFractionDigits: 8 
                    })}</div>
                    <small class="coin-full-name">${holding.symbol}</small>
                </td>
                <td>
                    $${parseFloat(holding.current_price).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    })}
                </td>
                <td>
                    $${parseFloat(holding.value_usd).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    })}
                </td>
                <td>
                    ${parseFloat(holding.allocation).toFixed(2)}%
                </td>
                <td>
                    <div class="performance-indicator ${isPLPositive ? 'performance-positive' : 'performance-negative'}">
                        $${parseFloat(holding.unrealized_pl).toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                        })}
                    </div>
                    <small>${isPLPositive ? '+' : ''}${parseFloat(holding.unrealized_pl_percentage).toFixed(2)}%</small>
                </td>
                <td>
                    <div class="performance-indicator ${is24hPositive ? 'performance-positive' : 'performance-negative'}">
                        ${is24hPositive ? '+' : ''}${parseFloat(holding['24h_change']).toFixed(2)}%
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    updateAnalyticsUI() {
        if (!this.analyticsData) return;

        const riskMetrics = this.analyticsData.risk_metrics;
        const insights = this.analyticsData.insights;

        // Update risk metrics
        this.updateRiskMetrics(riskMetrics);

        // Update insights
        this.updateInsights(insights);
    }

    updateRiskMetrics(riskMetrics) {
        document.getElementById('risk-score').textContent = `${riskMetrics.risk_score}/100`;
        document.getElementById('volatility-value').textContent = `${(riskMetrics.volatility * 100).toFixed(2)}%`;
        document.getElementById('diversification-value').textContent = `${riskMetrics.diversification_score}%`;
        document.getElementById('max-drawdown-value').textContent = `${riskMetrics.max_drawdown}%`;
        document.getElementById('sharpe-value').textContent = riskMetrics.sharpe_ratio.toFixed(2);

        // Update risk level
        const riskLevelElement = document.getElementById('risk-level');
        let riskLevel = 'Low Risk';
        let riskClass = 'risk-low';

        if (riskMetrics.risk_score >= 70) {
            riskLevel = 'High Risk';
            riskClass = 'risk-high';
        } else if (riskMetrics.risk_score >= 40) {
            riskLevel = 'Medium Risk';
            riskClass = 'risk-medium';
        }

        riskLevelElement.textContent = riskLevel;
        riskLevelElement.className = `card-label ${riskClass}`;
    }

    updateInsights(insights) {
        const insightsList = document.getElementById('insights-list');
        
        if (!insights || insights.length === 0) {
            insightsList.innerHTML = `
                <div class="insight-item">
                    <strong>No insights available</strong><br>
                    Add more transactions to get personalized portfolio insights.
                </div>
            `;
            return;
        }

        insightsList.innerHTML = '';

        insights.forEach(insight => {
            const insightElement = document.createElement('div');
            
            // Determine insight type based on content
            let insightClass = 'insight-item';
            if (insight.toLowerCase().includes('consider') || insight.toLowerCase().includes('suggest')) {
                insightClass += ' warning';
            } else if (insight.toLowerCase().includes('great') || insight.toLowerCase().includes('strong')) {
                insightClass += ' success';
            }

            insightElement.className = insightClass;
            insightElement.innerHTML = insight;
            
            insightsList.appendChild(insightElement);
        });
    }

    handleTimeframeChange(timeframe) {
        this.currentTimeframe = timeframe;
        
        // Update active state
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-timeframe="${timeframe}"]`).classList.add('active');

        // Load new analytics data
        this.fetchAnalyticsData(timeframe);
    }

    setupModal() {
        const modal = document.getElementById('transaction-modal');
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideTransactionModal();
            }
        });

        // Transaction type change
        document.getElementById('transaction-type').addEventListener('change', (e) => {
            this.handleTransactionTypeChange(e.target.value);
        });
    }

    showTransactionModal() {
        const modal = document.getElementById('transaction-modal');
        modal.style.display = 'block';
    }

    hideTransactionModal() {
        const modal = document.getElementById('transaction-modal');
        modal.style.display = 'none';
        document.getElementById('transaction-form').reset();
    }

    handleTransactionTypeChange(type) {
        const symbolField = document.getElementById('transaction-symbol');
        const amountField = document.getElementById('transaction-amount');
        const priceField = document.getElementById('transaction-price');

        if (type === 'DEPOSIT' || type === 'WITHDRAWAL') {
            symbolField.disabled = true;
            amountField.disabled = true;
            priceField.disabled = true;
            symbolField.value = '';
            amountField.value = '';
            priceField.value = '';
        } else {
            symbolField.disabled = false;
            amountField.disabled = false;
            priceField.disabled = false;
        }
    }

    calculateTransactionTotal() {
        const amount = parseFloat(document.getElementById('transaction-amount').value) || 0;
        const price = parseFloat(document.getElementById('transaction-price').value) || 0;
        const total = amount * price;
        
        document.getElementById('transaction-total').value = total.toFixed(2);
    }

    async handleTransactionSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const transactionData = {
            symbol: formData.get('symbol'),
            type: formData.get('type'),
            amount: formData.get('amount'),
            price: formData.get('price'),
            total_amount: formData.get('total_amount'),
            fee: formData.get('fee') || '0.00'
        };

        try {
            const response = await fetch('/api/portfolio/transaction/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                body: JSON.stringify(transactionData)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Transaction added successfully!', 'success');
                this.hideTransactionModal();
                
                // Reload portfolio data
                await this.fetchPortfolioData();
                await this.fetchAnalyticsData(this.currentTimeframe);
                
                // Notify WebSocket if connected
                if (this.socketManager) {
                    this.socketManager.requestPortfolioUpdate();
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error adding transaction:', error);
            this.showToast(`Failed to add transaction: ${error.message}`, 'error');
        }
    }

    startPolling() {
        // Fallback polling if WebSocket is not available
        setInterval(() => {
            this.fetchPortfolioData();
        }, 30000); // Every 30 seconds
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.style.cssText = `
            padding: 12px 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-left: 4px solid ${this.getToastColor(type)};
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
        `;

        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span style="font-size: 1.2em;">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    getToastColor(type) {
        const colors = {
            'success': '#10b981',
            'error': '#ef4444',
            'warning': '#f59e0b',
            'info': '#667eea'
        };
        return colors[type] || '#667eea';
    }

    getToastIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || '💡';
    }

    // Method to handle updates from WebSocket
    handlePortfolioUpdate(portfolioData) {
        this.portfolioData = portfolioData;
        this.updatePortfolioUI();
    }

    handleAnalyticsUpdate(analyticsData) {
        this.analyticsData = analyticsData;
        this.updateAnalyticsUI();
        
        if (this.chartManager) {
            this.chartManager.updatePerformanceChart(analyticsData);
        }
    }

    destroy() {
        if (this.socketManager) {
            this.socketManager.disconnect();
        }
        if (this.chartManager) {
            this.chartManager.destroy();
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.venexPortfolio = new VenexPortfolio();
    
    // Add CSS animations
    if (!document.querySelector('#portfolio-animations')) {
        const style = document.createElement('style');
        style.id = 'portfolio-animations';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 0;
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .modal-header {
                padding: 1.5rem;
                border-bottom: 1px solid #e5e7eb;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                font-size: 1.25rem;
                font-weight: 600;
            }
            
            .close {
                font-size: 1.5rem;
                font-weight: bold;
                cursor: pointer;
                color: #6b7280;
            }
            
            .close:hover {
                color: #374151;
            }
            
            .modal-body {
                padding: 1.5rem;
            }
            
            .form-group {
                margin-bottom: 1rem;
            }
            
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: 500;
                color: #374151;
            }
            
            .form-group input,
            .form-group select {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 1rem;
            }
            
            .form-actions {
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
                margin-top: 1.5rem;
            }
            
            .btn-primary {
                background: #667eea;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            }
            
            .btn-secondary {
                background: #6b7280;
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }
});