/**
 * ORDER MANAGEMENT SYSTEM
 * Handles creating, viewing, filtering, and canceling trading orders
 * Integrates with backend APIs and real-time WebSocket updates
 */

console.log('🚀 order.js loaded successfully');

// Configuration
const API_ENDPOINTS = {
    CREATE_ORDER: '/api/trading/orders/create/',
    GET_ORDERS: '/api/trading/orders/',
    CANCEL_ORDER: '/api/trading/orders/{order_id}/cancel/',
    MARKET_DATA: '/api/market/data/',
    CRYPTO_PRICES: '/api/v1/prices/multiple/',
};

const UPDATE_INTERVAL = 30000; // 30 seconds
let ordersData = [];
let currentFilters = {
    orderType: '',
    side: '',
    cryptocurrency: '',
    status: ''
};
let cryptoPrices = {};
let userBalances = {};

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize the order management system
 */
function initializeOrderSystem() {
    console.log('🎯 Initializing Order Management System...');
    
    // Initialize event listeners
    setupEventListeners();
    
    // Load initial data
    loadOrders();
    loadCryptoPrices();
    loadUserBalances();
    
    // Set up periodic updates
    setInterval(loadOrders, UPDATE_INTERVAL);
    setInterval(loadCryptoPrices, 60000); // Update prices every minute
    
    console.log('✅ Order Management System initialized');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Create Order Button
    const createOrderBtn = document.getElementById('create-order-btn');
    if (createOrderBtn) {
        createOrderBtn.addEventListener('click', showCreateOrderModal);
    }
    
    // Refresh Button
    const refreshBtn = document.getElementById('refresh-orders-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadOrders();
            showToast('Orders refreshed', 'success');
        });
    }
    
    // Filter Controls
    const orderTypeFilter = document.getElementById('order-type-filter');
    const sideFilter = document.getElementById('side-filter');
    const cryptoFilter = document.getElementById('crypto-filter');
    const statusFilter = document.getElementById('status-filter');
    const clearFiltersBtn = document.getElementById('clear-filters');
    
    if (orderTypeFilter) orderTypeFilter.addEventListener('change', applyFilters);
    if (sideFilter) sideFilter.addEventListener('change', applyFilters);
    if (cryptoFilter) cryptoFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Order Form - Order Type Change
    const orderTypeRadios = document.querySelectorAll('input[name="order_type"]');
    orderTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleOrderTypeChange);
    });
    
    // Order Form - Side Change
    const sideRadios = document.querySelectorAll('input[name="side"]');
    sideRadios.forEach(radio => {
        radio.addEventListener('change', updateOrderSummary);
    });
    
    // Order Form - Cryptocurrency Change
    const cryptoSelect = document.querySelector('select[name="cryptocurrency"]');
    if (cryptoSelect) {
        cryptoSelect.addEventListener('change', handleCryptocurrencyChange);
    }
    
    // Order Form - Quantity Change
    const quantityInput = document.querySelector('input[name="quantity"]');
    if (quantityInput) {
        quantityInput.addEventListener('input', updateOrderSummary);
    }
    
    // Order Form - Price Change
    const priceInput = document.querySelector('input[name="price"]');
    if (priceInput) {
        priceInput.addEventListener('input', updateOrderSummary);
    }
    
    // Submit Order Button
    const submitOrderBtn = document.getElementById('submit-order-btn');
    if (submitOrderBtn) {
        submitOrderBtn.addEventListener('click', handleSubmitOrder);
    }
    
    // Cancel Order Button (in details modal)
    const cancelOrderBtn = document.getElementById('cancel-order-btn');
    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', handleCancelOrder);
    }
}

// ========================================
// DATA LOADING
// ========================================

/**
 * Load orders from the API
 */
async function loadOrders() {
    try {
        console.log('📥 Loading orders...');
        
        const response = await fetch(API_ENDPOINTS.GET_ORDERS, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.orders) {
            ordersData = data.orders;
            console.log(`✅ Loaded ${ordersData.length} orders`);
            
            // Update statistics
            updateStatistics();
            
            // Render orders
            renderOrders(ordersData);
        }
    } catch (error) {
        console.error('❌ Error loading orders:', error);
        showToast('Failed to load orders', 'error');
        showEmptyState();
    }
}

/**
 * Load cryptocurrency prices
 */
