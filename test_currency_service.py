"""
Test script for Currency Conversion Service
Run with: python manage.py shell < test_currency_service.py
"""

from venex_app.services.currency_service import currency_service
from decimal import Decimal

print("=" * 60)
print("CURRENCY CONVERSION SERVICE TEST")
print("=" * 60)

# Test 1: Get exchange rates
print("\n1. Fetching exchange rates...")
rates = currency_service.get_exchange_rates()
print(f"   ✓ Fetched {len(rates)} exchange rates")
print(f"   Sample rates:")
for curr in ['USD', 'NGN', 'EUR', 'GBP', 'JPY']:
    if curr in rates:
        print(f"     1 USD = {rates[curr]} {curr}")

# Test 2: Get specific exchange rate
print("\n2. Getting specific exchange rate (USD to NGN)...")
rate = currency_service.get_exchange_rate('USD', 'NGN')
print(f"   ✓ 1 USD = {rate} NGN")

# Test 3: Convert amount USD to NGN
print("\n3. Converting 100 USD to NGN...")
usd_amount = Decimal('100.00')
ngn_amount = currency_service.usd_to_user_currency(usd_amount, 'NGN')
print(f"   ✓ ${usd_amount} USD = ₦{ngn_amount} NGN")

# Test 4: Convert amount NGN to USD
print("\n4. Converting 158,000 NGN to USD...")
ngn_amount = Decimal('158000.00')
usd_amount = currency_service.user_currency_to_usd(ngn_amount, 'NGN')
print(f"   ✓ ₦{ngn_amount} NGN = ${usd_amount} USD")

# Test 5: Format currency
print("\n5. Testing currency formatting...")
amounts = [
    (Decimal('1234.56'), 'USD'),
    (Decimal('1234567.89'), 'NGN'),
    (Decimal('999.99'), 'EUR'),
    (Decimal('12345'), 'JPY'),  # No decimals
]
for amount, currency in amounts:
    formatted = currency_service.format_currency(amount, currency)
    print(f"   ✓ {amount} {currency} = {formatted}")

# Test 6: Currency symbols
print("\n6. Getting currency symbols...")
currencies = ['USD', 'NGN', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD']
for curr in currencies:
    symbol = currency_service.get_currency_symbol(curr)
    print(f"   ✓ {curr} symbol: {symbol}")

# Test 7: Real-world scenario - Nigerian user buying 0.001 BTC at $40,000
print("\n7. Real-world scenario: Nigerian user buying 0.001 BTC")
btc_amount = Decimal('0.001')
btc_price_usd = Decimal('40000.00')
total_usd = btc_amount * btc_price_usd
network_fee_usd = total_usd * Decimal('0.001')
final_cost_usd = total_usd + network_fee_usd

print(f"   BTC Amount: {btc_amount} BTC")
print(f"   BTC Price: ${btc_price_usd} USD")
print(f"   Subtotal (USD): ${total_usd}")
print(f"   Network Fee (USD): ${network_fee_usd}")
print(f"   Total (USD): ${final_cost_usd}")

# Convert to NGN
total_ngn = currency_service.usd_to_user_currency(final_cost_usd, 'NGN')
print(f"\n   Converting to NGN...")
print(f"   Total (NGN): {currency_service.format_currency(total_ngn, 'NGN')}")

# Check if user has enough balance
user_balance_ngn = Decimal('500000.00')
print(f"\n   User Balance: {currency_service.format_currency(user_balance_ngn, 'NGN')}")
if user_balance_ngn >= total_ngn:
    remaining = user_balance_ngn - total_ngn
    print(f"   ✓ Sufficient balance!")
    print(f"   Remaining after purchase: {currency_service.format_currency(remaining, 'NGN')}")
else:
    shortfall = total_ngn - user_balance_ngn
    print(f"   ✗ Insufficient balance!")
    print(f"   Shortfall: {currency_service.format_currency(shortfall, 'NGN')}")

print("\n" + "=" * 60)
print("ALL TESTS COMPLETED SUCCESSFULLY!")
print("=" * 60)
