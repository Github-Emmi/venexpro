// Venex Broker Chart JavaScript
// Moving chart functionality to dedicated file

class VenexChartManager {
    // ... (content from responsive.js)
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