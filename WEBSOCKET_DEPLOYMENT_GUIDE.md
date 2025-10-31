# 🚀 WebSocket Deployment Guide for PythonAnywhere PAID Plan

**Your Plan:** $5/month with WebSocket Support ✅  
**Status:** Configured and Ready to Deploy

---

## ✅ What Was Fixed

### Problem:
- WebSocket URLs were hardcoded: `wss://www.venexbtc.com/wss/market/`
- This caused 404 errors when accessing via `emmidevcodes.pythonanywhere.com`
- Channel layers using InMemory instead of Redis

### Solution:
1. ✅ **Dynamic WebSocket URLs** - Now uses `window.location.host`
2. ✅ **Redis Channel Layers** - Enabled for production
3. ✅ **Proper routing** - `/ws/market/` instead of `/wss/market/`

---

## 📋 Deployment Steps on PythonAnywhere

### 1️⃣ Pull Latest Code
```bash
cd /home/yourusername/RBC
git pull origin main
```

### 2️⃣ Install Redis Support
```bash
pip install channels-redis redis
```

### 3️⃣ Verify Redis is Running
```bash
redis-cli ping
```
Should return: `PONG`

If not installed, contact PythonAnywhere support or install via:
```bash
pip install redis
```

### 4️⃣ Update ASGI Configuration

**Go to:** PythonAnywhere Web Tab → ASGI configuration file

**Replace entire content with:**

```python
import os
import sys
from pathlib import Path

# Add your project directory to sys.path
project_home = '/home/yourusername/RBC'  # ⚠️ CHANGE yourusername
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set Django settings
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

# Load .env file
from dotenv import load_dotenv
project_folder = Path(project_home)
load_dotenv(project_folder / '.env')

# Get Django ASGI application
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# Import Channels routing
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from venex_app.routing import websocket_urlpatterns

# Configure ASGI application
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

### 5️⃣ Collect Static Files
```bash
python manage.py collectstatic --noinput
```

### 6️⃣ Reload Web App
- Click **"Reload www.venexbtc.com"** button in Web tab

---

## 🧪 Testing WebSocket Connection

### 1. Test in Browser Console (F12)

Visit: `https://www.venexbtc.com/trading/buy/`

**Expected console logs:**
```
Connecting to WebSocket: wss://www.venexbtc.com/ws/market/
✅ Buy page WebSocket connected
```

**If you see this, WebSockets are working!** 🎉

### 2. Check for Errors

**Bad (404 error):**
```
WebSocket connection failed: 404 Not Found
```
→ ASGI not configured or Redis not running

**Bad (Connection refused):**
```
WebSocket connection failed: Connection refused
```
→ Redis not running or wrong host

**Good:**
```
✅ Buy page WebSocket connected
```

### 3. Test Real-time Updates

1. Open `/trading/buy/` page
2. Open browser console
3. Watch for "WebSocket connected" message
4. Prices should update automatically
5. No blue spinner stuck on "Loading market data..."

---

## 🔧 Configuration Details

### Redis Channel Layer (settings.py)

```python
# Production configuration (DEBUG=False)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],  # Local Redis
        },
    },
}
```

### WebSocket URL Pattern (routing.py)

```python
from django.urls import re_path
from .consumers import PriceConsumer, MarketConsumer

websocket_urlpatterns = [
    re_path(r'^ws/prices/$', PriceConsumer.as_asgi()),
    re_path(r'^wss/prices/$', PriceConsumer.as_asgi()),
    re_path(r'^ws/market/$', MarketConsumer.as_asgi()),
    re_path(r'^wss/market/$', MarketConsumer.as_asgi()),
]
```

### JavaScript Connection (buySocket.js)

```javascript
// Dynamic URL - works on any domain
const BUY_WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const BUY_WS_URL = `${BUY_WS_PROTOCOL}//${window.location.host}/ws/market/`;
```

---

## 🐛 Troubleshooting

### Issue: Redis not found

**Error:** `ModuleNotFoundError: No module named 'channels_redis'`

**Fix:**
```bash
pip install channels-redis redis
```

### Issue: WebSocket 404 Not Found

**Possible causes:**
1. ASGI file not updated
2. Wrong WebSocket path in routing.py
3. Static files not collected

**Fix:**
```bash
# Verify ASGI configuration
cat /var/www/yourusername_pythonanywhere_com_asgi.py

# Recollect static files
python manage.py collectstatic --noinput

# Reload webapp
```

### Issue: Connection Refused

**Cause:** Redis not running

**Check:**
```bash
redis-cli ping
```

**If no response, install Redis:**
```bash
pip install redis
```

### Issue: Still seeing "Loading market data..."

**Fix:**
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check console for errors
4. Verify JavaScript files loaded:
   - `/static/assets/js/buySocket.js`
   - `/static/assets/js/venex-dashboard.js`

---

## ✨ Expected Behavior After Deployment

### ✅ Buy Page (`/trading/buy/`)
- Spinner disappears within 1-2 seconds
- Cryptocurrency cards render with live prices
- Real-time price updates (instant, not delayed)
- WebSocket connected message in console

### ✅ Dashboard (`/dashboard/`)
- Market stats load immediately
- Cryptocurrency prices update in real-time
- No polling delays
- Smooth, instant updates

### ✅ Sell Page (`/trading/sell/`)
- Portfolio loads quickly
- Prices update as market changes
- Form calculations instant

### ✅ Portfolio (`/portfolio/`)
- Holdings display with current prices
- Charts render properly
- Values update in real-time

---

## 📊 Performance Comparison

| Metric | HTTP Polling | WebSocket (PAID) |
|--------|--------------|------------------|
| **Update delay** | 5-10 seconds | Instant (< 100ms) |
| **Server requests** | ~0.5 req/sec | 1 connection |
| **Bandwidth** | Higher | Lower |
| **User experience** | Good | Excellent |
| **Real-time feel** | Delayed | True real-time |

---

## 🎯 Verification Checklist

After deployment, verify:

- [ ] No 404 errors in error logs
- [ ] Browser console shows "WebSocket connected"
- [ ] No spinning "Loading..." on any page
- [ ] Prices update in real-time
- [ ] Can buy/sell cryptocurrency
- [ ] Dashboard shows live market data
- [ ] Network tab shows WebSocket connection (not polling)

---

## 📞 Need Help?

### Check Logs:
```bash
# Django error log
tail -f /var/log/yourusername.pythonanywhere.com.error.log

# Server log
tail -f /var/log/yourusername.pythonanywhere.com.server.log
```

### Verify Setup:
```bash
# Check Redis
redis-cli ping

# Check Python packages
pip list | grep channels

# Test WebSocket connection
python manage.py shell
>>> from venex_app.consumers import MarketConsumer
>>> print(MarketConsumer)
```

---

## ✅ Summary

**What Changed:**
1. Dynamic WebSocket URLs (no hardcoded domains)
2. Redis channel layers for production
3. Proper ASGI configuration
4. Templates using real WebSocket files

**What You Need to Do:**
1. Pull code: `git pull origin main`
2. Install Redis: `pip install channels-redis redis`
3. Update ASGI configuration
4. Collect static: `python manage.py collectstatic`
5. Reload webapp

**Result:** True real-time WebSocket updates! 🚀
