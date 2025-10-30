// WebSocket connection
        let ws = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        // Initial cryptocurrency data structure
        const cryptocurrencies = {
            'BTC': { name: 'Bitcoin', price: '115,617.00', change: '+3.587%', positive: true },
            'ETH': { name: 'Ethereum', price: '4,242.67', change: '+7.546%', positive: true },
            'USDT': { name: 'Tether', price: '1.00', change: '-0.018%', positive: false },
            'TRX': { name: 'Tron', price: '0.3014', change: '+2.100%', positive: true },
            'LTC': { name: 'Litecoin', price: '100.67', change: '+3.818%', positive: true }
        };

        // Initialize the display
        function initializeDisplay() {
            const cryptoGrid = document.getElementById('cryptoGrid');
            cryptoGrid.innerHTML = '';

            Object.entries(cryptocurrencies).forEach(([symbol, data]) => {
                const card = createCryptoCard(symbol, data);
                cryptoGrid.appendChild(card);
            });
        }

        // Create a cryptocurrency card
        function createCryptoCard(symbol, data) {
            const card = document.createElement('div');
            card.className = 'crypto-card';
            card.id = `card-${symbol}`;

            card.innerHTML = `
                <div class="crypto-header">
                    <div>
                        <div class="crypto-symbol">${symbol} - USD</div>
                        <div class="crypto-name">${data.name}</div>
                    </div>
                    <div class="rank">#${getRank(symbol)}</div>
                </div>
                <div class="price-display">
                    <div class="current-price digital-display">$ ${data.price}</div>
                    <div class="price-change ${data.positive ? 'positive' : 'negative'}">
                        ${data.change}
                    </div>
                </div>
                <div class="crypto-details">
                    <div class="detail-item">
                        <div class="detail-label">Market Cap</div>
                        <div class="detail-value market-cap digital-display" id="cap-${symbol}">${formatMarketCap(symbol)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">24h Volume</div>
                        <div class="detail-value volume digital-display" id="vol-${symbol}">${formatVolume(symbol)}</div>
                    </div>
                </div>
            `;

            return card;
        }

        // Helper functions
        function getRank(symbol) {
            const ranks = { 'BTC': 1, 'ETH': 2, 'USDT': 3, 'TRX': 10, 'LTC': 30 };
            return ranks[symbol] || '-';
        }

        function formatMarketCap(symbol) {
            const caps = {
                'BTC': '$2.30T', 'ETH': '$512.0B', 'USDT': '$183.2B',
                'TRX': '$28.5B', 'LTC': '$7.69B'
            };
            return caps[symbol] || '-';
        }

        function formatVolume(symbol) {
            const volumes = {
                'BTC': '$52.2B', 'ETH': '$33.0B', 'USDT': '$96.1B',
                'TRX': '$848M', 'LTC': '$545M'
            };
            return volumes[symbol] || '-';
        }

        // Connect to WebSocket
        function connectWebSocket() {
            try {
                ws = new WebSocket('ws://www.venexbtc.com/ws/market/');

                ws.onopen = function() {
                    console.log('WebSocket connected');
                    updateConnectionStatus(true);
                    reconnectAttempts = 0;
                };

                ws.onmessage = function(event) {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'market_data') {
                            updateMarketData(data.data);
                        }
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                };

                ws.onclose = function() {
                    console.log('WebSocket disconnected');
                    updateConnectionStatus(false);
                    attemptReconnect();
                };

                ws.onerror = function(error) {
                    console.error('WebSocket error:', error);
                    updateConnectionStatus(false);
                };

            } catch (error) {
                console.error('WebSocket connection failed:', error);
                updateConnectionStatus(false);
            }
        }

        // Update market data from WebSocket
        function updateMarketData(marketData) {
            // Update market statistics
            if (marketData.market_stats) {
                document.getElementById('activeCryptos').textContent = marketData.market_stats.active_cryptocurrencies;
                document.getElementById('totalMarketCap').textContent = '$' + abbreviateNumber(marketData.market_stats.total_market_cap);
                document.getElementById('totalVolume').textContent = '$' + abbreviateNumber(marketData.market_stats.total_volume_24h);
                document.getElementById('btcDominance').textContent = `${marketData.market_stats.btc_dominance.toFixed(2)}%`;
            }

            // Update cryptocurrency cards
            if (marketData.cryptocurrencies) {
                marketData.cryptocurrencies.forEach(crypto => {
                    updateCryptoCard(crypto);
                });
            }

            // Update timestamp
            document.getElementById('updateTime').textContent = new Date().toLocaleTimeString();

            // Add pulse animation to indicate update
            const cryptoGrid = document.getElementById('cryptoGrid');
            cryptoGrid.classList.add('pulse');
            setTimeout(() => cryptoGrid.classList.remove('pulse'), 1000);
        }

        // Update individual cryptocurrency card
        function updateCryptoCard(crypto) {
            const card = document.getElementById(`card-${crypto.symbol}`);
            if (!card) return;

            const priceElement = card.querySelector('.current-price');
            const changeElement = card.querySelector('.price-change');
            const marketCapElement = card.getElementById(`cap-${crypto.symbol}`);
            const volumeElement = card.getElementById(`vol-${crypto.symbol}`);

            if (priceElement) {
                priceElement.textContent = `$ ${parseFloat(crypto.current_price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            }

            if (changeElement) {
                const isPositive = parseFloat(crypto.price_change_percentage_24h) >= 0;
                changeElement.textContent = `${isPositive ? '+' : ''}${parseFloat(crypto.price_change_percentage_24h).toFixed(2)}%`;
                changeElement.className = `price-change ${isPositive ? 'positive' : 'negative'}`;
            }

            if (marketCapElement) {
                marketCapElement.textContent = '$' + abbreviateNumber(parseFloat(crypto.market_cap));
            }

            if (volumeElement) {
                volumeElement.textContent = '$' + abbreviateNumber(parseFloat(crypto.volume_24h));
            }
        }

        //

        // Attempt to reconnect
        function attemptReconnect() {
            if (reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                console.log(`Attempting to reconnect... (${reconnectAttempts}/${maxReconnectAttempts})`);
                setTimeout(connectWebSocket, 3000 * reconnectAttempts);
            } else {
                console.log('Max reconnection attempts reached');
            }
        }

        // Format numbers with commas
        function formatNumber(number) {
            return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }

        // Abbreviate large numbers with K, M, B, T suffixes
        function abbreviateNumber(value) {
            const num = parseFloat(value);
            if (isNaN(num)) return value;
            
            const absNum = Math.abs(num);
            const isNegative = num < 0;
            
            let abbreviated, suffix;
            
            if (absNum >= 1e12) {  // Trillion
                abbreviated = absNum / 1e12;
                suffix = 'T';
            } else if (absNum >= 1e9) {  // Billion
                abbreviated = absNum / 1e9;
                suffix = 'B';
            } else if (absNum >= 1e6) {  // Million
                abbreviated = absNum / 1e6;
                suffix = 'M';
            } else if (absNum >= 1e3) {  // Thousand
                abbreviated = absNum / 1e3;
                suffix = 'K';
            } else {
                return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            
            return `${isNegative ? '-' : ''}${abbreviated.toFixed(2)}${suffix}`;
        }

        // Initialize when page loads
        // Populate initial market stats from backend context
        function populateInitialMarketStats() {
            if (window.initialMarketStats) {
                document.getElementById('activeCryptos').textContent = window.initialMarketStats.activeCryptos;
                document.getElementById('totalMarketCap').textContent = '$' + abbreviateNumber(window.initialMarketStats.totalMarketCap);
                document.getElementById('totalVolume').textContent = '$' + abbreviateNumber(window.initialMarketStats.totalVolume);
                document.getElementById('btcDominance').textContent = window.initialMarketStats.btcDominance + '%';
                document.getElementById('updateTime').textContent = window.initialMarketStats.lastUpdated;
            }
        }

        document.addEventListener('DOMContentLoaded', function() {
            populateInitialMarketStats();
            initializeDisplay();
            connectWebSocket();

            // Simulate price updates for demo (remove in production)
            setInterval(() => {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    // Add small random fluctuations to demo live updates
                    Object.keys(cryptocurrencies).forEach(symbol => {
                        const card = document.getElementById(`card-${symbol}`);
                        if (card) {
                            const priceElement = card.querySelector('.current-price');
                            if (priceElement) {
                                const currentPrice = parseFloat(priceElement.textContent.replace(/[$,]/g, ''));
                                const fluctuation = (Math.random() - 0.5) * 10;
                                const newPrice = currentPrice + fluctuation;
                                priceElement.textContent = `$ ${newPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                        }
                    });
                    document.getElementById('updateTime').textContent = new Date().toLocaleTimeString();
                }
            }, 5000);
        });

        // Quick Trade Form Handling
        const quickTradeForm = document.getElementById('quickTradeForm');
        const tradeButtons = document.querySelectorAll('.trade-btn');
        let currentTradeType = 'buy';

        // Trade type toggle
        tradeButtons.forEach(button => {
            button.addEventListener('click', () => {
                tradeButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentTradeType = button.dataset.type;
            });
        });

        // Quick trade form submission
        if (quickTradeForm) {
            quickTradeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(quickTradeForm);
                const data = {
                    type: currentTradeType,
                    cryptocurrency: formData.get('cryptocurrency'),
                    amount: formData.get('amount')
                };

                try {
                    const response = await fetch('/api/trade/quick/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify(data)
                    });

                    const result = await response.json();
                    
                    if (response.ok) {
                        // Show success message
                        showNotification('Trade executed successfully!', 'success');
                        quickTradeForm.reset();
                    } else {
                        // Show error message
                        showNotification(result.message || 'Trade failed. Please try again.', 'error');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    showNotification('An error occurred. Please try again.', 'error');
                }
            });
        }

        // Helper function to get CSRF token
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

        // Notification system
        function showNotification(message, type) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }

        // Market sentiment update
        function updateMarketSentiment() {
            const analysisTime = document.getElementById('analysisTime');
            if (analysisTime) {
                analysisTime.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
            }
        }

        // Update market sentiment every minute
        setInterval(updateMarketSentiment, 60000);