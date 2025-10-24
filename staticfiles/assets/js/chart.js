// static/js/chart.js - Comprehensive charting functionality with real API data
class VenexChartManager {
    constructor() {
        this.charts = new Map();
        this.currentTimeframe = '1d'; // Match backend format
        this.currentCryptoSymbol = 'BTC';
        this.theme = this.detectTheme();
        this.apiBaseUrl = '/api/market/chart';
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
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: colors.primary,
                    backgroundColor: this.createGradient(ctx, colors.primary),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 3,
                    pointHoverBorderWidth: 4
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
                    borderWidth: 3,
                    borderColor: this.theme === 'dark' ? '#1f2937' : '#ffffff',
                    hoverOffset: 15
                }]
            },
            options: this.getChartOptions('portfolio')
        });

        this.charts.set('portfolio', this.portfolioChart);
    }

    createGradient(ctx, color) {
        const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
        
        if (this.theme === 'dark') {
            gradient.addColorStop(0, this.hexToRgba(color, 0.4));
            gradient.addColorStop(0.7, this.hexToRgba(color, 0.1));
            gradient.addColorStop(1, this.hexToRgba(color, 0.05));
        } else {
            gradient.addColorStop(0, this.hexToRgba(color, 0.3));
            gradient.addColorStop(0.7, this.hexToRgba(color, 0.08));
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
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '500'
                        }
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
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            if (type === 'portfolio') {
                                return ` ${context.label}: ${context.parsed}%`;
                            }
                            return ` $${context.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        },
                        title: function(context) {
                            if (type === 'line') {
                                const date = new Date(context[0].label);
                                return date.toLocaleString();
                            }
                            return context[0].label;
                        }
                    }
                }
            },
            scales: type === 'line' ? {
                x: {
                    grid: {
                        color: colors.grid,
                        borderColor: colors.grid,
                        drawBorder: false
                    },
                    ticks: {
                        color: colors.text,
                        maxTicksLimit: 8,
                        font: {
                            size: 11
                        },
                        callback: function(value, index, values) {
                            // Format date labels based on timeframe
                            const date = new Date(this.getLabelForValue(value));
                            if (this.chart.data.labels.length > 30) {
                                return date.toLocaleDateString();
                            } else {
                                return date.toLocaleTimeString();
                            }
                        }
                    }
                },
                y: {
                    grid: {
                        color: colors.grid,
                        borderColor: colors.grid,
                        drawBorder: false
                    },
                    ticks: {
                        color: colors.text,
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            if (value >= 1000) {
                                return '$' + (value / 1000).toFixed(1) + 'K';
                            }
                            return '$' + value.toLocaleString();
                        }
                    },
                    position: 'right'
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
        
        // Update crypto name display
        const selectedOption = document.querySelector(`#chart-crypto-select option[value="${symbol}"]`);
        const cryptoName = selectedOption ? selectedOption.getAttribute('data-name') : symbol;
        document.getElementById('current-crypto-name').textContent = cryptoName;
        
        await this.updatePriceChartData();
    }

    async loadInitialData() {
        await this.updatePriceChartData();
        await this.updatePortfolioChartData();
    }

    async updatePriceChartData() {
        if (!this.priceChart) return;

        try {
            this.showChartLoading('priceChart', true);
            
            const data = await this.fetchPriceData(this.currentCryptoSymbol, this.currentTimeframe);
            
            if (data && data.labels && data.prices) {
                this.priceChart.data.labels = data.labels;
                this.priceChart.data.datasets[0].data = data.prices;
                this.priceChart.data.datasets[0].label = `${this.currentCryptoSymbol} Price`;
                
                this.priceChart.update('none');
                this.showChartLoading('priceChart', false);
            } else {
                throw new Error('Invalid data format received from API');
            }
        } catch (error) {
            console.error('Error updating price chart:', error);
            this.showChartError('priceChart', 'Failed to load price data');
            this.showChartLoading('priceChart', false);
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
        try {
            console.log(`Fetching chart data for ${symbol} with timeframe ${timeframe}`);
            
            const response = await fetch(`${this.apiBaseUrl}/${symbol}/?range=${timeframe}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.prices && data.timestamps) {
                // Process the API data for chart display
                return this.processApiData(data);
            } else {
                throw new Error(data.error || 'Invalid data format from API');
            }
            
        } catch (error) {
            console.error('Error fetching price data:', error);
            // Fallback to mock data if API fails
            return this.generateMockData(symbol, timeframe);
        }
    }

    processApiData(apiData) {
        const labels = [];
        const prices = [];
        
        // Assuming apiData has prices and timestamps arrays
        if (apiData.prices && apiData.timestamps) {
            for (let i = 0; i < apiData.prices.length; i++) {
                const timestamp = apiData.timestamps[i];
                const price = apiData.prices[i];
                
                // Convert timestamp to readable date
                const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
                
                // Format label based on data density
                let label;
                if (apiData.prices.length > 100) {
                    // For large datasets, show date only
                    label = date.toLocaleDateString();
                } else {
                    // For smaller datasets, show date and time
                    label = date.toLocaleString();
                }
                
                labels.push(label);
                prices.push(price);
            }
        } else if (apiData.data) {
            // Alternative format: array of objects with timestamp and price
            apiData.data.forEach(item => {
                const date = new Date(item.timestamp * 1000);
                labels.push(date.toLocaleString());
                prices.push(item.price);
            });
        }
        
        return {
            labels: labels,
            prices: prices
        };
    }

    async fetchPortfolioData() {
        try {
            // This would call your portfolio API endpoint
            const response = await fetch('/api/portfolio/overview/');
            const data = await response.json();
            
            if (data.success) {
                return {
                    labels: data.distribution?.map(item => item.symbol) || [],
                    percentages: data.distribution?.map(item => item.percentage) || []
                };
            } else {
                throw new Error(data.error || 'Failed to fetch portfolio data');
            }
        } catch (error) {
            console.error('Error fetching portfolio data:', error);
            // Fallback to mock portfolio data
            return this.generateMockPortfolioData();
        }
    }

    generateMockData(symbol, timeframe) {
        console.log('Using mock data for chart');
        
        const basePrices = {
            'BTC': 109293.0,
            'ETH': 3862.20,
            'USDT': 1.0,
            'LTC': 72.5,
            'TRX': 0.105
        };

        const basePrice = basePrices[symbol] || 100;
        const dataPoints = this.getDataPointCount(timeframe);
        const volatility = this.getVolatility(timeframe);

        let prices = [basePrice];
        let labels = [];

        const now = new Date();
        
        for (let i = 0; i < dataPoints; i++) {
            const change = (Math.random() - 0.5) * volatility;
            const newPrice = prices[i] * (1 + change);
            prices.push(Math.max(newPrice, basePrice * 0.5)); // Prevent negative prices
            
            // Generate appropriate time labels
            const time = new Date(now.getTime() - (dataPoints - i) * this.getTimeInterval(timeframe));
            labels.push(time.toLocaleString());
        }

        return {
            labels: labels,
            prices: prices
        };
    }

    generateMockPortfolioData() {
        return {
            labels: ['Bitcoin', 'Ethereum', 'USDT', 'Litecoin', 'Tron', 'Other'],
            percentages: [45, 25, 15, 8, 5, 2]
        };
    }

    getDataPointCount(timeframe) {
        const counts = {
            '1d': 24,
            '1w': 7,
            '1m': 30,
            '3m': 90
        };
        return counts[timeframe] || 30;
    }

    getVolatility(timeframe) {
        const volatility = {
            '1d': 0.02,
            '1w': 0.05,
            '1m': 0.08,
            '3m': 0.12
        };
        return volatility[timeframe] || 0.05;
    }

    getTimeInterval(timeframe) {
        const intervals = {
            '1d': 60 * 60 * 1000, // 1 hour
            '1w': 24 * 60 * 60 * 1000, // 1 day
            '1m': 24 * 60 * 60 * 1000, // 1 day
            '3m': 24 * 60 * 60 * 1000 // 1 day
        };
        return intervals[timeframe] || (24 * 60 * 60 * 1000);
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
                chart.data.datasets[0].pointBackgroundColor = colors.primary;
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

    showChartLoading(chartId, show) {
        const canvas = document.getElementById(chartId);
        const loadingElement = document.getElementById('chart-loading');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        
        if (canvas) {
            canvas.style.display = show ? 'none' : 'block';
        }
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

    // Method to handle WebSocket price updates
    handlePriceUpdate(updateData) {
        if (this.priceChart && updateData.symbol === this.currentCryptoSymbol) {
            // Add new data point and remove oldest if needed
            const newPrice = updateData.data.price;
            const newTimestamp = new Date().toLocaleString();
            
            this.priceChart.data.labels.push(newTimestamp);
            this.priceChart.data.datasets[0].data.push(newPrice);
            
            // Keep only last 100 data points
            if (this.priceChart.data.labels.length > 100) {
                this.priceChart.data.labels.shift();
                this.priceChart.data.datasets[0].data.shift();
            }
            
            this.priceChart.update('none');
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
        
        // Start with SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        ema[period - 1] = sum / period;
        
        // Calculate EMA for remaining points
        for (let i = period; i < data.length; i++) {
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        return ema;
    }

    static calculateRSI(data, period = 14) {
        if (data.length < period + 1) {
            return new Array(data.length).fill(50);
        }

        const gains = [];
        const losses = [];
        
        for (let i = 1; i < data.length; i++) {
            const difference = data[i] - data[i - 1];
            gains.push(difference > 0 ? difference : 0);
            losses.push(difference < 0 ? Math.abs(difference) : 0);
        }
        
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        
        const rsi = new Array(period - 1).fill(50);
        
        for (let i = period; i < gains.length; i++) {
            avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
            avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;
            
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
        
        return rsi;
    }

    static calculateBollingerBands(data, period = 20, multiplier = 2) {
        const middle = this.calculateSMA(data, period);
        const upper = [];
        const lower = [];
        
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const std = this.calculateStandardDeviation(slice);
            upper.push(middle[i - period + 1] + (std * multiplier));
            lower.push(middle[i - period + 1] - (std * multiplier));
        }
        
        return { upper, middle, lower };
    }

    static calculateStandardDeviation(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const squareDiffs = data.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
        return Math.sqrt(avgSquareDiff);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('priceChart')) {
        window.venexCharts = new VenexChartManager();
        
        // Expose handlePriceUpdate for WebSocket integration
        window.handleChartPriceUpdate = function(updateData) {
            if (window.venexCharts) {
                window.venexCharts.handlePriceUpdate(updateData);
            }
        };
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VenexChartManager,
        ChartDataProcessor
    };
}