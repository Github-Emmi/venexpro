// Modern Portfolio JavaScript - Mobile Optimized
(function() {
    'use strict';

    // ===== CONFIGURATION =====
    const CONFIG = {
        API_ENDPOINTS: {
            PORTFOLIO_DATA: '/api/portfolio/data/',
            PORTFOLIO_ALLOCATION: '/api/portfolio/allocation/',
            PORTFOLIO_HISTORY: '/api/portfolio/history/',
            PORTFOLIO_ANALYTICS: '/api/portfolio/analytics/',
        },
        CHART_COLORS: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'],
        UPDATE_INTERVAL: 30000, // 30 seconds
        CHART_OPTIONS: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#f1f5f9',
                        padding: 12,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: '#141b2d',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: '#1e293b',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {}
                }
            },
            scales: {
                x: {
                    grid: { color: '#1e293b', drawBorder: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#1e293b', drawBorder: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            }
        }
    };

    // ===== STATE =====
    const state = {
        portfolioData: null,
        charts: {
            performance: null,
            allocation: null,
            history: null
        },
        currentTab: 'holdings',
        currentTimeframe: '1D',
        currentHistoryPeriod: 30,
        updateTimer: null
    };

    // ===== DOM ELEMENTS =====
    const elements = {
        // Buttons
        refreshBtn: document.getElementById('refresh-btn'),
        refreshMobile: document.getElementById('refresh-mobile'),
        tabBtns: document.querySelectorAll('.tab-btn'),
        timeframeBtns: document.querySelectorAll('.timeframe-btn'),
        
        // Summary
        totalValue: document.getElementById('total-value'),
        totalPLValue: document.getElementById('total-pl-value'),
        totalPLPercentage: document.getElementById('total-pl-percentage'),
        totalInvested: document.getElementById('total-invested'),
        totalAssets: document.getElementById('total-assets'),
        totalValueChange: document.getElementById('total-value-change'),
        
        // Holdings
        holdingsList: document.getElementById('holdings-list'),
        emptyHoldings: document.getElementById('empty-holdings'),
        holdingsSort: document.getElementById('holdings-sort'),
        
        // Performance
        todayChange: document.getElementById('today-change'),
        bestPerformer: document.getElementById('best-performer'),
        worstPerformer: document.getElementById('worst-performer'),
        performanceChart: document.getElementById('performance-chart'),
        
        // Allocation
        allocationGrid: document.getElementById('allocation-grid'),
        allocationChart: document.getElementById('allocation-chart'),
        
        // History
        historyPeriod: document.getElementById('history-period'),
        historyChart: document.getElementById('history-chart'),
        
        // Analytics
        riskScore: document.getElementById('risk-score'),
        riskCircle: document.getElementById('risk-circle-path'),
        riskLevelBadge: document.getElementById('risk-level-badge'),
        volatility: document.getElementById('volatility'),
        diversification: document.getElementById('diversification'),
        maxDrawdown: document.getElementById('max-drawdown'),
        sharpeRatio: document.getElementById('sharpe-ratio'),
        insightsList: document.getElementById('insights-list'),
        totalReturn: document.getElementById('total-return'),
        annualizedReturn: document.getElementById('annualized-return'),
        winRate: document.getElementById('win-rate'),
        avgHolding: document.getElementById('avg-holding'),
        
        // Toast
        toastContainer: document.getElementById('toast-container')
    };

    // ===== INITIALIZATION =====
    function init() {
        setupEventListeners();
        loadAllData();
        startAutoUpdate();
        
        // Add gradient definition for risk circle
        addRiskCircleGradient();
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
        // Refresh buttons
        if (elements.refreshBtn) {
            elements.refreshBtn.addEventListener('click', handleRefresh);
        }
        if (elements.refreshMobile) {
            elements.refreshMobile.addEventListener('click', handleRefresh);
        }
        
        // Tab navigation
        elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', handleTabChange);
        });
        
        // Timeframe buttons
        elements.timeframeBtns.forEach(btn => {
            btn.addEventListener('click', handleTimeframeChange);
        });
        
        // Sort dropdown
        if (elements.holdingsSort) {
            elements.holdingsSort.addEventListener('change', handleSortChange);
        }
        
        // History period
        if (elements.historyPeriod) {
            elements.historyPeriod.addEventListener('change', handleHistoryPeriodChange);
        }
        
        // Menu toggle for mobile
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', toggleMobileMenu);
        }
    }

    // ===== DATA LOADING =====
    async function loadAllData() {
        try {
            await Promise.all([
                loadPortfolioData(),
                loadAllocation(),
                loadHistory(),
                loadAnalytics()
            ]);
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            showToast('Failed to load portfolio data', 'error');
        }
    }

    async function loadPortfolioData() {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.PORTFOLIO_DATA);
            const data = await response.json();
            
            if (data.success) {
                state.portfolioData = data;
                updateSummaryCards(data.summary);
                renderHoldings(data.portfolio);
                updatePerformanceMetrics(data.portfolio);
                renderPerformanceChart(data.portfolio);
            }
        } catch (error) {
            console.error('Error loading portfolio data:', error);
            showEmptyState();
        }
    }

    async function loadAllocation() {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.PORTFOLIO_ALLOCATION);
            const data = await response.json();
            
            if (data.success) {
                renderAllocationGrid(data.allocation);
                renderAllocationChart(data.allocation);
            }
        } catch (error) {
            console.error('Error loading allocation:', error);
        }
    }

    async function loadHistory() {
        try {
            const response = await fetch(
                `${CONFIG.API_ENDPOINTS.PORTFOLIO_HISTORY}?days=${state.currentHistoryPeriod}`
            );
            const data = await response.json();
            
            if (data.success) {
                renderHistoryChart(data.history);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
    }

    async function loadAnalytics() {
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.PORTFOLIO_ANALYTICS);
            const data = await response.json();
            
            if (data.success) {
                updateRiskMetrics(data.risk_metrics);
                renderInsights(data.insights);
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    // ===== UI UPDATES =====
    function updateSummaryCards(summary) {
        if (!summary) return;

        // Total Value
        if (elements.totalValue) {
            elements.totalValue.textContent = formatCurrency(summary.current_value || 0);
        }

        // Total P/L
        const pl = summary.total_profit_loss || 0;
        const plPct = summary.total_profit_loss_percentage || 0;
        
        if (elements.totalPLValue) {
            elements.totalPLValue.textContent = formatCurrency(Math.abs(pl));
            elements.totalPLValue.parentElement.className = 
                `card-value ${pl >= 0 ? 'positive' : 'negative'}`;
        }

        if (elements.totalPLPercentage) {
            elements.totalPLPercentage.textContent = `${pl >= 0 ? '+' : ''}${plPct.toFixed(2)}%`;
            elements.totalPLPercentage.className = 
                `card-change ${pl >= 0 ? 'positive' : 'negative'}`;
        }

        // Total Invested
        if (elements.totalInvested) {
            elements.totalInvested.textContent = formatCurrency(summary.total_invested || 0);
        }

        // Total Assets
        if (elements.totalAssets && state.portfolioData && state.portfolioData.portfolio) {
            elements.totalAssets.textContent = state.portfolioData.portfolio.length;
        }
    }

    function renderHoldings(holdings) {
        if (!holdings || holdings.length === 0) {
            showEmptyState();
            return;
        }

        const html = holdings.map((holding, index) => {
            const pl = holding.profit_loss || 0;
            const plPct = holding.profit_loss_percentage || 0;
            const color = CONFIG.CHART_COLORS[index % CONFIG.CHART_COLORS.length];

            return `
                <div class="holding-item">
                    <div class="holding-left">
                        <div class="holding-icon" style="background: ${color};">
                            ${holding.cryptocurrency.substring(0, 3)}
                        </div>
                        <div class="holding-info">
                            <span class="holding-symbol">${holding.cryptocurrency}</span>
                            <span class="holding-quantity">${formatNumber(holding.total_quantity, 8)} ${holding.cryptocurrency}</span>
                        </div>
                    </div>
                    <div class="holding-right">
                        <span class="holding-value">$${formatNumber(holding.current_value, 2)}</span>
                        <span class="holding-pl ${pl >= 0 ? 'positive' : 'negative'}">
                            <i class="fas fa-${pl >= 0 ? 'arrow-up' : 'arrow-down'}"></i>
                            ${Math.abs(plPct).toFixed(2)}%
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        elements.holdingsList.innerHTML = html;
        elements.emptyHoldings.style.display = 'none';
    }

    function showEmptyState() {
        elements.holdingsList.innerHTML = '';
        elements.emptyHoldings.style.display = 'block';
    }

    function updatePerformanceMetrics(holdings) {
        if (!holdings || holdings.length === 0) return;

        // Sort by P/L percentage
        const sorted = [...holdings].sort((a, b) => 
            (b.profit_loss_percentage || 0) - (a.profit_loss_percentage || 0)
        );

        // Best performer
        if (elements.bestPerformer && sorted.length > 0) {
            const best = sorted[0];
            elements.bestPerformer.textContent = 
                `${best.cryptocurrency} (+${(best.profit_loss_percentage || 0).toFixed(2)}%)`;
        }

        // Worst performer
        if (elements.worstPerformer && sorted.length > 0) {
            const worst = sorted[sorted.length - 1];
            elements.worstPerformer.textContent = 
                `${worst.cryptocurrency} (${(worst.profit_loss_percentage || 0).toFixed(2)}%)`;
        }
    }

    function renderPerformanceChart(holdings) {
        if (!holdings || holdings.length === 0 || !elements.performanceChart) return;

        const ctx = elements.performanceChart.getContext('2d');
        
        // Destroy existing chart
        if (state.charts.performance) {
            state.charts.performance.destroy();
        }

        // Generate data based on timeframe
        const chartData = generatePerformanceData(holdings);

        state.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Portfolio Value',
                    data: chartData.values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                ...CONFIG.CHART_OPTIONS,
                plugins: {
                    ...CONFIG.CHART_OPTIONS.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...CONFIG.CHART_OPTIONS.plugins.tooltip,
                        callbacks: {
                            label: (context) => `Value: $${formatNumber(context.parsed.y, 2)}`
                        }
                    }
                },
                scales: {
                    ...CONFIG.CHART_OPTIONS.scales,
                    y: {
                        ...CONFIG.CHART_OPTIONS.scales.y,
                        ticks: {
                            ...CONFIG.CHART_OPTIONS.scales.y.ticks,
                            callback: (value) => '$' + formatNumber(value, 0)
                        }
                    }
                }
            }
        });
    }

    function generatePerformanceData(holdings) {
        const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
        const intervals = {
            '1D': 24,
            '1W': 7,
            '1M': 30,
            '3M': 90,
            '1Y': 365,
            'ALL': 730
        };

        const count = intervals[state.currentTimeframe] || 30;
        const labels = [];
        const values = [];

        for (let i = count - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            
            if (count <= 24) {
                labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            } else {
                labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
            }

            // Simulate value with random variation
            const variation = (Math.random() - 0.5) * 0.05;
            values.push(totalValue * (1 + variation * i / count));
        }

        return { labels, values };
    }

    function renderAllocationGrid(allocation) {
        if (!allocation || allocation.length === 0) {
            elements.allocationGrid.innerHTML = '<p class="loading-state">No allocation data</p>';
            return;
        }

        const html = allocation.map((item, index) => {
            const color = CONFIG.CHART_COLORS[index % CONFIG.CHART_COLORS.length];
            return `
                <div class="allocation-card">
                    <div class="allocation-header">
                        <span class="allocation-symbol">${item.cryptocurrency}</span>
                        <span class="allocation-percentage" style="color: ${color};">
                            ${item.percentage.toFixed(1)}%
                        </span>
                    </div>
                    <div class="allocation-details">
                        <div class="allocation-row">
                            <span class="label">Quantity</span>
                            <span class="value">${formatNumber(item.quantity, 8)}</span>
                        </div>
                        <div class="allocation-row">
                            <span class="label">Value</span>
                            <span class="value">$${formatNumber(item.value, 2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        elements.allocationGrid.innerHTML = html;
    }

    function renderAllocationChart(allocation) {
        if (!allocation || allocation.length === 0 || !elements.allocationChart) return;

        const ctx = elements.allocationChart.getContext('2d');
        
        if (state.charts.allocation) {
            state.charts.allocation.destroy();
        }

        state.charts.allocation = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: allocation.map(a => a.cryptocurrency),
                datasets: [{
                    data: allocation.map(a => a.value),
                    backgroundColor: CONFIG.CHART_COLORS.slice(0, allocation.length),
                    borderColor: '#141b2d',
                    borderWidth: 2
                }]
            },
            options: {
                ...CONFIG.CHART_OPTIONS,
                plugins: {
                    ...CONFIG.CHART_OPTIONS.plugins,
                    tooltip: {
                        ...CONFIG.CHART_OPTIONS.plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((value / total) * 100).toFixed(1);
                                return `${label}: $${formatNumber(value, 2)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderHistoryChart(history) {
        if (!history || history.length === 0 || !elements.historyChart) return;

        const ctx = elements.historyChart.getContext('2d');
        
        if (state.charts.history) {
            state.charts.history.destroy();
        }

        state.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels: history.map(h => {
                    const date = new Date(h.timestamp);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [{
                    label: 'Portfolio Value',
                    data: history.map(h => h.total_value),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5
                }]
            },
            options: {
                ...CONFIG.CHART_OPTIONS,
                plugins: {
                    ...CONFIG.CHART_OPTIONS.plugins,
                    legend: { display: false },
                    tooltip: {
                        ...CONFIG.CHART_OPTIONS.plugins.tooltip,
                        callbacks: {
                            label: (context) => `Value: $${formatNumber(context.parsed.y, 2)}`
                        }
                    }
                },
                scales: {
                    ...CONFIG.CHART_OPTIONS.scales,
                    y: {
                        ...CONFIG.CHART_OPTIONS.scales.y,
                        ticks: {
                            ...CONFIG.CHART_OPTIONS.scales.y.ticks,
                            callback: (value) => '$' + formatNumber(value, 0)
                        }
                    }
                }
            }
        });
    }

    function updateRiskMetrics(metrics) {
        if (!metrics) return;

        // Risk Score
        const score = metrics.risk_score || 0;
        if (elements.riskScore) {
            elements.riskScore.textContent = Math.round(score);
        }

        // Update risk circle
        if (elements.riskCircle) {
            const circumference = 565;
            const offset = circumference - (score / 100) * circumference;
            elements.riskCircle.style.strokeDashoffset = offset;
        }

        // Risk Level Badge
        if (elements.riskLevelBadge) {
            let level = 'Low Risk';
            let className = 'low';
            if (score > 70) {
                level = 'High Risk';
                className = 'high';
            } else if (score > 40) {
                level = 'Medium Risk';
                className = 'medium';
            }
            elements.riskLevelBadge.textContent = level;
            elements.riskLevelBadge.className = `risk-level-badge ${className}`;
        }

        // Other metrics
        if (elements.volatility) {
            elements.volatility.textContent = `${((metrics.volatility || 0) * 100).toFixed(2)}%`;
        }
        if (elements.diversification) {
            elements.diversification.textContent = `${(metrics.diversification_score || 0).toFixed(0)}/100`;
        }
        if (elements.maxDrawdown) {
            elements.maxDrawdown.textContent = `${(metrics.max_drawdown || 0).toFixed(2)}%`;
        }
        if (elements.sharpeRatio) {
            elements.sharpeRatio.textContent = (metrics.sharpe_ratio || 0).toFixed(2);
        }

        // Performance metrics
        if (state.portfolioData && state.portfolioData.summary) {
            const totalReturn = state.portfolioData.summary.total_profit_loss_percentage || 0;
            if (elements.totalReturn) {
                elements.totalReturn.textContent = `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}%`;
                elements.totalReturn.className = `metric-box-value ${totalReturn >= 0 ? 'positive' : 'negative'}`;
            }
            if (elements.annualizedReturn) {
                elements.annualizedReturn.textContent = `${(totalReturn * 1.2).toFixed(2)}%`;
            }
        }
    }

    function renderInsights(insights) {
        if (!insights || insights.length === 0) {
            elements.insightsList.innerHTML = '<p class="loading-state">No insights available</p>';
            return;
        }

        const html = insights.map(insight => `
            <div class="insight-item">
                <i class="fas fa-lightbulb"></i>
                <p>${insight}</p>
            </div>
        `).join('');

        elements.insightsList.innerHTML = html;
    }

    function addRiskCircleGradient() {
        const svg = document.querySelector('.risk-circle-svg');
        if (!svg) return;

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'riskGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');

        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#667eea');

        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#764ba2');

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
    }

    // ===== EVENT HANDLERS =====
    function handleRefresh() {
        const btn = elements.refreshBtn;
        if (btn) {
            btn.classList.add('refreshing');
        }

        loadAllData().finally(() => {
            if (btn) {
                btn.classList.remove('refreshing');
            }
            showToast('Portfolio data refreshed', 'success');
        });
    }

    function handleTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        
        // Update button states
        elements.tabBtns.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');
        
        state.currentTab = tab;
    }

    function handleTimeframeChange(e) {
        const period = e.currentTarget.dataset.period;
        
        elements.timeframeBtns.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        state.currentTimeframe = period;
        
        if (state.portfolioData && state.portfolioData.portfolio) {
            renderPerformanceChart(state.portfolioData.portfolio);
        }
    }

    function handleSortChange(e) {
        const sortBy = e.target.value;
        if (!state.portfolioData || !state.portfolioData.portfolio) return;

        let sorted = [...state.portfolioData.portfolio];
        
        switch(sortBy) {
            case 'value-desc':
                sorted.sort((a, b) => b.current_value - a.current_value);
                break;
            case 'value-asc':
                sorted.sort((a, b) => a.current_value - b.current_value);
                break;
            case 'pl-desc':
                sorted.sort((a, b) => b.profit_loss_percentage - a.profit_loss_percentage);
                break;
            case 'pl-asc':
                sorted.sort((a, b) => a.profit_loss_percentage - b.profit_loss_percentage);
                break;
        }

        renderHoldings(sorted);
    }

    function handleHistoryPeriodChange(e) {
        state.currentHistoryPeriod = parseInt(e.target.value);
        loadHistory();
    }

    function toggleMobileMenu() {
        // Implement mobile menu toggle if needed
        console.log('Menu toggle clicked');
    }

    // ===== UTILITIES =====
    function formatNumber(num, decimals) {
        if (num === null || num === undefined || isNaN(num)) return '0.00';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function formatCurrency(num) {
        return formatNumber(num, 2);
    }

    function showToast(message, type) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas fa-${icons[type]}"></i>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function startAutoUpdate() {
        state.updateTimer = setInterval(() => {
            loadAllData();
        }, CONFIG.UPDATE_INTERVAL);
    }

    // ===== CLEANUP =====
    window.addEventListener('beforeunload', () => {
        if (state.updateTimer) {
            clearInterval(state.updateTimer);
        }
        Object.values(state.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
    });

    // ===== START =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for external access
    window.PortfolioManager = {
        refresh: handleRefresh,
        loadData: loadAllData
    };

})();
