/**
 * ========================================
 * TRANSACTION HISTORY JAVASCRIPT
 * ========================================
 * Manages transaction and order history display
 * Features: Filtering, Search, Pagination, Export
 */

(function($) {
    'use strict';

    // ========================================
    // STATE MANAGEMENT
    // ========================================
    const state = {
        currentTab: 'transactions',
        transactions: {
            data: [],
            currentPage: 1,
            perPage: 25,
            totalPages: 1,
            totalCount: 0,
            filters: {
                search: '',
                type: '',
                status: '',
                crypto: '',
                startDate: '',
                endDate: ''
            }
        },
        orders: {
            data: [],
            currentPage: 1,
            perPage: 25,
            totalPages: 1,
            totalCount: 0,
            filters: {
                search: '',
                orderType: '',
                side: '',
                status: '',
                crypto: '',
                startDate: '',
                endDate: ''
            }
        },
        statistics: {
            totalTransactions: 0,
            completed: 0,
            pending: 0,
            totalVolume: 0
        }
    };

    // ========================================
    // INITIALIZATION
    // ========================================
    $(document).ready(function() {
        console.log('✅ Transaction History JavaScript loaded!');
        console.log('jQuery version:', $.fn.jquery);
        initializeDatePickers();
        attachEventListeners();
        loadCryptocurrencyOptions();
        loadTransactionHistory();
    });

    // ========================================
    // DATE PICKER INITIALIZATION
    // ========================================
    function initializeDatePickers() {
        // Initialize Flatpickr for date range
        if (typeof flatpickr !== 'undefined') {
            flatpickr("#date-range", {
                mode: "range",
                dateFormat: "Y-m-d",
                maxDate: "today",
                onChange: function(selectedDates) {
                    if (selectedDates.length === 2) {
                        state.transactions.filters.startDate = selectedDates[0].toISOString().split('T')[0];
                        state.transactions.filters.endDate = selectedDates[1].toISOString().split('T')[0];
                        state.transactions.currentPage = 1;
                        loadTransactionHistory();
                    }
                }
            });

            flatpickr("#export-date-range", {
                mode: "range",
                dateFormat: "Y-m-d",
                maxDate: "today"
            });
        }
    }

    // ========================================
    // LOAD CRYPTOCURRENCY OPTIONS
    // ========================================
    function loadCryptocurrencyOptions() {
        // Fetch available cryptocurrencies from the API
        $.ajax({
            url: '/api/cryptocurrencies/',
            method: 'GET',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            success: function(response) {
                const cryptoSelect = $('#crypto-filter');
                if (response.success && response.cryptocurrencies) {
                    response.cryptocurrencies.forEach(function(crypto) {
                        cryptoSelect.append(`<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`);
                    });
                } else if (Array.isArray(response)) {
                    // Handle array response format
                    response.forEach(function(crypto) {
                        const symbol = crypto.symbol || crypto.code;
                        const name = crypto.name;
                        cryptoSelect.append(`<option value="${symbol}">${name} (${symbol})</option>`);
                    });
                }
            },
            error: function(xhr) {
                console.warn('Could not load cryptocurrency options:', xhr);
                // Use default options if API fails
                const defaultCryptos = [
                    {symbol: 'BTC', name: 'Bitcoin'},
                    {symbol: 'ETH', name: 'Ethereum'},
                    {symbol: 'USDT', name: 'Tether'},
                    {symbol: 'BNB', name: 'Binance Coin'},
                    {symbol: 'SOL', name: 'Solana'},
                    {symbol: 'XRP', name: 'Ripple'},
                    {symbol: 'DOGE', name: 'Dogecoin'},
                    {symbol: 'ADA', name: 'Cardano'}
                ];
                const cryptoSelect = $('#crypto-filter');
                defaultCryptos.forEach(function(crypto) {
                    cryptoSelect.append(`<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`);
                });
            }
        });
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================
    function attachEventListeners() {
        // Tab switching
        $('.tab-btn').on('click', function() {
            const tab = $(this).data('tab');
            switchTab(tab);
        });

        // Search input with debounce
        let searchTimeout;
        $('#search-input').on('input', function() {
            clearTimeout(searchTimeout);
            const query = $(this).val();
            searchTimeout = setTimeout(function() {
                state.transactions.filters.search = query;
                state.transactions.currentPage = 1;
                loadTransactionHistory();
            }, 500);
        });

        // Filter changes
        $('#type-filter').on('change', function() {
            state.transactions.filters.type = $(this).val();
            state.transactions.currentPage = 1;
            loadTransactionHistory();
        });

        $('#status-filter').on('change', function() {
            state.transactions.filters.status = $(this).val();
            state.transactions.currentPage = 1;
            loadTransactionHistory();
        });

        $('#crypto-filter').on('change', function() {
            state.transactions.filters.crypto = $(this).val();
            state.transactions.currentPage = 1;
            loadTransactionHistory();
        });

        // Clear filters
        $('#clear-filters-btn').on('click', function() {
            clearFilters();
        });

        // Refresh button
        $('#refresh-btn').on('click', function() {
            const icon = $(this).find('i');
            icon.addClass('fa-spin');
            if (state.currentTab === 'transactions') {
                loadTransactionHistory().finally(() => icon.removeClass('fa-spin'));
            } else {
                loadOrderHistory().finally(() => icon.removeClass('fa-spin'));
            }
        });

        // Per page selector
        $('#per-page-select').on('change', function() {
            state.transactions.perPage = parseInt($(this).val());
            state.transactions.currentPage = 1;
            loadTransactionHistory();
        });

        $('#orders-per-page-select').on('change', function() {
            state.orders.perPage = parseInt($(this).val());
            state.orders.currentPage = 1;
            loadOrderHistory();
        });

        // Pagination buttons
        $('#first-page').on('click', () => goToPage(1));
        $('#prev-page').on('click', () => goToPage(state.transactions.currentPage - 1));
        $('#next-page').on('click', () => goToPage(state.transactions.currentPage + 1));
        $('#last-page').on('click', () => goToPage(state.transactions.totalPages));

        $('#orders-first-page').on('click', () => goToOrderPage(1));
        $('#orders-prev-page').on('click', () => goToOrderPage(state.orders.currentPage - 1));
        $('#orders-next-page').on('click', () => goToOrderPage(state.orders.currentPage + 1));
        $('#orders-last-page').on('click', () => goToOrderPage(state.orders.totalPages));

        // Export functionality
        $('#export-btn').on('click', function() {
            $('#exportModal').modal('show');
        });

        $('#confirm-export-btn').on('click', function() {
            exportHistory();
        });

        // Print receipt
        $('#print-receipt-btn').on('click', function() {
            window.print();
        });

        // Download receipt as PDF
        $('#download-receipt-btn').on('click', function() {
            downloadReceiptPDF();
        });
    }

    // ========================================
    // TAB SWITCHING
    // ========================================
    function switchTab(tab) {
        state.currentTab = tab;
        
        // Update tab buttons
        $('.tab-btn').removeClass('active');
        $(`.tab-btn[data-tab="${tab}"]`).addClass('active');
        
        // Update tab content
        $('.tab-content').removeClass('active');
        $(`#${tab}-tab`).addClass('active');
        
        // Load appropriate data
        if (tab === 'transactions') {
            if (state.transactions.data.length === 0) {
                loadTransactionHistory();
            }
        } else if (tab === 'orders') {
            if (state.orders.data.length === 0) {
                loadOrderHistory();
            }
        }
    }

    // ========================================
    // LOAD TRANSACTION HISTORY
    // ========================================
    function loadTransactionHistory() {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                page: state.transactions.currentPage,
                per_page: state.transactions.perPage,
                type: state.transactions.filters.type,
                status: state.transactions.filters.status,
                crypto: state.transactions.filters.crypto,
                search: state.transactions.filters.search,
                start_date: state.transactions.filters.startDate,
                end_date: state.transactions.filters.endDate
            });

            // Show loading state
            $('#transactions-tbody').html(`
                <tr class="loading-row">
                    <td colspan="9">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading transactions...</p>
                        </div>
                    </td>
                </tr>
            `);

            const apiUrl = `/api/transactions/history/?${params.toString()}`;
            console.log('Loading transactions from:', apiUrl);
            
            $.ajax({
                url: apiUrl,
                method: 'GET',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                success: function(response) {
                    console.log('Transaction API Response:', response);
                    if (response.success) {
                        state.transactions.data = response.transactions;
                        state.transactions.totalPages = response.pagination.total_pages;
                        state.transactions.totalCount = response.pagination.total_count;
                        state.transactions.currentPage = response.pagination.current_page;
                        
                        if (response.statistics) {
                            state.statistics = response.statistics;
                            updateStatistics();
                        }
                        
                        renderTransactions();
                        updateTransactionPagination();
                        resolve(response);
                    } else {
                        showError('Failed to load transactions');
                        reject(response.error);
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Error loading transactions:', {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        responseText: xhr.responseText,
                        error: error
                    });
                    
                    let errorMessage = 'Failed to load transactions. Please try again.';
                    
                    if (xhr.status === 401 || xhr.status === 403) {
                        errorMessage = 'Authentication required. Please log in.';
                    } else if (xhr.status === 404) {
                        errorMessage = 'API endpoint not found. Please contact support.';
                    } else if (xhr.status === 500) {
                        errorMessage = 'Server error. Please try again later.';
                    }
                    
                    $('#transactions-tbody').html(`
                        <tr>
                            <td colspan="9">
                                <div class="empty-state">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <p>${errorMessage}</p>
                                    <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
                                        Error Code: ${xhr.status} | ${xhr.statusText}
                                    </small>
                                </div>
                            </td>
                        </tr>
                    `);
                    reject(xhr);
                }
            });
        });
    }

    // ========================================
    // LOAD ORDER HISTORY
    // ========================================
    function loadOrderHistory() {
        return new Promise((resolve, reject) => {
            const params = new URLSearchParams({
                page: state.orders.currentPage,
                per_page: state.orders.perPage,
                order_type: state.orders.filters.orderType,
                side: state.orders.filters.side,
                status: state.orders.filters.status,
                crypto: state.orders.filters.crypto,
                search: state.orders.filters.search,
                start_date: state.orders.filters.startDate,
                end_date: state.orders.filters.endDate
            });

            // Show loading state
            $('#orders-tbody').html(`
                <tr class="loading-row">
                    <td colspan="10">
                        <div class="loading-state">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Loading orders...</p>
                        </div>
                    </td>
                </tr>
            `);

            $.ajax({
                url: `/api/orders/history/?${params.toString()}`,
                method: 'GET',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                success: function(response) {
                    if (response.success) {
                        state.orders.data = response.orders;
                        state.orders.totalPages = response.pagination.total_pages;
                        state.orders.totalCount = response.pagination.total_count;
                        state.orders.currentPage = response.pagination.current_page;
                        
                        renderOrders();
                        updateOrderPagination();
                        resolve(response);
                    } else {
                        showError('Failed to load orders');
                        reject(response.error);
                    }
                },
                error: function(xhr) {
                    console.error('Error loading orders:', xhr);
                    $('#orders-tbody').html(`
                        <tr>
                            <td colspan="10">
                                <div class="empty-state">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <p>Failed to load orders. Please try again.</p>
                                </div>
                            </td>
                        </tr>
                    `);
                    reject(xhr);
                }
            });
        });
    }

    // ========================================
    // RENDER TRANSACTIONS
    // ========================================
    function renderTransactions() {
        const tbody = $('#transactions-tbody');
        tbody.empty();

        if (state.transactions.data.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="9">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>No transactions found</p>
                        </div>
                    </td>
                </tr>
            `);
            return;
        }

        state.transactions.data.forEach(function(txn) {
            const row = createTransactionRow(txn);
            tbody.append(row);
        });

        // Update showing count
        const start = (state.transactions.currentPage - 1) * state.transactions.perPage + 1;
        const end = Math.min(start + state.transactions.data.length - 1, state.transactions.totalCount);
        $('#showing-count').text(`Showing ${start}-${end} of ${state.transactions.totalCount}`);
    }

    // ========================================
    // CREATE TRANSACTION ROW
    // ========================================
    function createTransactionRow(txn) {
        const date = new Date(txn.created_at);
        const formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const formattedTime = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const typeClass = txn.transaction_type.toLowerCase();
        const statusClass = txn.status.toLowerCase();
        
        const typeIcon = {
            'BUY': 'fa-arrow-down',
            'SELL': 'fa-arrow-up',
            'DEPOSIT': 'fa-plus',
            'WITHDRAWAL': 'fa-minus'
        }[txn.transaction_type] || 'fa-exchange-alt';

        const statusIcon = {
            'COMPLETED': 'fa-check',
            'PENDING': 'fa-clock',
            'FAILED': 'fa-times',
            'CANCELLED': 'fa-ban'
        }[txn.status] || 'fa-question';

        const cryptoSymbol = txn.cryptocurrency ? txn.cryptocurrency.symbol : 'N/A';
        const cryptoName = txn.cryptocurrency ? txn.cryptocurrency.name : 'N/A';

        return $(`
            <tr data-transaction-id="${txn.id}">
                <td>
                    <div>${formattedDate}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${formattedTime}</div>
                </td>
                <td>
                    <code style="font-size: 0.85rem;">${txn.id.substring(0, 8)}...</code>
                </td>
                <td>
                    <span class="type-badge ${typeClass}">
                        <i class="fas ${typeIcon}"></i>
                        ${txn.transaction_type}
                    </span>
                </td>
                <td>
                    <strong>${cryptoSymbol}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${cryptoName}</div>
                </td>
                <td>${parseFloat(txn.quantity).toFixed(8)}</td>
                <td>$${parseFloat(txn.price_per_unit).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>
                    <strong>$${parseFloat(txn.fiat_amount || txn.total_amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i>
                        ${txn.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action" onclick="viewTransactionDetails('${txn.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `);
    }

    // ========================================
    // RENDER ORDERS
    // ========================================
    function renderOrders() {
        const tbody = $('#orders-tbody');
        tbody.empty();

        if (state.orders.data.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="10">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>No orders found</p>
                        </div>
                    </td>
                </tr>
            `);
            return;
        }

        state.orders.data.forEach(function(order) {
            const row = createOrderRow(order);
            tbody.append(row);
        });

        // Update showing count
        const start = (state.orders.currentPage - 1) * state.orders.perPage + 1;
        const end = Math.min(start + state.orders.data.length - 1, state.orders.totalCount);
        $('#orders-showing-count').text(`Showing ${start}-${end} of ${state.orders.totalCount}`);
    }

    // ========================================
    // CREATE ORDER ROW
    // ========================================
    function createOrderRow(order) {
        const date = new Date(order.created_at);
        const formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        const formattedTime = date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const sideClass = order.side.toLowerCase();
        const statusClass = order.status.toLowerCase();
        
        const filledPercentage = (parseFloat(order.filled_quantity) / parseFloat(order.quantity) * 100).toFixed(2);

        return $(`
            <tr data-order-id="${order.id}">
                <td>
                    <div>${formattedDate}</div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${formattedTime}</div>
                </td>
                <td>
                    <code style="font-size: 0.85rem;">${order.id.substring(0, 8)}...</code>
                </td>
                <td>
                    <span class="type-badge">${order.order_type}</span>
                </td>
                <td>
                    <span class="type-badge ${sideClass}">
                        ${order.side}
                    </span>
                </td>
                <td>
                    <strong>${order.cryptocurrency}</strong>
                </td>
                <td>${parseFloat(order.quantity).toFixed(8)}</td>
                <td>$${parseFloat(order.price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td>
                    ${filledPercentage}%
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        ${parseFloat(order.filled_quantity).toFixed(8)} / ${parseFloat(order.quantity).toFixed(8)}
                    </div>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${order.status}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action" onclick="viewOrderDetails('${order.id}')" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `);
    }

    // ========================================
    // UPDATE STATISTICS
    // ========================================
    function updateStatistics() {
        $('#total-transactions').text(state.statistics.totalTransactions.toLocaleString());
        $('#completed-count').text(state.statistics.completed.toLocaleString());
        $('#pending-count').text(state.statistics.pending.toLocaleString());
        $('#total-volume').text('$' + state.statistics.totalVolume.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }));
    }

    // ========================================
    // PAGINATION
    // ========================================
    function updateTransactionPagination() {
        const { currentPage, totalPages } = state.transactions;
        
        // Update pagination info
        $('#pagination-info').text(`Page ${currentPage} of ${totalPages}`);
        
        // Update button states
        $('#first-page').prop('disabled', currentPage === 1);
        $('#prev-page').prop('disabled', currentPage === 1);
        $('#next-page').prop('disabled', currentPage === totalPages || totalPages === 0);
        $('#last-page').prop('disabled', currentPage === totalPages || totalPages === 0);
        
        // Update page numbers
        renderPageNumbers('#page-numbers', currentPage, totalPages);
    }

    function updateOrderPagination() {
        const { currentPage, totalPages } = state.orders;
        
        // Update pagination info
        $('#orders-pagination-info').text(`Page ${currentPage} of ${totalPages}`);
        
        // Update button states
        $('#orders-first-page').prop('disabled', currentPage === 1);
        $('#orders-prev-page').prop('disabled', currentPage === 1);
        $('#orders-next-page').prop('disabled', currentPage === totalPages || totalPages === 0);
        $('#orders-last-page').prop('disabled', currentPage === totalPages || totalPages === 0);
        
        // Update page numbers
        renderPageNumbers('#orders-page-numbers', currentPage, totalPages);
    }

    function renderPageNumbers(selector, currentPage, totalPages) {
        const container = $(selector);
        container.empty();
        
        if (totalPages <= 0) {
            container.append('<button class="page-number active">1</button>');
            return;
        }
        
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, currentPage + 2);
        
        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(totalPages, startPage + 4);
            } else if (endPage === totalPages) {
                startPage = Math.max(1, endPage - 4);
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const btn = $(`<button class="page-number ${i === currentPage ? 'active' : ''}">${i}</button>`);
            btn.on('click', function() {
                if (selector.includes('orders')) {
                    goToOrderPage(i);
                } else {
                    goToPage(i);
                }
            });
            container.append(btn);
        }
    }

    function goToPage(page) {
        if (page >= 1 && page <= state.transactions.totalPages) {
            state.transactions.currentPage = page;
            loadTransactionHistory();
        }
    }

    function goToOrderPage(page) {
        if (page >= 1 && page <= state.orders.totalPages) {
            state.orders.currentPage = page;
            loadOrderHistory();
        }
    }

    // ========================================
    // FILTERS
    // ========================================
    function clearFilters() {
        // Reset filter values
        $('#search-input').val('');
        $('#type-filter').val('');
        $('#status-filter').val('');
        $('#crypto-filter').val('');
        $('#date-range').val('');
        
        // Reset state
        state.transactions.filters = {
            search: '',
            type: '',
            status: '',
            crypto: '',
            startDate: '',
            endDate: ''
        };
        state.transactions.currentPage = 1;
        
        // Reload data
        loadTransactionHistory();
    }

    // ========================================
    // VIEW TRANSACTION DETAILS
    // ========================================
    window.viewTransactionDetails = function(transactionId) {
        const transaction = state.transactions.data.find(t => t.id === transactionId);
        if (!transaction) return;
        
        const cryptoSymbol = transaction.cryptocurrency ? transaction.cryptocurrency.symbol : 'N/A';
        const cryptoName = transaction.cryptocurrency ? transaction.cryptocurrency.name : 'N/A';
        
        const date = new Date(transaction.created_at);
        const formattedDate = date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const receiptHTML = `
            <div class="receipt-container">
                <div class="receipt-header">
                    <div class="receipt-logo">
                        <i class="fas fa-bitcoin"></i>
                    </div>
                    <h3 class="receipt-title">Transaction Receipt</h3>
                    <p style="color: var(--text-secondary);">Venex Trading Platform</p>
                </div>
                
                <div class="receipt-body">
                    <div class="receipt-row">
                        <span class="receipt-label">Transaction ID:</span>
                        <span class="receipt-value"><code>${transaction.id}</code></span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Date & Time:</span>
                        <span class="receipt-value">${formattedDate}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Type:</span>
                        <span class="receipt-value">${transaction.transaction_type}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Status:</span>
                        <span class="receipt-value">
                            <span class="status-badge ${transaction.status.toLowerCase()}">
                                ${transaction.status}
                            </span>
                        </span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Cryptocurrency:</span>
                        <span class="receipt-value">${cryptoName} (${cryptoSymbol})</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Quantity:</span>
                        <span class="receipt-value">${parseFloat(transaction.quantity).toFixed(8)} ${cryptoSymbol}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Price per Unit:</span>
                        <span class="receipt-value">$${parseFloat(transaction.price_per_unit).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Network Fee:</span>
                        <span class="receipt-value">$${parseFloat(transaction.network_fee).toFixed(2)}</span>
                    </div>
                    <div class="receipt-row">
                        <span class="receipt-label">Platform Fee:</span>
                        <span class="receipt-value">$${parseFloat(transaction.platform_fee).toFixed(2)}</span>
                    </div>
                    ${transaction.transaction_hash ? `
                    <div class="receipt-row">
                        <span class="receipt-label">Transaction Hash:</span>
                        <span class="receipt-value"><code style="font-size: 0.8rem; word-break: break-all;">${transaction.transaction_hash}</code></span>
                    </div>
                    ` : ''}
                    ${transaction.wallet_address ? `
                    <div class="receipt-row">
                        <span class="receipt-label">Wallet Address:</span>
                        <span class="receipt-value"><code style="font-size: 0.8rem; word-break: break-all;">${transaction.wallet_address}</code></span>
                    </div>
                    ` : ''}
                    <div class="receipt-row receipt-total">
                        <span class="receipt-label" style="font-size: 1.2rem;">Total Amount:</span>
                        <span class="receipt-value">$${parseFloat(transaction.fiat_amount || transaction.total_amount).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>
        `;
        
        $('#transaction-details-content').html(receiptHTML);
        $('#transactionDetailsModal').modal('show');
    };

    // ========================================
    // VIEW ORDER DETAILS
    // ========================================
    window.viewOrderDetails = function(orderId) {
        const order = state.orders.data.find(o => o.id === orderId);
        if (!order) return;
        
        alert(`Order Details for ${orderId}\n\nThis feature will show detailed order information.`);
    };

    // ========================================
    // EXPORT HISTORY
    // ========================================
    function exportHistory() {
        const format = $('input[name="export-format"]:checked').val();
        const dateRange = $('#export-date-range').val();
        
        if (format === 'csv') {
            exportToCSV();
        } else if (format === 'xlsx') {
            exportToExcel();
        } else if (format === 'pdf') {
            exportToPDF();
        }
        
        $('#exportModal').modal('hide');
    }

    function exportToCSV() {
        const headers = ['Date', 'Transaction ID', 'Type', 'Cryptocurrency', 'Amount', 'Price', 'Total', 'Status'];
        const rows = state.transactions.data.map(txn => {
            const cryptoSymbol = txn.cryptocurrency ? txn.cryptocurrency.symbol : 'N/A';
            return [
                new Date(txn.created_at).toLocaleString(),
                txn.id,
                txn.transaction_type,
                cryptoSymbol,
                txn.quantity,
                txn.price_per_unit,
                txn.fiat_amount || txn.total_amount,
                txn.status
            ];
        });
        
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.join(',') + '\n';
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transaction_history_${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    function exportToExcel() {
        alert('Excel export feature will be implemented with a library like SheetJS');
    }

    function exportToPDF() {
        if (typeof jsPDF === 'undefined') {
            alert('PDF library not loaded');
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text('Transaction History', 14, 22);
        doc.setFontSize(11);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        
        const tableData = state.transactions.data.map(txn => {
            const cryptoSymbol = txn.cryptocurrency ? txn.cryptocurrency.symbol : 'N/A';
            return [
                new Date(txn.created_at).toLocaleDateString(),
                txn.id.substring(0, 8),
                txn.transaction_type,
                cryptoSymbol,
                parseFloat(txn.quantity).toFixed(4),
                '$' + parseFloat(txn.price_per_unit).toFixed(2),
                '$' + parseFloat(txn.fiat_amount || txn.total_amount).toFixed(2),
                txn.status
            ];
        });
        
        doc.autoTable({
            head: [['Date', 'TX ID', 'Type', 'Crypto', 'Amount', 'Price', 'Total', 'Status']],
            body: tableData,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });
        
        doc.save(`transaction_history_${Date.now()}.pdf`);
    }

    function downloadReceiptPDF() {
        alert('Receipt PDF download will be implemented');
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function showError(message) {
        console.error(message);
        // You can implement a toast notification here
    }

})(jQuery);
