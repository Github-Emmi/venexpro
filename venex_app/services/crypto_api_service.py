from decimal import Decimal
import os
import requests
import logging
from django.utils import timezone
from django.db import transaction
from django.conf import settings
from ..models import Cryptocurrency, PriceHistory
from ..choices import CRYPTO_CHOICES

logger = logging.getLogger(__name__)

class CryptoDataService:
    """
    Service for fetching and updating cryptocurrency data from external APIs
    Supports multiple providers with fallback
    """
    
    def __init__(self):
        self.providers = [
            self._fetch_from_coingecko,
            self._fetch_from_binance,
            self._fetch_from_cryptocompare
        ]
        self.base_currencies = ['USD', 'USDT']
        
        # Load API keys from environment
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY', '')
        self.binance_api_key = os.getenv('BINANCE_API_KEY', '')
        self.binance_secret_key = os.getenv('BINANCE_SECRET_KEY', '')
    
    def get_market_overview(self):
        """
        Get market overview data for dashboard
        """
        try:
            cryptocurrencies = Cryptocurrency.objects.filter(is_active=True)
            
            total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies)
            total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies)
            
            # Get top gainers and losers
            gainers = cryptocurrencies.filter(price_change_percentage_24h__gt=0).order_by('-price_change_percentage_24h')[:5]
            losers = cryptocurrencies.filter(price_change_percentage_24h__lt=0).order_by('price_change_percentage_24h')[:5]
            
            return {
                'total_market_cap': total_market_cap,
                'total_volume_24h': total_volume,
                'active_cryptocurrencies': cryptocurrencies.count(),
                'market_dominance': self._calculate_market_dominance(cryptocurrencies),
                'top_gainers': [
                    {
                        'symbol': crypto.symbol,
                        'price': float(crypto.current_price),
                        'change_24h': float(crypto.price_change_24h),
                        'change_percentage_24h': float(crypto.price_change_percentage_24h)
                    }
                    for crypto in gainers
                ],
                'top_losers': [
                    {
                        'symbol': crypto.symbol,
                        'price': float(crypto.current_price),
                        'change_24h': float(crypto.price_change_24h),
                        'change_percentage_24h': float(crypto.price_change_percentage_24h)
                    }
                    for crypto in losers
                ]
            }
        except Exception as e:
            logger.error(f"Error getting market overview: {e}")
            return {}
    
    def _calculate_market_dominance(self, cryptocurrencies):
        """
        Calculate market dominance percentages
        """
        try:
            total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies)
            dominance = {}
            
            for crypto in cryptocurrencies:
                if crypto.market_cap and total_market_cap > 0:
                    dominance[crypto.symbol] = (float(crypto.market_cap) / total_market_cap) * 100
            
            return dominance
        except Exception as e:
            logger.error(f"Error calculating market dominance: {e}")
            return {}
    
    def get_price_history(self, symbol, range_param='1d'):
        """
        Get price history for different time ranges
        """
        try:
            # Map range parameter to days
            range_mapping = {
                '1d': 1,
                '7d': 7,
                '30d': 30,
                '90d': 90,
                '1y': 365
            }
            
            days = range_mapping.get(range_param, 30)
            return self.get_historical_data(symbol, days)
            
        except Exception as e:
            logger.error(f"Error getting price history for {symbol}: {e}")
            return {'error': str(e)}
    
    def get_crypto_price(self, symbol):
        """
        Get current price for a single cryptocurrency
        """
        try:
            crypto = Cryptocurrency.objects.get(symbol=symbol.upper())
            return crypto.current_price
        except Cryptocurrency.DoesNotExist:
            # Fallback to API fetch
            prices = self.get_multiple_prices([symbol])
            return prices.get(symbol, {}).get('price', Decimal('0.0'))
    

    def _fetch_from_coingecko(self, symbols):
        """Fetch data from CoinGecko API with API key"""
        try:
            # Map symbols to CoinGecko IDs
            coin_mapping = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum', 
                'USDT': 'tether',
                'LTC': 'litecoin',
                'TRX': 'tron'
            }
            
            coin_ids = [coin_mapping.get(symbol.upper(), symbol.lower()) for symbol in symbols]
            coin_ids = [coin_id for coin_id in coin_ids if coin_id]
            
            url = "https://api.coingecko.com/api/v3/coins/markets"
            params = {
                'vs_currency': 'usd',
                'ids': ','.join(coin_ids),
                'order': 'market_cap_desc',
                'per_page': 100,
                'page': 1,
                'sparkline': 'false',
                'price_change_percentage': '24h'
            }
            
            headers = {}
            if self.coingecko_api_key:
                headers['x-cg-demo-api-key'] = self.coingecko_api_key
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"CoinGecko API success: fetched {len(data)} coins")
                return self._parse_coingecko_data(data)
            elif response.status_code == 429:
                logger.warning("CoinGecko API rate limit reached")
            else:
                logger.error(f"CoinGecko API error: {response.status_code}")
                
        except requests.exceptions.Timeout:
            logger.error("CoinGecko API timeout")
        except Exception as e:
            logger.error(f"CoinGecko API error: {e}")
        return None
    
    def _fetch_from_binance(self, symbols):
        """Fetch data from Binance API"""
        try:
            data = {}
            for symbol in symbols:
                if symbol == 'USDT':
                    # USDT is stablecoin, hardcode values
                    data[symbol] = {
                        'price': 1.0,
                        'change_24h': 0.0,
                        'change_percentage_24h': 0.0,
                        'volume': 0,
                        'market_cap': 0
                    }
                    continue
                    
                url = "https://api.binance.com/api/v3/ticker/24hr"
                params = {'symbol': f'{symbol}USDT'}
                
                headers = {}
                if self.binance_api_key:
                    headers['X-MBX-APIKEY'] = self.binance_api_key
                
                response = requests.get(url, params=params, headers=headers, timeout=5)
                if response.status_code == 200:
                    ticker_data = response.json()
                    data[symbol] = {
                        'price': float(ticker_data.get('lastPrice', 0)),
                        'change_24h': float(ticker_data.get('priceChange', 0)),
                        'change_percentage_24h': float(ticker_data.get('priceChangePercent', 0)),
                        'volume': float(ticker_data.get('volume', 0)),
                        'market_cap': 0  # Binance doesn't provide market cap
                    }
                else:
                    logger.warning(f"Binance API error for {symbol}: {response.status_code}")
            return data
        except Exception as e:
            logger.error(f"Binance API error: {e}")
        return None
    
    def _fetch_from_cryptocompare(self, symbols):
        """Fetch data from CryptoCompare API (free tier)"""
        try:
            url = "https://min-api.cryptocompare.com/data/pricemultifull"
            params = {
                'fsyms': ','.join(symbols),
                'tsyms': 'USD'
                # No API key needed for basic free tier
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self._parse_cryptocompare_data(data)
        except Exception as e:
            logger.error(f"CryptoCompare API error: {e}")
        return None
    
    def _parse_coingecko_data(self, data):
        """Parse CoinGecko API response"""
        parsed_data = {}
        for coin in data:
            symbol = coin['symbol'].upper()
            parsed_data[symbol] = {
                'price': coin['current_price'],
                'change_24h': coin['price_change_24h'],
                'change_percentage_24h': coin['price_change_percentage_24h'],
                'volume': coin['total_volume'],
                'market_cap': coin['market_cap'],
                'circulating_supply': coin.get('circulating_supply', 0),
                'total_supply': coin.get('total_supply', 0),
                'max_supply': coin.get('max_supply'),
                'rank': coin.get('market_cap_rank', 0)
            }
        return parsed_data
    
    def _parse_cryptocompare_data(self, data):
        """Parse CryptoCompare API response"""
        parsed_data = {}
        raw_data = data.get('RAW', {})
        
        for symbol, coin_data in raw_data.items():
            usd_data = coin_data.get('USD', {})
            parsed_data[symbol] = {
                'price': usd_data.get('PRICE', 0),
                'change_24h': usd_data.get('CHANGEPCT24HOUR', 0),
                'change_percentage_24h': usd_data.get('CHANGEPCT24HOUR', 0),
                'volume': usd_data.get('VOLUME24HOURTO', 0),
                'market_cap': usd_data.get('MKTCAP', 0),
                'circulating_supply': usd_data.get('SUPPLY', 0),
                'total_supply': usd_data.get('TOTALSUPPLY', 0),
                'max_supply': usd_data.get('MAXSUPPLY', 0),
                'rank': 0  # CryptoCompare doesn't provide rank
            }
        return parsed_data
    
    ## crypto_api_service.py for getting historical data for charting displays
    def get_historical_data(self, symbol, days=30):
        """Get historical price data with multiple provider fallback"""
        
        # Try CoinGecko first
        cg_data = self._get_historical_from_coingecko(symbol, days)
        if cg_data:
            return cg_data
        
        # Try CryptoCompare as fallback
        cc_data = self._get_historical_from_cryptocompare(symbol, days)
        if cc_data:
            return cc_data
        
        # Try Binance as third option
        binance_data = self._get_historical_from_binance(symbol, days)
        if binance_data:
            return binance_data
        
        # Final fallback to database
        return self._get_historical_from_database(symbol, days)

    def _get_historical_from_coingecko(self, symbol, days):
        """CoinGecko implementation without interval parameter"""
        try:
            coin_mapping = {
                'BTC': 'bitcoin', 'ETH': 'ethereum', 'USDT': 'tether',
                'LTC': 'litecoin', 'TRX': 'tron'
            }
            
            coin_id = coin_mapping.get(symbol.upper())
            if not coin_id:
                return None
            
            url = f"https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': days
            }
            
            headers = {}
            if self.coingecko_api_key:
                headers['x-cg-demo-api-key'] = self.coingecko_api_key
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                prices = data.get('prices', [])
                
                historical_data = []
                for price_point in prices:
                    timestamp, price = price_point
                    historical_data.append({
                        'timestamp': timestamp / 1000,
                        'price': price,
                        'volume': 0
                    })
            
                logger.info(f"CoinGecko: Fetched {len(historical_data)} data points for {symbol}")
                return historical_data
            else:
                logger.warning(f"CoinGecko historical data error: {response.status_code}")
                return None
            
        except Exception as e:
            logger.error(f"CoinGecko historical data error for {symbol}: {e}")
            return None

    def _get_historical_from_cryptocompare(self, symbol, days):
        """CryptoCompare fallback implementation"""
        try:
            url = "https://min-api.cryptocompare.com/data/v2/histoday"
            params = {
                'fsym': symbol,
                'tsym': 'USD',
                'limit': min(days, 2000)  # CryptoCompare limit
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                historical_data = []
                
                for item in data.get('Data', {}).get('Data', []):
                    historical_data.append({
                        'timestamp': item['time'],
                        'price': item['close'],
                        'volume': item['volumeto']
                    })
            
                logger.info(f"CryptoCompare: Fetched {len(historical_data)} data points for {symbol}")
                return historical_data
            
        except Exception as e:
            logger.error(f"CryptoCompare historical data error for {symbol}: {e}")
        
        return None

    def _get_historical_from_binance(self, symbol, days):
        """Binance fallback implementation"""
        try:
            if symbol == 'USDT':
                return None  # Binance doesn't have USDT charts
            
            interval = '1d' if days > 7 else '1h'
            url = f"https://api.binance.com/api/v3/klines"
            params = {
                'symbol': f'{symbol}USDT',
                'interval': interval,
                'limit': min(days * (24 if interval == '1h' else 1), 1000)
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                historical_data = []
                
                for kline in data:
                    historical_data.append({
                        'timestamp': kline[0] / 1000,  # Convert to seconds
                        'price': float(kline[4]),  # Close price
                        'volume': float(kline[5])  # Volume
                    })
            
                logger.info(f"Binance: Fetched {len(historical_data)} data points for {symbol}")
                return historical_data
                
        except Exception as e:
            logger.error(f"Binance historical data error for {symbol}: {e}")
    
        return None
        
        # Fallback to database historical data
        return self._get_historical_from_database(symbol, days)
    
    def _get_historical_from_database(self, symbol, days):
        """Fallback: Get historical data from our database"""
        try:
            crypto = Cryptocurrency.objects.get(symbol=symbol)
            end_date = timezone.now()
            start_date = end_date - timezone.timedelta(days=days)
            
            history = PriceHistory.objects.filter(
                cryptocurrency=crypto,
                timestamp__gte=start_date
            ).order_by('timestamp')
            
            return [
                {
                    'timestamp': entry.timestamp.timestamp(),
                    'price': float(entry.price),
                    'volume': float(entry.volume)
                }
                for entry in history
            ]
        except Cryptocurrency.DoesNotExist:
            return []
    
    @transaction.atomic
    def update_cryptocurrency_data(self):
        """Update all cryptocurrency data in database with enhanced error handling"""
        symbols = [choice[0] for choice in CRYPTO_CHOICES]
        crypto_data = None
        
        # Try providers in order until we get data
        for provider in self.providers:
            crypto_data = provider(symbols)
            if crypto_data:
                logger.info(f"Successfully fetched data from {provider.__name__}")
                break
        
        if not crypto_data:
            logger.error("All cryptocurrency API providers failed")
            return False
        
        updated_count = 0
        for symbol, data in crypto_data.items():
            try:
                crypto, created = Cryptocurrency.objects.get_or_create(
                    symbol=symbol,
                    defaults={
                        'name': self._get_coin_name(symbol),
                        'current_price': data['price'],
                        'price_change_24h': data['change_24h'],
                        'price_change_percentage_24h': data['change_percentage_24h'],
                        'market_cap': data.get('market_cap', 0),
                        'volume_24h': data.get('volume', 0),
                        'circulating_supply': data.get('circulating_supply', 0),
                        'total_supply': data.get('total_supply', 0),
                        'max_supply': data.get('max_supply'),
                        'rank': data.get('rank', 0)
                    }
                )
                
                if not created:
                    # Update existing cryptocurrency
                    crypto.current_price = data['price']
                    crypto.price_change_24h = data['change_24h']
                    crypto.price_change_percentage_24h = data['change_percentage_24h']
                    crypto.market_cap = data.get('market_cap', crypto.market_cap)
                    crypto.volume_24h = data.get('volume', crypto.volume_24h)
                    crypto.circulating_supply = data.get('circulating_supply', crypto.circulating_supply)
                    crypto.total_supply = data.get('total_supply', crypto.total_supply)
                    crypto.max_supply = data.get('max_supply', crypto.max_supply)
                    crypto.rank = data.get('rank', crypto.rank)
                    crypto.save()
                
                # Create price history entry (limit to avoid database bloat)
                recent_entries = PriceHistory.objects.filter(
                    cryptocurrency=crypto,
                    timestamp__gte=timezone.now() - timezone.timedelta(hours=1)
                ).count()
                
                if recent_entries == 0:  # Only save if no recent entry
                    PriceHistory.objects.create(
                        cryptocurrency=crypto,
                        price=data['price'],
                        volume=data.get('volume', 0),
                        market_cap=data.get('market_cap', 0),
                        timestamp=timezone.now()
                    )
                
                updated_count += 1
                
            except Exception as e:
                logger.error(f"Error updating {symbol}: {e}")
                continue
        
        logger.info(f"Updated {updated_count} cryptocurrencies")
        return True
    
    def _get_coin_name(self, symbol):
        """Get full coin name from symbol"""
        name_mapping = {
            'BTC': 'Bitcoin',
            'ETH': 'Ethereum',
            'USDT': 'Tether',
            'LTC': 'Litecoin',
            'TRX': 'Tron'
        }
        return name_mapping.get(symbol, symbol)
    
    def get_multiple_prices(self, symbols):
        """Get current prices for multiple symbols"""
        prices = {}
        for symbol in symbols:
            try:
                crypto = Cryptocurrency.objects.get(symbol=symbol)
                prices[symbol] = {
                    'price': float(crypto.current_price),
                    'change_24h': float(crypto.price_change_24h),
                    'change_percentage_24h': float(crypto.price_change_percentage_24h),
                    'market_cap': float(crypto.market_cap),
                    'volume_24h': float(crypto.volume_24h)
                }
            except Cryptocurrency.DoesNotExist:
                prices[symbol] = {
                    'price': 0, 
                    'change_24h': 0, 
                    'change_percentage_24h': 0,
                    'market_cap': 0,
                    'volume_24h': 0
                }
        return prices

# Global instance
crypto_service = CryptoDataService()