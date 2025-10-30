"""
Custom template filters for number formatting
"""
from django import template
from decimal import Decimal

register = template.Library()


@register.filter(name='abbreviate_number')
def abbreviate_number(value):
    """
    Abbreviate large numbers with K, M, B, T suffixes
    
    Examples:
        1234 -> 1.23K
        1234567 -> 1.23M
        1234567890 -> 1.23B
        1234567890123 -> 1.23T
    """
    try:
        # Convert to float
        num = float(value)
        
        # Handle negative numbers
        is_negative = num < 0
        num = abs(num)
        
        # Define suffixes and their thresholds
        if num >= 1_000_000_000_000:  # Trillion
            abbreviated = num / 1_000_000_000_000
            suffix = 'T'
        elif num >= 1_000_000_000:  # Billion
            abbreviated = num / 1_000_000_000
            suffix = 'B'
        elif num >= 1_000_000:  # Million
            abbreviated = num / 1_000_000
            suffix = 'M'
        elif num >= 1_000:  # Thousand
            abbreviated = num / 1_000
            suffix = 'K'
        else:
            # Return as is for numbers less than 1000
            return f"{'-' if is_negative else ''}{num:,.2f}"
        
        # Format with 2 decimal places
        result = f"{abbreviated:.2f}{suffix}"
        
        return f"{'-' if is_negative else ''}{result}"
    
    except (ValueError, TypeError, AttributeError):
        return value


@register.filter(name='compact_number')
def compact_number(value):
    """
    More compact number formatting with single decimal place for very large numbers
    
    Examples:
        2828169926158 -> $2.83T
        251834916363 -> $251.83B
    """
    try:
        num = float(value)
        is_negative = num < 0
        num = abs(num)
        
        if num >= 1_000_000_000_000:  # Trillion
            abbreviated = num / 1_000_000_000_000
            suffix = 'T'
            decimals = 2
        elif num >= 1_000_000_000:  # Billion
            abbreviated = num / 1_000_000_000
            suffix = 'B'
            decimals = 2
        elif num >= 1_000_000:  # Million
            abbreviated = num / 1_000_000
            suffix = 'M'
            decimals = 2
        elif num >= 1_000:  # Thousand
            abbreviated = num / 1_000
            suffix = 'K'
            decimals = 2
        else:
            return f"{'-' if is_negative else ''}{num:,.2f}"
        
        result = f"{abbreviated:.{decimals}f}{suffix}"
        return f"{'-' if is_negative else ''}{result}"
    
    except (ValueError, TypeError, AttributeError):
        return value
