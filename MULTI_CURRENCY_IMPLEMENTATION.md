# Multi-Currency Buy Crypto Implementation

## Overview
Implemented real-time currency conversion for cryptocurrency purchases, allowing users to buy crypto using their native currency (NGN, EUR, GBP, etc.) while crypto prices remain in USD.

## Architecture

### 1. Currency Conversion Service (`venex_app/services/currency_service.py`)

**Key Features:**
- Real-time exchange rate fetching from `exchangerate-api.com` (free API, no key required)
- 10-minute caching to reduce API calls and improve performance
- Fallback rates for 15+ currencies if API is unavailable
- Decimal precision for accurate financial calculations
- Helper methods for formatting and symbol display

**Main Methods:**
```python
CurrencyConversionService.get_exchange_rates()          # Fetch all rates (cached)
CurrencyConversionService.get_exchange_rate(from, to)   # Get specific rate
CurrencyConversionService.convert_amount(amt, from, to) # Convert any amount
CurrencyConversionService.usd_to_user_currency(usd, cur) # USD → User currency
CurrencyConversionService.user_currency_to_usd(amt, cur) # User currency → USD
CurrencyConversionService.format_currency(amt, cur)     # Format with symbol
```

**Supported Currencies:**
- USD (United States Dollar) - $
- NGN (Nigerian Naira) - ₦
- EUR (Euro) - €
- GBP (British Pound) - £
- JPY (Japanese Yen) - ¥
- CAD, AUD, NZD, ZAR, INR, CNY, BRL, MXN, KRW, SGD

**Caching Strategy:**
- Cache key: `exchange_rates_usd`
- Cache duration: 600 seconds (10 minutes)
- Auto-refresh on cache miss
- Manual clear: `currency_service.clear_cache()`

### 2. Updated Buy Crypto API (`venex_app/api_views.py`)

**Endpoint:** `POST /api/trading/buy/`

**Flow:**
1. Receive buy request with crypto amount (e.g., 0.001 BTC)
2. Calculate total cost in USD (amount × current_price_usd)
3. Get user's currency_type (e.g., 'NGN')
4. Fetch exchange rate (e.g., 1 USD = 1580 NGN)
5. Convert total cost to user's currency (e.g., 40 USD → 63,200 NGN)
6. Validate user has sufficient currency_balance (in their currency)
7. If insufficient, return detailed error with shortfall
8. If sufficient, create PENDING transaction and send verification email
9. Return response with amounts in both USD and user's currency

**Response Example (NGN user):**
```json
{
  "success": true,
  "message": "Purchase initiated successfully...",
  "transaction": {...},
  "verification_code": "123456",
  "total_cost": 63200.00,        // In NGN
  "total_cost_usd": 40.00,       // Original USD amount
  "network_fee": 63.20,          // In NGN
  "remaining_balance": 436800.00, // User's remaining NGN
  "currency": "NGN",
  "currency_symbol": "₦",
  "exchange_rate": 1580.00
}
```

**Error Response (Insufficient Balance):**
```json
{
  "error": "Insufficient balance",
  "message": "You need ₦63,200.00 but only have ₦50,000.00. Shortfall: ₦13,200.00",
  "required": 63200.00,
  "available": 50000.00,
  "shortfall": 13200.00,
  "currency": "NGN",
  "currency_symbol": "₦",
  "total_usd": 40.00,
  "exchange_rate": 1580.00
}
```

### 3. New API Endpoints

#### Get Exchange Rate
**Endpoint:** `GET /api/exchange-rate/`

**Response:**
```json
{
  "success": true,
  "exchange_rate": 1580.00,
  "user_currency": "NGN",
  "currency_symbol": "₦",
  "all_rates": {...}  // All available rates
}
```

**Usage:** Frontend fetches this on page load to get user's exchange rate

#### Convert Currency
**Endpoint:** `POST /api/convert-currency/`

**Payload:**
```json
{
  "amount": 100,
  "from_currency": "USD",
  "to_currency": "NGN"
}
```

**Response:**
```json
{
  "success": true,
  "original_amount": 100.00,
  "converted_amount": 158000.00,
  "from_currency": "USD",
  "to_currency": "NGN",
  "exchange_rate": 1580.00,
  "formatted": "₦158,000.00"
}
```

### 4. Frontend Updates (`venex_app/static/assets/js/buy.js`)

**New State Variables:**
```javascript
let exchangeRate = 1.0;        // USD to user's currency
let userCurrency = 'USD';      // User's currency code
let currencySymbol = '$';      // Currency symbol for display
```

