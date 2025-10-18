import requests
import logging
from django.utils import timezone
from django.db import transaction
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
    
    def _fetch_from_coingecko(self, symbols):
        """Fetch data from CoinGecko API"""
        try:
            # Map symbols to CoinGecko IDs
            coin_mapping = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum', 
                'USDT': 'tether',
                'LTC': 'litecoin',
                'TRX': 'tron'
            }
            
            coin_ids = [coin_mapping.get(symbol.lower(), symbol.lower()) for symbol in symbols]
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
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return self._parse_coingecko_data(data)
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
                    
                url = f"https://api.binance.com/api/v3/ticker/24hr"
                params = {'symbol': f'{symbol}USDT'}
                
                response = requests.get(url, params=params, timeout=5)
                if response.status_code == 200:
                    ticker_data = response.json()
                    data[symbol] = {
                        'price': float(ticker_data.get('lastPrice', 0)),
                        'change_24h': float(ticker_data.get('priceChange', 0)),
                        'change_percentage_24h': float(ticker_data.get('priceChangePercent', 0)),
                        'volume': float(ticker_data.get('volume', 0)),
                        'market_cap': 0  # Binance doesn't provide market cap
                    }
            return data
        except Exception as e:
            logger.error(f"Binance API error: {e}")
        return None
    
    def _fetch_from_cryptocompare(self, symbols):
        """Fetch data from CryptoCompare API"""
        try:
            url = "https://min-api.cryptocompare.com/data/pricemultifull"
            params = {
                'fsyms': ','.join(symbols),
                'tsyms': 'USD',
                'api_key': 'your_api_key_here'  # Optional: add your API key
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
                'volume': usd_data.get('VOLUME24HOUR', 0),
                'market_cap': usd_data.get('MKTCAP', 0),
                'circulating_supply': usd_data.get('SUPPLY', 0),
                'total_supply': usd_data.get('TOTALSUPPLY', 0),
                'max_supply': usd_data.get('MAXSUPPLY', 0),
                'rank': 0  # CryptoCompare doesn't provide rank
            }
        return parsed_data
    
    @transaction.atomic
    def update_cryptocurrency_data(self):
        """Update all cryptocurrency data in database"""
        symbols = [choice[0] for choice in CRYPTO_CHOICES]
        crypto_data = None
        
        # Try providers in order until we get data
        for provider in self.providers:
            crypto_data = provider(symbols)
            if crypto_data:
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
                
                # Create price history entry
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
    
    def get_historical_data(self, symbol, days=30):
        """Get historical price data for charting"""
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
                    'timestamp': entry.timestamp.isoformat(),
                    'price': float(entry.price),
                    'volume': float(entry.volume)
                }
                for entry in history
            ]
        except Cryptocurrency.DoesNotExist:
            return []
    
    def get_multiple_prices(self, symbols):
        """Get current prices for multiple symbols"""
        prices = {}
        for symbol in symbols:
            try:
                crypto = Cryptocurrency.objects.get(symbol=symbol)
                prices[symbol] = {
                    'price': float(crypto.current_price),
                    'change_24h': float(crypto.price_change_24h),
                    'change_percentage_24h': float(crypto.price_change_percentage_24h)
                }
            except Cryptocurrency.DoesNotExist:
                prices[symbol] = {'price': 0, 'change_24h': 0, 'change_percentage_24h': 0}
        return prices

# Global instance
crypto_service = CryptoDataService()