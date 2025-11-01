// Portfolio Management Class
class PortfolioManager {
    constructor() {
        this.initializeWebSocket();
        this.fetchInitialData();
        this.setupEventListeners();
        this.charts = {};
        this.currentTimeframe = '1D';
        this.portfolioData = null;
    }

    // Initialize WebSocket connection
    initializeWebSocket() {
        this.socket = new WebSocket(
            `${window.location.protocol === 'https:' ? 'wss:' : 'wss:'}//${window.location.host}/wss/portfolio/`
        );

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed');
            setTimeout(() => this.initializeWebSocket(), 5000); // Reconnect after 5 seconds
        };
    }

    // Set up event listeners
    setupEventListeners() {
        // Timeframe selector buttons
        document.querySelectorAll('.timeframe-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.updateTimeframe(button.dataset.timeframe);
            });
        });

        // Holdings table search
        const searchInput = document.getElementById('holdingsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.filterHoldings(searchInput.value);
            });
        }

        // Transaction modal events
        const addTransactionBtn = document.getElementById('add-transaction-btn');
        if (addTransactionBtn) {
            addTransactionBtn.addEventListener('click', () => this.showTransactionModal());
        }
    }

    // Fetch initial portfolio data
    async fetchInitialData() {
        try {
            // Fetch portfolio overview
            const overviewResponse = await fetch('/api/portfolio/overview/');
            const overviewData = await overviewResponse.json();

            // Fetch detailed portfolio data
            const dataResponse = await fetch('/api/portfolio/data/');
            const portfolioData = await dataResponse.json();

            // Fetch performance data
            const performanceResponse = await fetch('/api/portfolio/performance/');
            const performanceData = await performanceResponse.json();

            // Update UI with fetched data
            this.updatePortfolioOverview(overviewData);
            this.updateHoldingsTable(portfolioData.portfolio);
            this.initializeCharts(portfolioData, performanceData);
            this.generateAIInsights(portfolioData);

        } catch (error) {
            console.error('Error fetching portfolio data:', error);
            this.showError('Failed to load portfolio data');
        }
    }

    // Update portfolio overview section
    updatePortfolioOverview(data) {
        document.getElementById('totalValue').textContent = this.formatCurrency(data.total_balance);
        document.getElementById('profitLossPercent').textContent = this.formatPercentage(data.total_profit_loss_pct);
        document.getElementById('totalInvested').textContent = this.formatCurrency(data.total_invested);
        document.getElementById('totalProfitLoss').textContent = this.formatCurrency(data.total_profit_loss);

        // Update profit/loss styling
        const plElement = document.getElementById('totalProfitLoss');
        plElement.classList.remove('positive', 'negative');
        plElement.classList.add(data.total_profit_loss >= 0 ? 'positive' : 'negative');
    }

    // Update holdings table
    updateHoldingsTable(holdings) {
        const tableBody = document.getElementById('holdings-table-body');
        const emptyState = document.getElementById('empty-holdings');

        if (!holdings || holdings.length === 0) {
            tableBody.innerHTML = '';
            emptyState.style.display = 'table-row';
            return;
        }

        emptyState.style.display = 'none';
        tableBody.innerHTML = holdings.map(holding => this.createHoldingRow(holding)).join('');
    }

    // Create a single holding row HTML
    createHoldingRow(holding) {
        const profitLossClass = holding.profit_loss >= 0 ? 'positive' : 'negative';
        const priceChangeClass = holding.price_change_24h >= 0 ? 'positive' : 'negative';

        return `
            <tr data-symbol="${holding.cryptocurrency}">
                <td class="asset-cell">
                    <img src="/static/assets/images/crypto/${holding.cryptocurrency.toLowerCase()}.png"
                         alt="${holding.cryptocurrency}"
                         class="crypto-icon">
                    <span class="asset-name">${holding.cryptocurrency}</span>
                </td>
                <td>${this.formatNumber(holding.total_quantity, 8)}</td>
                <td>${this.formatCurrency(holding.average_buy_price)}</td>
                <td>${this.formatCurrency(holding.current_price)}</td>
                <td>${this.formatCurrency(holding.current_value)}</td>
                <td class="profit-loss ${profitLossClass}">
                    ${this.formatCurrency(holding.profit_loss)}
                    <small>(${this.formatPercentage(holding.profit_loss_percentage)})</small>
                </td>
                <td class="price-change ${priceChangeClass}">
                    ${this.formatPercentage(holding.price_change_24h)}
                </td>
            </tr>
        `;
    }

    // Initialize charts
    initializeCharts(portfolioData, performanceData) {
        // Distribution chart
        this.initializeDistributionChart(portfolioData.portfolio);

        // Performance chart
        this.initializePerformanceChart(performanceData);
    }

    // Initialize portfolio distribution chart
    initializeDistributionChart(holdings) {
        const ctx = document.getElementById('portfolioDistributionChart').getContext('2d');

        const data = {
            labels: holdings.map(h => h.cryptocurrency),
            datasets: [{
                data: holdings.map(h => h.current_value),
                backgroundColor: this.generateChartColors(holdings.length)
            }]
        };

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    title: {
                        display: true,
                        text: 'Portfolio Distribution'
                    }
                }
            }
        });
    }

    // Initialize performance chart
    initializePerformanceChart(performanceData) {
        const ctx = document.getElementById('portfolioPerformanceChart').getContext('2d');

        // Extract timestamps and values from performance data
        const timestamps = performanceData.map(p => p.timestamp);
        const values = performanceData.map(p => p.value);

        const data = {
            labels: timestamps,
            datasets: [{
                label: 'Portfolio Value',
                data: values,
                borderColor: '#10B981',
                tension: 0.4
            }]
        };

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${this.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    // Generate AI insights
    async generateAIInsights(portfolioData) {
        try {
            const insights = await this.calculatePortfolioInsights(portfolioData);
            this.updateInsightsUI(insights);
        } catch (error) {
            console.error('Error generating insights:', error);
            this.showError('Failed to generate portfolio insights');
        }
    }

    // Calculate portfolio insights
    async calculatePortfolioInsights(portfolioData) {
        const holdings = portfolioData.portfolio;
        const totalValue = holdings.reduce((sum, h) => sum + h.current_value, 0);

        // Calculate risk metrics
        const riskMetrics = {
            diversification: this.calculateDiversificationScore(holdings, totalValue),
            volatility: await this.calculatePortfolioVolatility(holdings),
            concentration: this.calculateConcentrationRisk(holdings, totalValue)
        };

        // Generate insights based on metrics
        return {
            risk: this.generateRiskInsight(riskMetrics),
            diversification: this.generateDiversificationInsight(riskMetrics.diversification),
            performance: this.generatePerformanceInsight(portfolioData)
        };
    }

    // Update insights UI
    updateInsightsUI(insights) {
        document.getElementById('riskAnalysis').innerHTML = insights.risk;
        document.getElementById('diversificationInsight').innerHTML = insights.diversification;
        document.getElementById('performanceInsight').innerHTML = insights.performance;
    }

    // Helper functions for formatting
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(value);
    }

    formatPercentage(value) {
        return `${(value || 0).toFixed(2)}%`;
    }

    formatNumber(value, decimals = 2) {
        return Number(value).toFixed(decimals);
    }

    // WebSocket message handler
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'price_update':
                this.updatePrices(data.data);
                break;
            case 'portfolio_update':
                this.updatePortfolio(data.data);
                break;
            case 'performance_update':
                this.updatePerformance(data.data);
                break;
        }
    }

    // Show error message
    showError(message) {
        // Implement error notification UI
        console.error(message);
    }

    // Generate chart colors
    generateChartColors(count) {
        const colors = [
            '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B',
            '#6366F1', '#14B8A6', '#06B6D4', '#6B7280', '#EF4444'
        ];

        // Repeat colors if we need more than available
        return Array(count).fill().map((_, i) => colors[i % colors.length]);
    }

    // Calculate portfolio metrics
    calculateDiversificationScore(holdings, totalValue) {
        // Calculate Herfindahl-Hirschman Index (HHI)
        const hhi = holdings.reduce((sum, holding) => {
            const weight = holding.current_value / totalValue;
            return sum + weight * weight;
        }, 0);

        // Convert HHI to a 0-100 score (inverse relationship)
        return Math.round((1 - hhi) * 100);
    }

    async calculatePortfolioVolatility(holdings) {
        // Implement volatility calculation based on historical price data
        return 15; // Placeholder
    }

    calculateConcentrationRisk(holdings, totalValue) {
        // Find largest holding as percentage of portfolio
        const maxConcentration = Math.max(
            ...holdings.map(h => (h.current_value / totalValue) * 100)
        );
        return maxConcentration;
    }

    // Generate insight messages
    generateRiskInsight(metrics) {
        const { volatility, concentration } = metrics;
        let riskLevel = 'Low';
        if (volatility > 30 || concentration > 50) riskLevel = 'High';
        else if (volatility > 20 || concentration > 30) riskLevel = 'Medium';

        return `
            <div class="risk-analysis">
                <p>Portfolio Risk Level: <strong>${riskLevel}</strong></p>
                <ul>
                    <li>Volatility: ${volatility.toFixed(1)}%</li>
                    <li>Max Concentration: ${concentration.toFixed(1)}%</li>
                </ul>
            </div>
        `;
    }

    generateDiversificationInsight(score) {
        let message = '';
        if (score < 50) {
            message = 'Your portfolio could benefit from more diversification. Consider adding different assets to reduce risk.';
        } else if (score < 75) {
            message = 'Your portfolio has decent diversification, but there\'s room for improvement.';
        } else {
            message = 'Excellent diversification! Your portfolio risk is well distributed.';
        }

        return `
            <div class="diversification-insight">
                <p>Diversification Score: <strong>${score}/100</strong></p>
                <p>${message}</p>
            </div>
        `;
    }

    generatePerformanceInsight(portfolioData) {
        const { total_profit_loss_percentage } = portfolioData.summary;
        let message = '';

        if (total_profit_loss_percentage > 20) {
            message = 'Strong performance! Consider taking some profits to rebalance.';
        } else if (total_profit_loss_percentage > 0) {
            message = 'Your portfolio is performing well. Keep monitoring market conditions.';
        } else {
            message = 'Consider dollar-cost averaging to take advantage of lower prices.';
        }

        return `
            <div class="performance-insight">
                <p>Overall Return: <strong>${total_profit_loss_percentage.toFixed(2)}%</strong></p>
                <p>${message}</p>
            </div>
        `;
    }
}

// Initialize portfolio manager when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioManager = new PortfolioManager();
});