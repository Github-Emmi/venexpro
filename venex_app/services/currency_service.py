"""
Currency Conversion Service
Handles real-time exchange rate fetching and currency conversions
"""

import requests
import logging
from decimal import Decimal
from django.core.cache import cache
from django.conf import settings
from datetime import timedelta

logger = logging.getLogger(__name__)


class CurrencyConversionService:
    """
    Service for handling currency conversions with exchange rate caching
    """
    
    # Free API endpoint for exchange rates (no API key required for basic usage)
    # Alternative APIs: 
    # - https://api.exchangerate-api.com/v4/latest/USD (Free, no key)
    # - https://open.er-api.com/v6/latest/USD (Free, no key)
    # - https://api.exchangerate.host/latest (Free, no key)
    EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD"
    
    # Fallback rates if API is unavailable (updated periodically)
    FALLBACK_RATES = {
        'USD': Decimal('1.00'),
        'NGN': Decimal('1580.00'),  # Nigerian Naira
        'EUR': Decimal('0.92'),     # Euro
        'GBP': Decimal('0.79'),     # British Pound
        'JPY': Decimal('149.50'),   # Japanese Yen
        'CAD': Decimal('1.36'),     # Canadian Dollar
        'AUD': Decimal('1.53'),     # Australian Dollar
        'NZD': Decimal('1.65'),     # New Zealand Dollar
        'ZAR': Decimal('18.75'),    # South African Rand
        'INR': Decimal('83.12'),    # Indian Rupee
        'CNY': Decimal('7.24'),     # Chinese Yuan
        'BRL': Decimal('4.97'),     # Brazilian Real
        'MXN': Decimal('17.05'),    # Mexican Peso
        'KRW': Decimal('1320.00'),  # South Korean Won
        'SGD': Decimal('1.34'),     # Singapore Dollar
    }
    
    # Cache timeout: 10 minutes
    CACHE_TIMEOUT = 600
    CACHE_KEY = 'exchange_rates_usd'
    
    @classmethod
    def get_exchange_rates(cls):
        """
        Fetch current exchange rates from USD to all currencies
        Uses caching to avoid excessive API calls
        
        Returns:
            dict: Exchange rates with currency codes as keys
        """
        # Try to get from cache first
        cached_rates = cache.get(cls.CACHE_KEY)
        if cached_rates:
            logger.info("Using cached exchange rates")
            return cached_rates
        
        # Fetch from API
        try:
            logger.info(f"Fetching exchange rates from {cls.EXCHANGE_RATE_API}")
            response = requests.get(cls.EXCHANGE_RATE_API, timeout=5)
            response.raise_for_status()
            
            data = response.json()
            rates = data.get('rates', {})
            
            if not rates:
                logger.warning("No rates returned from API, using fallback rates")
                return cls.FALLBACK_RATES
            
            # Convert to Decimal for precision
            decimal_rates = {
                currency: Decimal(str(rate)) 
                for currency, rate in rates.items()
            }
            
            # Add USD explicitly (always 1.00)
            decimal_rates['USD'] = Decimal('1.00')
            
            # Cache the rates
            cache.set(cls.CACHE_KEY, decimal_rates, cls.CACHE_TIMEOUT)
            logger.info(f"Cached {len(decimal_rates)} exchange rates for {cls.CACHE_TIMEOUT} seconds")
            
            return decimal_rates
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch exchange rates: {e}")
            logger.warning("Using fallback exchange rates")
            return cls.FALLBACK_RATES
        except Exception as e:
            logger.error(f"Unexpected error fetching exchange rates: {e}")
            return cls.FALLBACK_RATES
    
    @classmethod
    def get_exchange_rate(cls, from_currency='USD', to_currency='USD'):
        """
        Get exchange rate from one currency to another
        
        Args:
            from_currency (str): Source currency code (default: USD)
            to_currency (str): Target currency code (default: USD)
            
        Returns:
            Decimal: Exchange rate
        """
        if from_currency == to_currency:
            return Decimal('1.00')
        
        rates = cls.get_exchange_rates()
        
        # Our API returns rates from USD, so we need to calculate cross rates
        if from_currency == 'USD':
            # Direct conversion from USD to target
            rate = rates.get(to_currency, cls.FALLBACK_RATES.get(to_currency, Decimal('1.00')))
            return rate
        elif to_currency == 'USD':
            # Inverse conversion (from currency to USD)
            from_rate = rates.get(from_currency, cls.FALLBACK_RATES.get(from_currency, Decimal('1.00')))
            return Decimal('1.00') / from_rate if from_rate != 0 else Decimal('1.00')
        else:
            # Cross-rate conversion (e.g., EUR to GBP)
            from_rate = rates.get(from_currency, Decimal('1.00'))
            to_rate = rates.get(to_currency, Decimal('1.00'))
            
            # Convert through USD: from_currency -> USD -> to_currency
            usd_amount = Decimal('1.00') / from_rate if from_rate != 0 else Decimal('1.00')
            return usd_amount * to_rate
    
    @classmethod
    def convert_amount(cls, amount, from_currency='USD', to_currency='USD'):
        """
        Convert an amount from one currency to another
        
        Args:
            amount (Decimal|float|int): Amount to convert
            from_currency (str): Source currency code
            to_currency (str): Target currency code
            
        Returns:
            Decimal: Converted amount
        """
        if from_currency == to_currency:
            return Decimal(str(amount))
        
        amount_decimal = Decimal(str(amount))
        exchange_rate = cls.get_exchange_rate(from_currency, to_currency)
        
        converted = amount_decimal * exchange_rate
        logger.info(
            f"Converted {amount_decimal} {from_currency} to "
            f"{converted:.2f} {to_currency} (rate: {exchange_rate})"
        )
        
        return converted
    
    @classmethod
    def usd_to_user_currency(cls, usd_amount, user_currency):
        """
        Convert USD amount to user's currency
        
        Args:
            usd_amount (Decimal|float): Amount in USD
            user_currency (str): User's currency code
            
        Returns:
            Decimal: Amount in user's currency
        """
        return cls.convert_amount(usd_amount, 'USD', user_currency)
    
    @classmethod
    def user_currency_to_usd(cls, amount, user_currency):
        """
        Convert user's currency amount to USD
        
        Args:
            amount (Decimal|float): Amount in user's currency
            user_currency (str): User's currency code
            
        Returns:
            Decimal: Amount in USD
        """
        return cls.convert_amount(amount, user_currency, 'USD')
    
    @classmethod
    def get_currency_symbol(cls, currency_code):
        """
        Get currency symbol for display
        
        Args:
            currency_code (str): Currency code (e.g., 'USD', 'NGN')
            
        Returns:
            str: Currency symbol
        """
        symbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
            'NGN': '₦',
            'INR': '₹',
            'CNY': '¥',
            'KRW': '₩',
            'BRL': 'R$',
            'ZAR': 'R',
            'CAD': 'C$',
            'AUD': 'A$',
            'NZD': 'NZ$',
            'MXN': 'Mex$',
            'SGD': 'S$',
        }
        return symbols.get(currency_code, currency_code)
    
    @classmethod
    def format_currency(cls, amount, currency_code):
        """
        Format amount with currency symbol and proper decimal places
        
        Args:
            amount (Decimal|float): Amount to format
            currency_code (str): Currency code
            
        Returns:
            str: Formatted currency string
        """
        symbol = cls.get_currency_symbol(currency_code)
        
        # Most currencies use 2 decimal places
        # JPY and KRW use 0 decimal places
        if currency_code in ['JPY', 'KRW']:
            return f"{symbol}{amount:,.0f}"
        else:
            return f"{symbol}{amount:,.2f}"
    
    @classmethod
    def clear_cache(cls):
        """
        Clear the exchange rate cache
        Useful for forcing a refresh
        """
        cache.delete(cls.CACHE_KEY)
        logger.info("Exchange rate cache cleared")


# Convenience instance
currency_service = CurrencyConversionService()