**Exchange Rate Loading:**
```javascript
async function fetchExchangeRate() {
    const response = await fetch('/api/exchange-rate/');
    const data = await response.json();
    if (data.success) {
        exchangeRate = data.exchange_rate;
        userCurrency = data.user_currency;
        currencySymbol = data.currency_symbol;
    }
}
// Called on page load
fetchExchangeRate();
```

**Updated Calculations:**
- All crypto prices remain in USD
- Subtotal/Fee/Total calculated in USD first
- Then converted to user's currency for display
- Balance validation uses converted amount

**Display Example (NGN user buying 0.001 BTC at $40,000):**
```
Subtotal: ₦63,200.00 (tooltip: USD $40.00)
Network Fee (0.1%): ₦63.20 (tooltip: USD $0.04)
Total Cost: ₦63,263.20 (tooltip: USD $40.04)
```

### 5. Updated Balance Update Function

**Function:** `update_user_balances_after_buy()`

**Signature:**
```python
def update_user_balances_after_buy(user, data, network_fee=None, total_cost=None):
```

**Changes:**
- Now accepts `total_cost` parameter (already converted to user's currency)
- Deducts `total_cost` from `user.currency_balance` (in user's currency)
- Adds crypto amount to appropriate crypto balance (e.g., btc_balance)
- Logs transaction with correct currency

**Example (NGN user):**
```
Before:
currency_balance: 500,000 NGN
btc_balance: 0.0 BTC

After buying 0.001 BTC (costs 63,263.20 NGN):
currency_balance: 436,736.80 NGN
btc_balance: 0.001 BTC
```

## User Experience Flow

### Example: Nigerian User Buying Bitcoin

**Initial State:**
- User currency: NGN (Nigerian Naira)
- User balance: ₦500,000.00
- Exchange rate: 1 USD = ₦1,580

**Step 1: Page Load**
- Frontend fetches exchange rate: `GET /api/exchange-rate/`
- Receives: `exchange_rate: 1580, currency: NGN, symbol: ₦`
- Display shows: "Available Balance: ₦500,000.00"

**Step 2: User Selects BTC**
- BTC price: $40,000 USD
- User enters amount: 0.001 BTC

**Step 3: Calculation (Real-time)**
```
USD Calculation:
Subtotal = 0.001 × 40,000 = $40.00
Network Fee = $40.00 × 0.001 = $0.04
Total = $40.04

NGN Conversion:
Subtotal = $40.00 × 1580 = ₦63,200.00
Network Fee = $0.04 × 1580 = ₦63.20
Total = ₦63,263.20
```

Display shows:
```
Subtotal: ₦63,200.00
Network Fee (0.1%): ₦63.20
Total Cost: ₦63,263.20
```

**Step 4: Click "Buy Cryptocurrency"**
- Frontend validates: ₦63,263.20 ≤ ₦500,000.00 ✅
- Shows toast: "Balance verified! Proceeding with purchase of 0.001 BTC"
- Opens confirmation modal showing all amounts in NGN

**Step 5: Confirm Purchase**
- POST to `/api/trading/buy/`
- Backend:
  1. Validates balance in NGN
  2. Creates PENDING transaction
  3. Deducts ₦63,263.20 from currency_balance
  4. Adds 0.001 to btc_balance
  5. Generates verification code
  6. Sends email

**Step 6: Email Verification**
- User receives 6-digit code
- Enters code
- Transaction marked COMPLETED
- New balances:
  - currency_balance: ₦436,736.80
  - btc_balance: 0.001 BTC

## Database Schema

### Transaction Model
```python
class Transaction(models.Model):
    # ... existing fields ...
    total_amount = DecimalField()  # Stored in user's currency
    currency = CharField()         # User's currency_type (NGN, USD, etc.)
    network_fee = DecimalField()   # Stored in user's currency
    price_per_unit = DecimalField() # Always in USD (crypto price)
```

### CustomUser Model
```python
class CustomUser(AbstractBaseUser):
    currency_type = CharField()      # User's preferred currency
    currency_balance = DecimalField() # Balance in their currency
    btc_balance = DecimalField()
    ethereum_balance = DecimalField()
    # ... other crypto balances ...
```

## Testing Scenarios

### Test 1: USD User (No Conversion)
```
User: currency_type = USD, currency_balance = $10,000
Buy: 0.001 BTC at $40,000
Expected: Deduct $40.04, add 0.001 BTC
Exchange Rate: 1.00 (no conversion)
```

### Test 2: NGN User (With Conversion)
```
User: currency_type = NGN, currency_balance = ₦500,000
Buy: 0.001 BTC at $40,000
Exchange Rate: 1 USD = 1580 NGN
Expected: Deduct ₦63,263.20, add 0.001 BTC
```

### Test 3: Insufficient Balance
```
User: currency_type = NGN, currency_balance = ₦50,000
Buy: 0.001 BTC at $40,000 (needs ₦63,263.20)
Expected: Error with shortfall ₦13,263.20
```

### Test 4: Multiple Currencies
```
EUR User: 1 USD = 0.92 EUR
GBP User: 1 USD = 0.79 GBP
JPY User: 1 USD = 149.50 JPY
All should see amounts in their currency
```

## Error Handling

### Exchange Rate API Failures
1. **API Down:** Uses fallback rates (hardcoded, updated periodically)
2. **Network Error:** Returns fallback rates with warning logged
3. **Invalid Response:** Falls back to default rates

### Insufficient Balance
- Detailed error message with exact shortfall
- Shows amounts in user's currency
- Includes both USD and converted amounts for transparency

### Unsupported Currency
- If user has currency not in our mapping
- Defaults to USD conversion (1:1 rate)
- Logs warning for admin to add currency

## Performance Optimizations

### 1. Exchange Rate Caching
- 10-minute cache reduces API calls by 99%
- Cached at: `cache['exchange_rates_usd']`
- Shared across all users

### 2. Single API Call
- Frontend fetches rate once on page load
- Reuses for all calculations
- No per-transaction API calls

### 3. Decimal Precision
- All calculations use Python's `Decimal` type
- Prevents floating-point errors
- Ensures financial accuracy

## Security Considerations

### 1. Rate Locking
- Exchange rate captured at transaction initiation
- Stored with transaction record
- Used for verification to prevent manipulation

### 2. Balance Validation
- Double-check: Frontend + Backend
- Backend is source of truth
- Atomic database transactions

### 3. Audit Trail
- Every transaction records:
  - Original USD amount
  - Exchange rate used
  - Converted amount
  - User's currency
  - Timestamp

## Admin Features

### View Transactions in All Currencies
Admin panel shows transactions with both:
- Amount in user's currency (NGN, EUR, etc.)
- Equivalent USD amount for comparison

### Manual Balance Adjustment
Admin can credit/debit in user's currency:
```python
# Credit 10,000 NGN to user
user.currency_balance += Decimal('10000.00')
user.save()
```

## Future Enhancements

### 1. Crypto-to-Crypto Conversion
- Allow buying BTC with ETH
- Cross-rate conversion through USD

### 2. Historical Rate Analysis
- Track exchange rate changes
- Show user best time to buy

### 3. Rate Alerts
- Notify when exchange rate favorable
- E.g., "NGN/USD rate improved by 5%"

### 4. Multiple Rate Sources
- Average rates from multiple APIs
- Reduce dependency on single provider
- More accurate pricing

## Troubleshooting

### Issue: Amounts showing in USD instead of user currency
**Solution:** Check if `fetchExchangeRate()` is being called on page load

### Issue: "Insufficient balance" when user has enough
**Solution:** Ensure frontend and backend use same exchange rate (check cache)

### Issue: Exchange rate not updating
**Solution:** Clear cache: `currency_service.clear_cache()` or wait 10 minutes

### Issue: Wrong currency symbol displayed
**Solution:** Check `currency_service.get_currency_symbol()` mapping

## API Response Examples

### Successful Purchase (EUR User)
```json
{
  "success": true,
  "message": "Purchase initiated successfully. Please check your email for the verification code.",
  "transaction": {
    "id": "uuid-here",
    "cryptocurrency": "BTC",
    "quantity": "0.00100000",
    "total_amount": "36.84",
    "currency": "EUR",
    "network_fee": "0.04"
  },
  "verification_code": "123456",
  "total_cost": 36.84,
  "total_cost_usd": 40.04,
  "network_fee": 0.04,
  "remaining_balance": 9963.16,
  "currency": "EUR",
  "currency_symbol": "€",
  "exchange_rate": 0.92
}
```

## Summary

This multi-currency implementation provides:

✅ **Real-time Currency Conversion** - Live exchange rates
✅ **15+ Currency Support** - NGN, EUR, GBP, JPY, and more
✅ **Accurate Calculations** - Decimal precision for finance
✅ **User-Friendly Display** - Amounts in native currency
✅ **Fallback Rates** - Service continues if API fails
✅ **Performance Optimized** - 10-minute caching
✅ **Complete Audit Trail** - All conversions logged
✅ **Transparent Pricing** - Shows both USD and local amounts

Users can now purchase cryptocurrencies using their local currency while the platform maintains USD-based crypto pricing for consistency and global market alignment.
