# Testing Transaction History Feature

## Problem: "Loading transactions..." with no data

This means one of the following:

### 1. **No Transactions in Database** (Most Likely)

**Solution:** Create test transactions

```bash
# Run the test data generator
python create_test_transactions.py
```

This will create:
- 50 random test transactions
- Mix of BUY, SELL, DEPOSIT, WITHDRAWAL
- Mix of COMPLETED, PENDING, FAILED statuses
- Distributed over the last 90 days

### 2. **Not Logged In**

**Solution:** Make sure you're logged in
- Go to `/login/`
- Log in with your credentials
- Then visit `/history/`

### 3. **JavaScript Error**

**Solution:** Check browser console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors in red
4. You should see:
   ```
   Loading transactions from: /api/transactions/history/?page=1&per_page=25...
   Transaction API Response: {success: true, transactions: [...], ...}
   ```

### 4. **API Endpoint Not Working**

**Solution:** Test the API directly

```bash
# Test if API is accessible
curl -X GET "http://localhost:8000/api/transactions/history/?page=1&per_page=25" \
  -H "Cookie: sessionid=YOUR_SESSION_ID"
```

Or open in browser (when logged in):
```
http://localhost:8000/api/transactions/history/?page=1&per_page=25
```

Expected response:
```json
{
  "success": true,
  "transactions": [...],
  "pagination": {...},
  "statistics": {...}
}
```

---

## Quick Start

### Step 1: Create Test User (if needed)
```bash
python manage.py createsuperuser
```

### Step 2: Create Test Transactions
```bash
python create_test_transactions.py
```

### Step 3: Run Server
```bash
python manage.py runserver
```

### Step 4: Visit Page
```
http://localhost:8000/history/
```

---

## Debugging Checklist

✅ **Database has transactions?**
```python
python manage.py shell
>>> from venex_app.models import Transaction
>>> Transaction.objects.count()
50  # Should see a number > 0
```

✅ **User is logged in?**
- Check if you see user menu in top right
- If not, go to `/login/`

✅ **API endpoint working?**
- Open browser console (F12)
- Look for AJAX request to `/api/transactions/history/`
- Check response status (should be 200)

✅ **JavaScript loaded?**
- Check Network tab for `history.js`
- Should load without 404 error

✅ **CSS loaded?**
- Check Network tab for `history.css`
- Should load without 404 error

---

## Common Errors & Solutions

### Error: 401 Unauthorized
**Problem:** Not logged in  
**Solution:** Go to `/login/` and log in

### Error: 404 Not Found (API)
**Problem:** URL pattern not configured  
**Solution:** Check `venex_app/urls.py` has:
```python
path('api/transactions/history/', api_views.api_transaction_history, ...)
```

### Error: 403 Forbidden
**Problem:** CSRF token issue  
**Solution:** Make sure `getCookie('csrftoken')` is working in JavaScript

### Error: 500 Server Error
**Problem:** Backend error  
**Solution:** Check Django server logs in terminal

### "Loading transactions..." forever
**Problem:** AJAX request not completing  
**Solution:** 
1. Open browser console
2. Check Network tab
3. Look for failed requests
4. Check error details

---

## Verify Everything Works

### 1. Check Database
```bash
python check_transactions.py
```

Should show:
```
Total Transactions in DB: 50
Total Users in DB: 1
Total Orders in DB: 0
```

### 2. Check API Response
Visit (when logged in):
```
http://localhost:8000/api/transactions/history/
```

Should see JSON response with transactions array

### 3. Check Page
Visit:
```
http://localhost:8000/history/
```

Should see:
- ✅ Statistics cards populated (not all zeros)
- ✅ Transaction table with data
- ✅ Pagination controls
- ✅ Filters working

---

## Expected Behavior

### Initial Load
1. Page shows "Loading transactions..." with spinner
2. AJAX request to `/api/transactions/history/`
3. Statistics update (Total: 50, Completed: ~16, etc.)
4. Table populates with transaction rows
5. Pagination shows correct page numbers

### Filters
- Type dropdown: BUY, SELL, DEPOSIT, WITHDRAWAL
- Status dropdown: COMPLETED, PENDING, FAILED
- Crypto dropdown: BTC, ETH, USDT, LTC, TRX
- Search box: Search by ID or crypto name
- Date range: Filter by date

### Features
- Click page numbers to navigate
- Click "View Details" to see receipt
- Click "Export" to download CSV/PDF
- Click "Refresh" to reload data

---

## Production Deployment

Before deploying to PythonAnywhere:

1. **Collect Static Files**
```bash
python manage.py collectstatic --noinput
```

2. **Check URLs**
- Update domain in JavaScript if needed
- Ensure ALLOWED_HOSTS includes your domain

3. **Database**
- Run migrations: `python manage.py migrate`
- Create real transactions through buy/sell features

4. **Test Locally First**
- Ensure everything works on localhost:8000
- Then deploy to production

---

## Contact

If issues persist after following this guide:
1. Check Django server logs
2. Check browser console errors
3. Verify API response in Network tab
4. Ensure user is authenticated

**The feature is fully functional - the only requirement is having transactions in the database!**