async function loadCryptoPrices() {
    try {
        const symbols = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX'].join(',');
        const response = await fetch(`${API_ENDPOINTS.CRYPTO_PRICES}?symbols=${symbols}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.prices) {
            cryptoPrices = data.prices;
            console.log('💰 Crypto prices loaded:', cryptoPrices);
        }
    } catch (error) {
        console.error('❌ Error loading crypto prices:', error);
    }
}

/**
 * Load user balances from the page context
 */
function loadUserBalances() {
    // Try to get balances from wallet page or context
    // For now, we'll fetch from the current price display when a crypto is selected
    console.log('💵 User balances will be loaded on demand');
}

// ========================================
// RENDERING
// ========================================

/**
 * Render orders in the grid
 */
function renderOrders(orders) {
    const ordersGrid = document.getElementById('orders-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (!ordersGrid) return;
    
    // Filter orders based on current filters
    const filteredOrders = filterOrders(orders);
    
    if (filteredOrders.length === 0) {
        ordersGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'flex';
        return;
    }
    
    ordersGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    // Build HTML
    let html = '';
    filteredOrders.forEach(order => {
        html += createOrderCard(order);
    });
    
    ordersGrid.innerHTML = html;
    
    // Attach click handlers to order cards
    attachOrderCardHandlers();
}

/**
 * Create HTML for a single order card
 */
function createOrderCard(order) {
    const statusClass = getStatusClass(order.status);
    const sideClass = order.side.toLowerCase();
    const currentPrice = cryptoPrices[order.cryptocurrency]?.price || 0;
    const estimatedValue = (parseFloat(order.quantity) * currentPrice).toFixed(2);
    const filledPercentage = order.filled_quantity && order.quantity 
        ? (parseFloat(order.filled_quantity) / parseFloat(order.quantity) * 100).toFixed(1)
        : 0;
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-card-header">
                <div class="order-title">
                    <span class="crypto-symbol">${order.cryptocurrency}</span>
                    <span class="order-type-badge">${order.order_type}</span>
                </div>
                <span class="order-status ${statusClass}">${order.status}</span>
            </div>
            
            <div class="order-card-body">
                <div class="order-info-row">
                    <div class="info-label">Side</div>
                    <div class="info-value ${sideClass}">
                        <i class="fas fa-arrow-${order.side === 'BUY' ? 'up' : 'down'}"></i>
                        ${order.side}
                    </div>
                </div>
                
                <div class="order-info-row">
                    <div class="info-label">Quantity</div>
                    <div class="info-value">${parseFloat(order.quantity).toFixed(8)} ${order.cryptocurrency}</div>
                </div>
                
                ${order.price ? `
                    <div class="order-info-row">
                        <div class="info-label">Limit Price</div>
                        <div class="info-value">$${parseFloat(order.price).toFixed(2)}</div>
                    </div>
                ` : ''}
                
                ${order.stop_price ? `
                    <div class="order-info-row">
                        <div class="info-label">Stop Price</div>
                        <div class="info-value">$${parseFloat(order.stop_price).toFixed(2)}</div>
                    </div>
                ` : ''}
                
                <div class="order-info-row">
                    <div class="info-label">Current Price</div>
                    <div class="info-value">$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
                
                <div class="order-info-row">
                    <div class="info-label">Est. Value</div>
                    <div class="info-value highlight">$${parseFloat(estimatedValue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                </div>
                
                ${order.filled_quantity && parseFloat(order.filled_quantity) > 0 ? `
                    <div class="order-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${filledPercentage}%"></div>
                        </div>
                        <span class="progress-text">${filledPercentage}% Filled</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="order-card-footer">
                <div class="order-time">
                    <i class="far fa-clock"></i>
                    ${formatDate(order.created_at)}
                </div>
                <div class="order-actions">
                    <button class="btn-action view-details" data-order-id="${order.id}">
                        <i class="fas fa-eye"></i>
                        Details
                    </button>
                    ${order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED' ? `
                        <button class="btn-action btn-cancel" data-order-id="${order.id}">
                            <i class="fas fa-times"></i>
                            Cancel
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

/**
 * Show empty state
 */
function showEmptyState() {
    const ordersGrid = document.getElementById('orders-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (ordersGrid) ordersGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
}

/**
 * Update statistics cards
 */
function updateStatistics() {
    const openOrders = ordersData.filter(o => o.status === 'OPEN').length;
    const filledToday = ordersData.filter(o => {
        if (o.status === 'FILLED' && o.filled_at) {
            const filledDate = new Date(o.filled_at);
            const today = new Date();
            return filledDate.toDateString() === today.toDateString();
        }
        return false;
    }).length;
    const partialOrders = ordersData.filter(o => o.status === 'PARTIALLY_FILLED').length;
    
    // Calculate total volume
    let totalVolume = 0;
    ordersData.forEach(order => {
        if (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED') {
            const filledQty = parseFloat(order.filled_quantity || 0);
            const avgPrice = parseFloat(order.average_filled_price || 0);
            totalVolume += filledQty * avgPrice;
        }
    });
    
    // Update DOM
    updateElement('open-orders-count', openOrders);
    updateElement('filled-today-count', filledToday);
    updateElement('partial-orders-count', partialOrders);
    updateElement('total-order-volume', `$${totalVolume.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
}

// ========================================
// FILTERING
// ========================================

/**
 * Apply current filters to orders
 */
function applyFilters() {
    currentFilters.orderType = document.getElementById('order-type-filter')?.value || '';
    currentFilters.side = document.getElementById('side-filter')?.value || '';
    currentFilters.cryptocurrency = document.getElementById('crypto-filter')?.value || '';
    currentFilters.status = document.getElementById('status-filter')?.value || '';
    
    console.log('🔍 Applying filters:', currentFilters);
    renderOrders(ordersData);
}

/**
 * Clear all filters
 */
function clearFilters() {
    currentFilters = {
        orderType: '',
        side: '',
        cryptocurrency: '',
        status: ''
    };
    
    // Reset filter selects
    const filters = ['order-type-filter', 'side-filter', 'crypto-filter', 'status-filter'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) element.value = '';
    });
    
    renderOrders(ordersData);
    showToast('Filters cleared', 'info');
}

/**
 * Filter orders based on current filters
 */
function filterOrders(orders) {
    return orders.filter(order => {
        if (currentFilters.orderType && order.order_type !== currentFilters.orderType) return false;
        if (currentFilters.side && order.side !== currentFilters.side) return false;
        if (currentFilters.cryptocurrency && order.cryptocurrency !== currentFilters.cryptocurrency) return false;
        if (currentFilters.status && order.status !== currentFilters.status) return false;
        return true;
    });
}

// ========================================
// ORDER CREATION
// ========================================

/**
 * Show create order modal
 */
function showCreateOrderModal() {
    const modal = document.getElementById('createOrderModal');
    if (modal) {
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        // Reset form
        resetOrderForm();
        updateOrderSummary();
    }
}

/**
 * Reset order form
 */
function resetOrderForm() {
    const form = document.getElementById('create-order-form');
    if (form) {
        form.reset();
        
        // Reset to default order type (MARKET)
        const marketRadio = document.querySelector('input[name="order_type"][value="MARKET"]');
        if (marketRadio) marketRadio.checked = true;
        
        // Reset to BUY side
        const buyRadio = document.querySelector('input[name="side"][value="BUY"]');
        if (buyRadio) buyRadio.checked = true;
        
        // Hide price fields
        togglePriceFields('MARKET');
    }
}

/**
 * Handle order type change
 */
function handleOrderTypeChange(event) {
    const orderType = event.target.value;
    togglePriceFields(orderType);
    updateOrderSummary();
}

/**
 * Toggle price fields based on order type
 */
function togglePriceFields(orderType) {
    const priceGroup = document.getElementById('price-group');
    const stopPriceGroup = document.getElementById('stop-price-group');
    const priceInput = document.querySelector('input[name="price"]');
    const stopPriceInput = document.querySelector('input[name="stop_price"]');
    
    if (!priceGroup || !stopPriceGroup) return;
    
    // Reset required attributes
    if (priceInput) priceInput.required = false;
    if (stopPriceInput) stopPriceInput.required = false;
    
    // Show/hide based on order type
    switch (orderType) {
        case 'MARKET':
            priceGroup.style.display = 'none';
            stopPriceGroup.style.display = 'none';
            break;
        case 'LIMIT':
            priceGroup.style.display = 'block';
            stopPriceGroup.style.display = 'none';
            if (priceInput) priceInput.required = true;
            break;
        case 'STOP_LOSS':
        case 'TAKE_PROFIT':
            priceGroup.style.display = 'none';
            stopPriceGroup.style.display = 'block';
            if (stopPriceInput) stopPriceInput.required = true;
            break;
    }
}

/**
 * Handle cryptocurrency selection change
 */
function handleCryptocurrencyChange(event) {
    const crypto = event.target.value;
    
    if (!crypto) return;
    
    // Update quantity symbol
    const quantitySymbol = document.getElementById('quantity-symbol');
    if (quantitySymbol) {
        quantitySymbol.textContent = crypto;
    }
    
    // Update current price display
    const currentPrice = cryptoPrices[crypto]?.price || 0;
    const currentPriceValue = document.getElementById('current-price-value');
    if (currentPriceValue) {
        currentPriceValue.textContent = `$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
    // Update available balance (placeholder - would need actual user balance data)
    const availableBalance = document.getElementById('available-balance');
    if (availableBalance) {
        // This would fetch from user's actual balance
        availableBalance.textContent = '0.00000000 ' + crypto;
    }
    
    updateOrderSummary();
}

/**
 * Update order summary
 */
function updateOrderSummary() {
    const orderType = document.querySelector('input[name="order_type"]:checked')?.value || 'MARKET';
    const side = document.querySelector('input[name="side"]:checked')?.value || 'BUY';
    const cryptocurrency = document.querySelector('select[name="cryptocurrency"]')?.value || '';
    const quantity = parseFloat(document.querySelector('input[name="quantity"]')?.value || 0);
    const price = parseFloat(document.querySelector('input[name="price"]')?.value || 0);
    
    // Update summary fields
    updateElement('summary-type', formatOrderType(orderType));
    updateElement('summary-side', side);
    updateElement('summary-quantity', `${quantity.toFixed(8)} ${cryptocurrency}`);
    
    // Calculate total
    let totalValue = 0;
    if (orderType === 'MARKET') {
        const currentPrice = cryptoPrices[cryptocurrency]?.price || 0;
        totalValue = quantity * currentPrice;
    } else if (orderType === 'LIMIT' && price > 0) {
        totalValue = quantity * price;
    }
    
    updateElement('summary-total', `$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
}

/**
 * Handle order submission
 */
async function handleSubmitOrder() {
    const form = document.getElementById('create-order-form');
    if (!form) return;
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
    }
    
    try {
        // Collect form data
        const formData = new FormData(form);
        const orderData = {
            order_type: formData.get('order_type'),
            side: formData.get('side'),
            cryptocurrency: formData.get('cryptocurrency'),
            quantity: formData.get('quantity'),
            time_in_force: formData.get('time_in_force')
        };
        
        // Add price fields if applicable
        if (formData.get('price')) {
            orderData.price = formData.get('price');
        }
        if (formData.get('stop_price')) {
            orderData.stop_price = formData.get('stop_price');
        }
        
        console.log('📤 Submitting order:', orderData);
        
        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        
        // Submit order
        const response = await fetch(API_ENDPOINTS.CREATE_ORDER, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Order created successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createOrderModal'));
            if (modal) modal.hide();
            
            // Reload orders
            loadOrders();
        } else {
            throw new Error(result.error || 'Failed to create order');
        }
    } catch (error) {
        console.error('❌ Error creating order:', error);
        showToast(error.message || 'Failed to create order', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
        }
    }
}

// ========================================
// ORDER DETAILS & CANCELLATION
// ========================================

/**
 * Attach event handlers to order cards
 */
function attachOrderCardHandlers() {
    // View details buttons
    document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const orderId = btn.getAttribute('data-order-id');
            showOrderDetails(orderId);
        });
    });
    
    // Cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const orderId = btn.getAttribute('data-order-id');
            confirmCancelOrder(orderId);
        });
    });
}

/**
 * Show order details modal
 */
function showOrderDetails(orderId) {
    const order = ordersData.find(o => o.id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('order-details-content');
    const cancelBtn = document.getElementById('cancel-order-btn');
    
    if (!modal || !content) return;
    
    // Build details HTML
    const currentPrice = cryptoPrices[order.cryptocurrency]?.price || 0;
    const estimatedValue = (parseFloat(order.quantity) * currentPrice).toFixed(2);
    
    content.innerHTML = `
        <div class="order-details-grid">
            <div class="detail-section">
                <h6><i class="fas fa-info-circle"></i> Order Information</h6>
                <div class="detail-row">
                    <span>Order ID:</span>
                    <span class="detail-value">${order.id}</span>
                </div>
                <div class="detail-row">
                    <span>Order Type:</span>
                    <span class="detail-value">${formatOrderType(order.order_type)}</span>
                </div>
                <div class="detail-row">
                    <span>Side:</span>
                    <span class="detail-value ${order.side.toLowerCase()}">${order.side}</span>
                </div>
                <div class="detail-row">
                    <span>Cryptocurrency:</span>
                    <span class="detail-value">${order.cryptocurrency}</span>
                </div>
                <div class="detail-row">
                    <span>Status:</span>
                    <span class="detail-value ${getStatusClass(order.status)}">${order.status}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h6><i class="fas fa-chart-bar"></i> Quantity & Pricing</h6>
                <div class="detail-row">
                    <span>Quantity:</span>
                    <span class="detail-value">${parseFloat(order.quantity).toFixed(8)} ${order.cryptocurrency}</span>
                </div>
                ${order.filled_quantity ? `
                    <div class="detail-row">
                        <span>Filled Quantity:</span>
                        <span class="detail-value">${parseFloat(order.filled_quantity).toFixed(8)} ${order.cryptocurrency}</span>
                    </div>
                ` : ''}
                ${order.price ? `
                    <div class="detail-row">
                        <span>Limit Price:</span>
                        <span class="detail-value">$${parseFloat(order.price).toFixed(2)}</span>
                    </div>
                ` : ''}
                ${order.stop_price ? `
                    <div class="detail-row">
                        <span>Stop Price:</span>
                        <span class="detail-value">$${parseFloat(order.stop_price).toFixed(2)}</span>
                    </div>
                ` : ''}
                ${order.average_filled_price && parseFloat(order.average_filled_price) > 0 ? `
                    <div class="detail-row">
                        <span>Avg Filled Price:</span>
                        <span class="detail-value">$${parseFloat(order.average_filled_price).toFixed(2)}</span>
                    </div>
                ` : ''}
                <div class="detail-row">
                    <span>Current Market Price:</span>
                    <span class="detail-value">$${currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
                <div class="detail-row">
                    <span>Estimated Value:</span>
                    <span class="detail-value highlight">$${parseFloat(estimatedValue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                </div>
            </div>
            
            <div class="detail-section">
                <h6><i class="fas fa-clock"></i> Timing</h6>
                <div class="detail-row">
                    <span>Time in Force:</span>
                    <span class="detail-value">${order.time_in_force || 'GTC'}</span>
                </div>
                <div class="detail-row">
                    <span>Created:</span>
                    <span class="detail-value">${formatDateTime(order.created_at)}</span>
                </div>
                <div class="detail-row">
                    <span>Last Updated:</span>
                    <span class="detail-value">${formatDateTime(order.updated_at)}</span>
                </div>
                ${order.filled_at ? `
                    <div class="detail-row">
                        <span>Filled At:</span>
                        <span class="detail-value">${formatDateTime(order.filled_at)}</span>
                    </div>
                ` : ''}
                ${order.expires_at ? `
                    <div class="detail-row">
                        <span>Expires At:</span>
                        <span class="detail-value">${formatDateTime(order.expires_at)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Show/hide cancel button
    if (cancelBtn) {
        if (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') {
            cancelBtn.style.display = 'inline-block';
            cancelBtn.setAttribute('data-order-id', orderId);
        } else {
            cancelBtn.style.display = 'none';
        }
    }
    
    // Show modal
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
}

/**
 * Confirm order cancellation
 */
function confirmCancelOrder(orderId) {
    if (confirm('Are you sure you want to cancel this order?')) {
        cancelOrder(orderId);
    }
}

/**
 * Handle order cancellation
 */
function handleCancelOrder(event) {
    const orderId = event.target.getAttribute('data-order-id');
    if (orderId) {
        confirmCancelOrder(orderId);
    }
}

/**
 * Cancel an order
 */
async function cancelOrder(orderId) {
    try {
        console.log('🚫 Canceling order:', orderId);
        
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
        const url = API_ENDPOINTS.CANCEL_ORDER.replace('{order_id}', orderId);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message || 'Order cancelled successfully', 'success');
            
            // Close details modal if open
            const detailsModal = bootstrap.Modal.getInstance(document.getElementById('orderDetailsModal'));
            if (detailsModal) detailsModal.hide();
            
            // Reload orders
            loadOrders();
        } else {
            throw new Error(result.error || 'Failed to cancel order');
        }
    } catch (error) {
        console.error('❌ Error canceling order:', error);
        showToast(error.message || 'Failed to cancel order', 'error');
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format order type for display
 */
function formatOrderType(orderType) {
    const types = {
        'MARKET': 'Market',
        'LIMIT': 'Limit',
        'STOP_LOSS': 'Stop Loss',
        'TAKE_PROFIT': 'Take Profit'
    };
    return types[orderType] || orderType;
}

/**
 * Get CSS class for status
 */
function getStatusClass(status) {
    const classes = {
        'OPEN': 'status-open',
        'FILLED': 'status-filled',
        'PARTIALLY_FILLED': 'status-partial',
        'CANCELLED': 'status-cancelled',
        'EXPIRED': 'status-expired'
    };
    return classes[status] || 'status-default';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Format date and time for display
 */
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Update element text content
 */
function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.warn('Toast container not found');
        return;
    }
    
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
    document.addEventListener('DOMContentLoaded', initializeOrderSystem);
} else {
    initializeOrderSystem();
}

// Re-load orders when tab becomes visible
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        loadOrders();
        loadCryptoPrices();
    }
});
