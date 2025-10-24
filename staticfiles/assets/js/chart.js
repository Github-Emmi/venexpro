// static/js/chart.js - Comprehensive charting functionality
class VenexChartManager {
    constructor() {
        this.charts = new Map();
        this.currentTimeframe = '1D';
        this.currentCryptoSymbol = 'BTC';
        this.theme = this.detectTheme();
        this.init();
    }

    init() {
        console.log('VENEX Chart Manager Initialized');
        this.setupEventListeners();
        this.initializePriceChart();
        this.initializePortfolioChart();
        this.loadInitialData();
    }

    detectTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    getChartColors() {
        const lightTheme = {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            background: '#ffffff',
            grid: '#f0f0f0',
            text: '#333333'
        };

        const darkTheme = {
            primary: '#8b5cf6',
            secondary: '#a78bfa',
            success: '#34d399',
            danger: '#f87171',
            warning: '#fbbf24',
            background: '#1f2937',
            grid: '#374151',
            text: '#f9fafb'
        };

        return this.theme === 'dark' ? darkTheme : lightTheme;
    }

    setupEventListeners() {
        // Timeframe buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleTimeframeChange(e.target.dataset.timeframe);
            });
        });

        // Crypto selector
        const cryptoSelect = document.getElementById('chart-crypto-select');
        if (cryptoSelect) {
            cryptoSelect.addEventListener('change', (e) => {
                this.handleCryptocurrencyChange(e.target.value);
            });
        }

        // Window resize handling
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Theme change detection
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            this.theme = e.matches ? 'dark' : 'light';
            this.updateChartThemes();
        });
    }

    initializePriceChart() {
        const ctx = document.getElementById('priceChart');
        if (!ctx) return;

        const colors = this.getChartColors();

        this.priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.generateTimeLabels('1D'),
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: colors.primary,
                    backgroundColor: this.createGradient(ctx, colors.primary),
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointBackgroundColor: colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: this.getChartOptions('price')
        });

        this.charts.set('price', this.priceChart);
    }

    initializePortfolioChart() {
        const ctx = document.getElementById('portfolioChart');
        if (!ctx) return;

        const colors = this.getChartColors();

        this.portfolioChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#f5576c',
                        '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
                        '#fa709a', '#fee140'
                    ],
                    borderWidth: 2,
                    borderColor: this.theme === 'dark' ? '#1f2937' : '#ffffff'
                }]
            },
            options: this.getChartOptions('portfolio')
        });

        this.charts.set('portfolio', this.portfolioChart);
    }

    generateTimeLabels(timeframe) {
        const now = new Date();
        const labels = [];
        let count;

        switch (timeframe) {
            case '1H':
                count = 12;
                for (let i = count - 1; i >= 0; i--) {
                    const time = new Date(now.getTime() - i * 5 * 60000);
                    labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
                break;
            case '1D':
                count = 24;
                for (let i = count - 1; i >= 0; i--) {
                    const time = new Date(now.getTime() - i * 60 * 60000);
                    labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
                }
                break;
            case '1W':
                count = 7;
                for (let i = count - 1; i >= 0; i--) {
                    const time = new Date(now.getTime() - i * 24 * 60 * 60000);
                    labels.push(time.toLocaleDateString([], { weekday: 'short' }));
                }
                break;
            case '1M':
                count = 30;
                for (let i = count - 1; i >= 0; i--) {
                    const time = new Date(now.getTime() - i * 24 * 60 * 60000);
                    labels.push(time.toLocaleDateString([], { month: 'short', day: 'numeric' }));
                }
                break;
        }

        return labels;
    }

    createGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
        
        if (this.theme === 'dark') {
            gradient.addColorStop(0, this.hexToRgba(color, 0.3));
            gradient.addColorStop(1, this.hexToRgba(color, 0.05));
        } else {
            gradient.addColorStop(0, this.hexToRgba(color, 0.2));
            gradient.addColorStop(1, this.hexToRgba(color, 0.02));
        }
        
        return gradient;
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    getChartOptions(type) {
        const colors = this.getChartColors();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: type === 'portfolio',
                    position: 'bottom',
                    labels: {
                        color: colors.text,
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    mode: type === 'line' ? 'index' : 'nearest',
                    intersect: false,
                    backgroundColor: colors.background,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.grid,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            if (type === 'portfolio') {
                                return ` ${context.label}: ${context.parsed}%`;
                            }
                            return ` $${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: type === 'line' ? {
                x: {
                    grid: {
                        color: colors.grid,
                        borderColor: colors.grid
                    },
                    ticks: {
                        color: colors.text,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: colors.grid,
                        borderColor: colors.grid
                    },
                    ticks: {
                        color: colors.text,
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    }
                }
            } : {}
        };

        return commonOptions;
    }

    async handleTimeframeChange(timeframe) {
        this.currentTimeframe = timeframe;
        
        // Update active state of timeframe buttons
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-timeframe="${timeframe}"]`).classList.add('active');

        // Update chart data
        await this.updatePriceChartData();
    }

    async handleCryptocurrencyChange(symbol) {
        this.currentCryptoSymbol = symbol;
        await this.updatePriceChartData();
    }

    async loadInitialData() {
        await this.updatePriceChartData();
        await this.updatePortfolioChartData();
    }

    async updatePriceChartData() {
        if (!this.priceChart) return;

        try {
            const data = await this.fetchPriceData(this.currentCryptoSymbol, this.currentTimeframe);
            
            this.priceChart.data.labels = data.labels;
            this.priceChart.data.datasets[0].data = data.prices;
            this.priceChart.data.datasets[0].label = `${this.currentCryptoSymbol} Price`;
            
            this.priceChart.update('none');
        } catch (error) {
            console.error('Error updating price chart:', error);
            this.showChartError('priceChart', 'Failed to load price data');
        }
    }

    async updatePortfolioChartData() {
        if (!this.portfolioChart) return;

        try {
            const data = await this.fetchPortfolioData();
            
            this.portfolioChart.data.labels = data.labels;
            this.portfolioChart.data.datasets[0].data = data.percentages;
            
            this.portfolioChart.update();
        } catch (error) {
            console.error('Error updating portfolio chart:', error);
            this.showChartError('portfolioChart', 'Failed to load portfolio data');
        }
    }

    async fetchPriceData(symbol, timeframe) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));

        const basePrices = {
            'BTC': 41250,
            'ETH': 2450,
            'USDT': 1,
            'LTC': 72.5,
            'TRX': 0.105
        };

        const basePrice = basePrices[symbol] || 100;
        const volatility = 0.02;
        const dataPoints = this.getDataPointCount(timeframe);

        let prices = [basePrice * (1 - volatility / 2)];
        let labels = this.generateTimeLabels(timeframe);

        for (let i = 1; i < dataPoints; i++) {
            const change = (Math.random() - 0.5) * volatility;
            const newPrice = prices[i - 1] * (1 + change);
            prices.push(newPrice);
        }

        return {
            labels: labels,
            prices: prices.map(price => price)
        };
    }

    async fetchPortfolioData() {
        await new Promise(resolve => setTimeout(resolve, 300));

        const sampleData = {
            labels: ['Bitcoin', 'Ethereum', 'USDT', 'Litecoin', 'Tron', 'Other'],
            percentages: [45, 25, 15, 8, 5, 2]
        };

        return sampleData;
    }

    getDataPointCount(timeframe) {
        const counts = {
            '1H': 12,
            '1D': 24,
            '1W': 7,
            '1M': 30
        };
        return counts[timeframe] || 24;
    }

    handleResize() {
        this.charts.forEach(chart => {
            chart.resize();
        });
    }

    updateChartThemes() {
        const colors = this.getChartColors();

        this.charts.forEach((chart, type) => {
            if (type === 'price') {
                chart.data.datasets[0].borderColor = colors.primary;
                chart.data.datasets[0].backgroundColor = this.createGradient(
                    chart.ctx, colors.primary
                );
            }

            chart.options.plugins.legend.labels.color = colors.text;
            
            if (chart.options.scales) {
                chart.options.scales.x.ticks.color = colors.text;
                chart.options.scales.x.grid.color = colors.grid;
                chart.options.scales.y.ticks.color = colors.text;
                chart.options.scales.y.grid.color = colors.grid;
            }

            chart.update();
        });
    }

    showChartError(chartId, message) {
        const canvas = document.getElementById(chartId);
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = this.theme === 'dark' ? '#f9fafb' : '#333333';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(message, canvas.width / 2, canvas.height / 2);
        }
    }

    updateChart(chartType, data) {
        const chart = this.charts.get(chartType);
        if (chart && data) {
            chart.data = data;
            chart.update();
        }
    }

    destroy() {
        this.charts.forEach(chart => {
            chart.destroy();
        });
        this.charts.clear();
    }
}

// Chart data processing utilities
class ChartDataProcessor {
    static calculateSMA(data, period) {
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }

    static calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        ema[period - 1] = this.calculateSMA(data, period)[0];
        
        for (let i = period; i < data.length; i++) {
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        return ema;
    }

    static calculateRSI(data, period = 14) {
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < data.length; i++) {
            const difference = data[i] - data[i - 1];
            gains.push(difference > 0 ? difference : 0);
            losses.push(difference < 0 ? Math.abs(difference) : 0);
        }
        
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        const rsi = [];
        
        for (let i = period; i < data.length; i++) {
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
            
            avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
        }
        
        return rsi;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('priceChart')) {
        window.venexCharts = new VenexChartManager();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VenexChartManager,
        ChartDataProcessor
    };
}