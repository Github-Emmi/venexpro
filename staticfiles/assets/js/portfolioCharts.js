class PortfolioCharts {
    constructor() {
        this.charts = {};
        this.colors = [
            '#10B981', // Green
            '#3B82F6', // Blue
            '#8B5CF6', // Purple
            '#EC4899', // Pink
            '#F59E0B', // Orange
            '#6366F1', // Indigo
            '#14B8A6', // Teal
            '#06B6D4', // Cyan
            '#6B7280', // Gray
            '#EF4444'  // Red
        ];
        this.initializeCharts();
        this.setupResizeHandler();
    }

    initializeCharts() {
        this.initializePerformanceChart();
        this.initializeAllocationChart();
        this.initializeMiniChart();
    }

    initializePerformanceChart() {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;

        this.charts.performance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Portfolio Value',
                    data: [],
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
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
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `$${context.raw.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                })}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            tooltipFormat: 'MMM D, YYYY HH:mm'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: (value) => {
                                return `$${value.toLocaleString('en-US')}`;
                            }
                        }
                    }
                }
            }
        });
    }

    initializeAllocationChart() {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;

        this.charts.allocation = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: this.colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Create custom legend
        this.updateAllocationLegend();
    }

    initializeMiniChart() {
        const ctx = document.getElementById('mini-performance-chart');
        if (!ctx) return;

        this.charts.mini = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    borderColor: '#10B981',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                }
            }
        });
    }

    updatePerformanceChart(data, timeframe) {
        if (!this.charts.performance) return;

        const chart = this.charts.performance;
        chart.data.labels = data.timestamps;
        chart.data.datasets[0].data = data.values;

        // Update time unit based on timeframe
        const timeUnit = this.getTimeUnit(timeframe);
        chart.options.scales.x.time.unit = timeUnit;

        // Calculate y-axis range with padding
        const values = data.values;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.1;

        chart.options.scales.y.min = Math.max(0, min - padding);
        chart.options.scales.y.max = max + padding;

        chart.update();
    }

    updateAllocationChart(holdings) {
        if (!this.charts.allocation) return;

        const sortedHoldings = [...holdings].sort((a, b) => b.current_value - a.current_value);
        
        this.charts.allocation.data.labels = sortedHoldings.map(h => h.cryptocurrency);
        this.charts.allocation.data.datasets[0].data = sortedHoldings.map(h => h.current_value);
        
        this.charts.allocation.update();
        this.updateAllocationLegend(sortedHoldings);
    }

    updateMiniChart(data) {
        if (!this.charts.mini) return;

        this.charts.mini.data.labels = data.timestamps;
        this.charts.mini.data.datasets[0].data = data.values;
        this.charts.mini.update();
    }

    updateAllocationLegend(holdings) {
        const legend = document.getElementById('allocation-legend');
        if (!legend || !holdings) return;

        const total = holdings.reduce((sum, h) => sum + h.current_value, 0);
        
        legend.innerHTML = holdings.map((holding, index) => {
            const percentage = ((holding.current_value / total) * 100).toFixed(1);
            return `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${this.colors[index]}"></span>
                    <span class="legend-label">${holding.cryptocurrency}</span>
                    <span class="legend-value">$${holding.current_value.toLocaleString()}</span>
                    <span class="legend-percentage">${percentage}%</span>
                </div>
            `;
        }).join('');
    }

    getTimeUnit(timeframe) {
        switch (timeframe) {
            case '1D': return 'hour';
            case '1W': return 'day';
            case '1M': return 'day';
            case '3M': return 'week';
            case '1Y': return 'month';
            case 'ALL': return 'month';
            default: return 'day';
        }
    }

    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                Object.values(this.charts).forEach(chart => {
                    if (chart && chart.resize) {
                        chart.resize();
                    }
                });
            }, 250);
        });
    }

    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        this.charts = {};
    }

    updateTheme(isDark) {
        const textColor = isDark ? '#E5E7EB' : '#374151';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

        Object.values(this.charts).forEach(chart => {
            if (!chart || !chart.options) return;

            if (chart.options.scales) {
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.ticks) {
                        scale.ticks.color = textColor;
                    }
                    if (scale.grid) {
                        scale.grid.color = gridColor;
                    }
                });
            }

            if (chart.options.plugins && chart.options.plugins.legend) {
                chart.options.plugins.legend.labels = {
                    ...chart.options.plugins.legend.labels,
                    color: textColor
                };
            }

            chart.update();
        });
    }
}

// Initialize charts when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.portfolioCharts = new PortfolioCharts();

    // Listen for theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        window.portfolioCharts.updateTheme(e.matches);
    });
});
