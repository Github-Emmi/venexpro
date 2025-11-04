/**
 * Transaction History Page JavaScript
 * Handles transaction loading, filtering, pagination, and export
 */

(function() {
    'use strict';

    // ================================
    // Configuration & State
    // ================================
    const CONFIG = {
        API_ENDPOINT: '/api/transactions/history/',
        DEFAULT_PER_PAGE: 25,
        DEBOUNCE_DELAY: 500
    };

    const state = {
        currentPage: 1,
        perPage: CONFIG.DEFAULT_PER_PAGE,
        totalPages: 1,
        totalTransactions: 0,
        filters: {
            search: '',
            type: '',
            status: '',
            crypto: '',
            dateFrom: '',
            dateTo: ''
        },
        transactions: [],
        currentTransaction: null
    };

    // ================================
    // DOM Elements
    // ================================
    const elements = {
        // Statistics
        totalTransactions: document.getElementById('totalTransactions'),
        completedCount: document.getElementById('completedCount'),
        pendingCount: document.getElementById('pendingCount'),
        totalVolume: document.getElementById('totalVolume'),
        
        // Filters
        searchInput: document.getElementById('searchInput'),
        dateRange: document.getElementById('dateRange'),
        typeFilter: document.getElementById('typeFilter'),
        statusFilter: document.getElementById('statusFilter'),
        cryptoFilter: document.getElementById('cryptoFilter'),
        clearFiltersBtn: document.getElementById('clearFiltersBtn'),
        
        // Table
        tableBody: document.getElementById('transactionsTableBody'),
        showingCount: document.getElementById('showingCount'),
        
        // Pagination
        paginationInfo: document.getElementById('paginationInfo'),
        firstPage: document.getElementById('firstPage'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        lastPage: document.getElementById('lastPage'),
        pageNumbers: document.getElementById('pageNumbers'),
        perPageSelect: document.getElementById('perPageSelect'),
        
        // Actions
        refreshBtn: document.getElementById('refreshBtn'),
        exportBtn: document.getElementById('exportBtn'),
        
        // Modals
        transactionModal: document.getElementById('transactionModal'),
        transactionDetailsBody: document.getElementById('transactionDetailsBody'),
        downloadReceiptBtn: document.getElementById('downloadReceiptBtn'),
        exportModal: document.getElementById('exportModal'),
        exportDateRange: document.getElementById('exportDateRange'),
        confirmExportBtn: document.getElementById('confirmExportBtn')
    };

    // ================================
    // Initialization
    // ================================
    function init() {
        console.log('Initializing Transaction History...');
        
        // Initialize date pickers
        initializeDatePickers();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load initial data
        loadTransactions();
    }

    // ================================
    // Date Pickers
    // ================================
    function initializeDatePickers() {
        if (typeof flatpickr === 'undefined') {
            console.warn('Flatpickr not loaded');
            return;
        }

        // Main date range filter
        flatpickr(elements.dateRange, {
            mode: 'range',
            dateFormat: 'Y-m-d',
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    state.filters.dateFrom = formatDate(selectedDates[0]);
                    state.filters.dateTo = formatDate(selectedDates[1]);
                    state.currentPage = 1;
                    loadTransactions();
                }
            }
        });

        // Export date range
        flatpickr(elements.exportDateRange, {
            mode: 'range',
            dateFormat: 'Y-m-d'
        });
    }

    // ================================
    // Event Listeners
    // ================================
    function setupEventListeners() {
        // Search with debounce
        let searchTimeout;
        elements.searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.filters.search = e.target.value;
                state.currentPage = 1;
                loadTransactions();
            }, CONFIG.DEBOUNCE_DELAY);
        });

        // Filter changes
        elements.typeFilter.addEventListener('change', function(e) {
            state.filters.type = e.target.value;
            state.currentPage = 1;
            loadTransactions();
        });

        elements.statusFilter.addEventListener('change', function(e) {
            state.filters.status = e.target.value;
            state.currentPage = 1;
            loadTransactions();
        });

        elements.cryptoFilter.addEventListener('change', function(e) {
            state.filters.crypto = e.target.value;
            state.currentPage = 1;
            loadTransactions();
        });

        // Clear filters
        elements.clearFiltersBtn.addEventListener('click', clearFilters);

        // Pagination
        elements.firstPage.addEventListener('click', () => goToPage(1));
        elements.prevPage.addEventListener('click', () => goToPage(state.currentPage - 1));
        elements.nextPage.addEventListener('click', () => goToPage(state.currentPage + 1));
        elements.lastPage.addEventListener('click', () => goToPage(state.totalPages));
        
        elements.perPageSelect.addEventListener('change', function(e) {
            state.perPage = parseInt(e.target.value);
            state.currentPage = 1;
            loadTransactions();
        });

        // Actions
        elements.refreshBtn.addEventListener('click', () => {
            const icon = elements.refreshBtn.querySelector('i');
            icon.classList.add('fa-spin');
            loadTransactions().finally(() => {
                icon.classList.remove('fa-spin');
            });
        });

        elements.exportBtn.addEventListener('click', () => {
            if (typeof bootstrap !== 'undefined') {
                const modal = new bootstrap.Modal(elements.exportModal);
                modal.show();
            } else {
                console.error('Bootstrap is not loaded');
            }
        });

        elements.confirmExportBtn.addEventListener('click', handleExport);
        elements.downloadReceiptBtn.addEventListener('click', downloadReceipt);
    }

    // ================================
    // API Calls
    // ================================
    function loadTransactions() {
        showLoading();

        const params = new URLSearchParams({
            page: state.currentPage,
            per_page: state.perPage
        });

        // Add filters
        if (state.filters.search) params.append('search', state.filters.search);
        if (state.filters.type) params.append('type', state.filters.type);
        if (state.filters.status) params.append('status', state.filters.status);
        if (state.filters.crypto) params.append('crypto', state.filters.crypto);
        if (state.filters.dateFrom) params.append('date_from', state.filters.dateFrom);
        if (state.filters.dateTo) params.append('date_to', state.filters.dateTo);

        // Get CSRF token
        const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
                         getCookie('csrftoken');

        return fetch(`${CONFIG.API_ENDPOINT}?${params}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRFToken': csrfToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            console.log('API Response Status:', response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('API Error Response:', text);
                    throw new Error(`HTTP error! status: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('API Response Data:', data);
            if (data.success) {
                state.transactions = data.transactions || [];
                state.totalPages = data.pagination?.total_pages || 1;
                state.totalTransactions = data.pagination?.total || 0;
                
                updateStatistics(data.statistics);
                renderTransactions();
                updatePagination();
            } else {
                console.error('API returned success: false', data);
                showError(data.message || 'Failed to load transactions');
            }
        })
        .catch(error => {
            console.error('Error loading transactions:', error);
            showError('Failed to load transactions. Please try again.');
        });
    }

    // ================================
    // Rendering
    // ================================
    function updateStatistics(stats) {
        if (!stats) return;

        if (elements.totalTransactions) {
            elements.totalTransactions.textContent = formatNumber(stats.total_transactions || 0);
        }
        if (elements.completedCount) {
            elements.completedCount.textContent = formatNumber(stats.completed || 0);
        }
        if (elements.pendingCount) {
            elements.pendingCount.textContent = formatNumber(stats.pending || 0);
        }
        if (elements.totalVolume) {
            elements.totalVolume.textContent = formatCurrency(stats.total_volume || 0);
        }
    }

    function renderTransactions() {
        if (state.transactions.length === 0) {
            showEmpty();
            return;
        }

        const rows = state.transactions.map(transaction => createTransactionRow(transaction)).join('');
        elements.tableBody.innerHTML = rows;

        // Update showing count
        const start = (state.currentPage - 1) * state.perPage + 1;
        const end = Math.min(state.currentPage * state.perPage, state.totalTransactions);
        elements.showingCount.textContent = `Showing ${start}-${end} of ${state.totalTransactions}`;
    }

    function createTransactionRow(tx) {
        const typeClass = tx.transaction_type.toLowerCase();
        const statusClass = tx.status.toLowerCase();
        
        return `
            <tr>
                <td>
                    <div style="white-space: nowrap;">
                        <div style="font-weight: 600;">${formatDate(tx.created_at)}</div>
                        <div style="font-size: 0.85rem; color: #6b7280;">${formatTime(tx.created_at)}</div>
                    </div>
                </td>
                <td>
                    <code style="font-size: 0.85rem; color: #4f46e5;">${tx.id.substring(0, 8)}...</code>
                </td>
                <td>
                    <span class="type-badge ${typeClass}">
                        <i class="fas fa-${getTypeIcon(tx.transaction_type)}"></i>
                        ${tx.transaction_type}
                    </span>
                </td>
                <td>
                    <div class="crypto-info">
                        <div class="crypto-icon">${getCryptoIcon(tx.cryptocurrency_symbol)}</div>
                        <div class="crypto-details">
                            <span class="crypto-name">${tx.cryptocurrency_name}</span>
                            <span class="crypto-symbol">${tx.cryptocurrency_symbol}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div>
                        <span class="amount-value">${formatCryptoAmount(tx.quantity)}</span>
                        <span class="amount-unit">${tx.cryptocurrency_symbol}</span>
                    </div>
                </td>
                <td>
                    <span class="amount-value">${formatCurrency(tx.price_per_unit)}</span>
                </td>
                <td>
                    <span class="amount-value">${formatCurrency(tx.total_amount)}</span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas fa-${getStatusIcon(tx.status)}"></i>
                        ${tx.status}
                    </span>
                </td>
                <td>
                    <button class="action-btn" onclick="window.historyApp.viewDetails('${tx.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }

    function updatePagination() {
        // Update info
        elements.paginationInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;

        // Update buttons
        elements.firstPage.disabled = state.currentPage === 1;
        elements.prevPage.disabled = state.currentPage === 1;
        elements.nextPage.disabled = state.currentPage === state.totalPages;
        elements.lastPage.disabled = state.currentPage === state.totalPages;

        // Render page numbers
        renderPageNumbers();
    }

    function renderPageNumbers() {
        const maxPages = 5;
        let startPage = Math.max(1, state.currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(state.totalPages, startPage + maxPages - 1);

        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }

        let html = '';
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === state.currentPage ? 'active' : '';
            html += `<button class="page-num ${activeClass}" onclick="window.historyApp.goToPage(${i})">${i}</button>`;
        }

        elements.pageNumbers.innerHTML = html;
    }

    function goToPage(page) {
        if (page < 1 || page > state.totalPages || page === state.currentPage) return;
        state.currentPage = page;
        loadTransactions();
    }

    // ================================
    // UI States
    // ================================
    function showLoading() {
        elements.tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="9">
                    <div class="loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>Loading transactions...</p>
                    </div>
                </td>
            </tr>
        `;
    }

    function showEmpty() {
        elements.tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="9">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No transactions found</p>
                    </div>
                </td>
            </tr>
        `;
        elements.showingCount.textContent = 'Showing 0 of 0';
    }

    function showError(message) {
        elements.tableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="9">
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${message}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    // ================================
    // Transaction Details
    // ================================
    function viewDetails(transactionId) {
        const transaction = state.transactions.find(tx => tx.id === transactionId);
        if (!transaction) return;

        state.currentTransaction = transaction;

        const html = `
            <div class="transaction-details">
                <div class="detail-section">
                    <h6>Transaction Information</h6>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Transaction ID</span>
                            <span class="detail-value">${transaction.id}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Date & Time</span>
                            <span class="detail-value">${formatDateTime(transaction.created_at)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type</span>
                            <span class="detail-value">${transaction.transaction_type}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">${transaction.status}</span>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h6>Asset Details</h6>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Cryptocurrency</span>
                            <span class="detail-value">${transaction.cryptocurrency_name} (${transaction.cryptocurrency_symbol})</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Quantity</span>
                            <span class="detail-value">${formatCryptoAmount(transaction.quantity)} ${transaction.cryptocurrency_symbol}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Price per Unit</span>
                            <span class="detail-value">${formatCurrency(transaction.price_per_unit)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Total Amount</span>
                            <span class="detail-value">${formatCurrency(transaction.total_amount)}</span>
                        </div>
                    </div>
                </div>

                ${transaction.transaction_hash ? `
                <div class="detail-section">
                    <h6>Blockchain Details</h6>
                    <div class="detail-grid">
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Transaction Hash</span>
                            <span class="detail-value" style="word-break: break-all;">${transaction.transaction_hash}</span>
                        </div>
                        ${transaction.wallet_address ? `
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Wallet Address</span>
                            <span class="detail-value" style="word-break: break-all;">${transaction.wallet_address}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}

                ${transaction.network_fee || transaction.platform_fee ? `
                <div class="detail-section">
                    <h6>Fees</h6>
                    <div class="detail-grid">
                        ${transaction.network_fee ? `
                        <div class="detail-item">
                            <span class="detail-label">Network Fee</span>
                            <span class="detail-value">${formatCurrency(transaction.network_fee)}</span>
                        </div>
                        ` : ''}
                        ${transaction.platform_fee ? `
                        <div class="detail-item">
                            <span class="detail-label">Platform Fee</span>
                            <span class="detail-value">${formatCurrency(transaction.platform_fee)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        elements.transactionDetailsBody.innerHTML = html;
        
        if (typeof bootstrap !== 'undefined') {
            const modal = new bootstrap.Modal(elements.transactionModal);
            modal.show();
        } else {
            console.error('Bootstrap is not loaded');
        }
    }

    // ================================
    // Export Functions
    // ================================
    function handleExport() {
        const format = document.querySelector('input[name="format"]:checked').value;
        const dateRangePicker = elements.exportDateRange._flatpickr;
        const selectedDates = dateRangePicker?.selectedDates || [];

        let transactions = state.transactions;

        if (selectedDates.length === 2) {
            const from = selectedDates[0].getTime();
            const to = selectedDates[1].getTime();
            transactions = transactions.filter(tx => {
                const date = new Date(tx.created_at).getTime();
                return date >= from && date <= to;
            });
        }

        if (format === 'csv') {
            exportToCSV(transactions);
        } else if (format === 'pdf') {
            exportToPDF(transactions);
        }

        if (typeof bootstrap !== 'undefined') {
            const modalInstance = bootstrap.Modal.getInstance(elements.exportModal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
    }

    function exportToCSV(transactions) {
        const headers = ['Date', 'ID', 'Type', 'Cryptocurrency', 'Amount', 'Price', 'Total', 'Status'];
        const rows = transactions.map(tx => [
            formatDateTime(tx.created_at),
            tx.id,
            tx.transaction_type,
            `${tx.cryptocurrency_name} (${tx.cryptocurrency_symbol})`,
            `${formatCryptoAmount(tx.quantity)} ${tx.cryptocurrency_symbol}`,
            formatCurrency(tx.price_per_unit),
            formatCurrency(tx.total_amount),
            tx.status
        ]);

        const csv = [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        downloadFile(csv, 'transactions.csv', 'text/csv');
    }

    function exportToPDF(transactions) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text('Transaction History', 14, 20);
        
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const tableData = transactions.map(tx => [
            formatDate(tx.created_at),
            tx.id.substring(0, 8),
            tx.transaction_type,
            tx.cryptocurrency_symbol,
            formatCryptoAmount(tx.quantity),
            formatCurrency(tx.price_per_unit),
            formatCurrency(tx.total_amount),
            tx.status
        ]);

        doc.autoTable({
            startY: 35,
            head: [['Date', 'ID', 'Type', 'Crypto', 'Amount', 'Price', 'Total', 'Status']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8 }
        });

        doc.save('transactions.pdf');
    }

    function downloadReceipt() {
        if (!state.currentTransaction) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const tx = state.currentTransaction;

        // Header
        doc.setFontSize(20);
        doc.text('VENEX Brokerage', 14, 20);
        doc.setFontSize(12);
        doc.text('Transaction Receipt', 14, 28);

        // Transaction details
        doc.setFontSize(10);
        let y = 45;
        const addLine = (label, value) => {
            doc.text(`${label}:`, 14, y);
            doc.text(value, 80, y);
            y += 7;
        };

        addLine('Transaction ID', tx.id);
        addLine('Date & Time', formatDateTime(tx.created_at));
        addLine('Type', tx.transaction_type);
        addLine('Status', tx.status);
        addLine('Cryptocurrency', `${tx.cryptocurrency_name} (${tx.cryptocurrency_symbol})`);
        addLine('Quantity', `${formatCryptoAmount(tx.quantity)} ${tx.cryptocurrency_symbol}`);
        addLine('Price per Unit', formatCurrency(tx.price_per_unit));
        addLine('Total Amount', formatCurrency(tx.total_amount));

        if (tx.network_fee) addLine('Network Fee', formatCurrency(tx.network_fee));
        if (tx.platform_fee) addLine('Platform Fee', formatCurrency(tx.platform_fee));

        doc.save(`receipt-${tx.id.substring(0, 8)}.pdf`);
    }

    // ================================
    // Utilities
    // ================================
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

    function clearFilters() {
        state.filters = {
            search: '',
            type: '',
            status: '',
            crypto: '',
            dateFrom: '',
            dateTo: ''
        };
        
        elements.searchInput.value = '';
        elements.typeFilter.value = '';
        elements.statusFilter.value = '';
        elements.cryptoFilter.value = '';
        
        if (elements.dateRange._flatpickr) {
            elements.dateRange._flatpickr.clear();
        }
        
        state.currentPage = 1;
        loadTransactions();
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    function formatDateTime(dateString) {
        return `${formatDate(dateString)} at ${formatTime(dateString)}`;
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    function formatCryptoAmount(amount) {
        return parseFloat(amount || 0).toFixed(8).replace(/\.?0+$/, '');
    }

    function formatNumber(num) {
        return new Intl.NumberFormat('en-US').format(num || 0);
    }

    function getTypeIcon(type) {
        const icons = {
            'BUY': 'arrow-up',
            'SELL': 'arrow-down',
            'DEPOSIT': 'plus-circle',
            'WITHDRAWAL': 'minus-circle'
        };
        return icons[type] || 'exchange-alt';
    }

    function getStatusIcon(status) {
        const icons = {
            'COMPLETED': 'check-circle',
            'PENDING': 'clock',
            'FAILED': 'times-circle',
            'CANCELLED': 'ban'
        };
        return icons[status] || 'circle';
    }

    function getCryptoIcon(symbol) {
        return symbol.substring(0, 2).toUpperCase();
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ================================
    // Public API
    // ================================
    window.historyApp = {
        viewDetails,
        goToPage
    };

    // ================================
    // Start the app
    // ================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
