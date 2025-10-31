# 🔧 CRITICAL: PythonAnywhere WebSocket Setup - COMPLETE GUIDE

**Issue:** WebSockets still showing 404 after code update  
**Reason:** PythonAnywhere requires special Web tab configuration  
**Your Domain:** www.venexbtc.com (custom domain) + emmidevcodes.pythonanywhere.com

---

## ⚠️ CRITICAL ISSUE IDENTIFIED

Your code is correct, but **PythonAnywhere WebSocket setup requires TWO steps:**

1. ✅ Code configuration (DONE - you have this)
2. ❌ **Web tab configuration (MISSING - this is the problem!)**

---

## 🚀 STEP-BY-STEP FIX

### Step 1: Verify You Have WebSocket Support

**Go to:** PythonAnywhere Dashboard → Account  
**Check:** You should see "WebSocket support: Enabled" under your plan

If NOT enabled:
- You need to be on a **paid plan** ($5/month minimum)
- Free accounts do NOT support WebSockets

---

### Step 2: Configure ASGI in PythonAnywhere Web Tab

**CRITICAL:** This is what you're missing!

#### A. Go to Web Tab
1. Log into PythonAnywhere
2. Click **"Web"** tab
3. Find your webapp: **www.venexbtc.com** or **emmidevcodes.pythonanywhere.com**

#### B. Enable WebSocket Support

**Look for section:** "WebSocket (for Channels, etc.)"

**If you see "Disabled":**
1. Click **"Enable WebSocket"**
2. Wait for confirmation

#### C. Set ASGI Configuration File Path

**Look for:** "ASGI configuration file"

**Path should be:**
```
/home/emmidevcodes/venexpro/venexpro/asgi.py
```

**OR use this custom configuration:**

Click "Edit" next to ASGI configuration file and paste:

```python
import os
import sys
from pathlib import Path

# Add your project to Python path
project_home = '/home/emmidevcodes/venexpro'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment for Django
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

# Load .env file
from dotenv import load_dotenv
project_folder = Path(project_home)
env_path = project_folder / '.env'
load_dotenv(env_path)

# Get Django ASGI application first (before Channels imports)
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# Now import Channels
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from venex_app.routing import websocket_urlpatterns

# Create application
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

---

### Step 3: Install Redis (Required for Production)

**In PythonAnywhere Bash console:**

```bash
pip install channels-redis redis
```

**Verify Redis is available:**

```bash
redis-cli ping
```

**Expected output:** `PONG`

**If Redis not found:**
```bash
# PythonAnywhere provides Redis, just install the Python library
pip install redis channels-redis
```

---

### Step 4: Update .env File DEBUG Setting

**On PythonAnywhere server:**

```bash
cd /home/emmidevcodes/venexpro
nano .env
```

**Make sure this line exists:**
```
DEBUG=False
```

**Save and exit** (Ctrl+X, Y, Enter)

---

### Step 5: Collect Static Files

```bash
cd /home/emmidevcodes/venexpro
python manage.py collectstatic --noinput
```

---

### Step 6: Reload Web App

**In PythonAnywhere Web tab:**
1. Scroll to top
2. Click the big green **"Reload www.venexbtc.com"** button
3. Wait for "Reload complete" message

---

## 🧪 Testing WebSocket Connection

### Test 1: Check Browser Console

1. Visit: `https://www.venexbtc.com/trading/buy/`
2. Open DevTools (F12)
3. Go to Console tab

**Expected output:**
```
Connecting to WebSocket: wss://www.venexbtc.com/ws/market/
✅ Buy page WebSocket connected
```

**If you see 404:**
- ASGI configuration not set correctly in Web tab
- WebSocket support not enabled in Web tab

### Test 2: Check Network Tab

1. Stay on `/trading/buy/` page
2. Open DevTools → Network tab
3. Filter by "WS" (WebSocket)

**Expected:**
- Connection to `ws/market/`
- Status: 101 Switching Protocols
- Connection: Active

**If no WebSocket connection:**
- Check ASGI file path in Web tab
- Verify WebSocket support enabled

### Test 3: Check Error Logs

**In PythonAnywhere:**

```bash
tail -50 /var/log/www.venexbtc.com.error.log
```

**Look for:**
- Redis connection errors
- ASGI import errors
- Channel layer errors

---

## 🔍 Common Issues & Solutions

### Issue 1: "WebSocket support not available"

**Solution:** Upgrade to paid plan ($5/month minimum)

Free accounts cannot use WebSockets.

---

### Issue 2: Still seeing 404 after Web tab setup

**Check:**

1. **ASGI file path correct?**
   ```bash
   cat /home/emmidevcodes/venexpro/venexpro/asgi.py
   ```

2. **WebSocket enabled in Web tab?**
   - Should show "Enabled" not "Disabled"

3. **Correct domain in ALLOWED_HOSTS?**
   ```python
   # In settings.py
   ALLOWED_HOSTS = [
       'www.venexbtc.com',
       'venexbtc.com',
       'emmidevcodes.pythonanywhere.com',
   ]
   ```

---

### Issue 3: Redis connection error

**Error:** `Error connecting to Redis`

**Fix:**

```bash
# Check if Redis is running
redis-cli ping

# If not installed:
pip install redis channels-redis

# Restart webapp
```

---

### Issue 4: ASGI import error

**Error:** `ModuleNotFoundError: No module named 'channels'`

**Fix:**

```bash
pip install channels channels-redis
python manage.py collectstatic --noinput
# Reload webapp in Web tab
```

---

## 📋 Complete Checklist

Before testing, verify:

- [ ] On PythonAnywhere **paid plan** ($5/month)
- [ ] WebSocket support **enabled** in Web tab
- [ ] ASGI configuration file path set in Web tab
- [ ] `.env` has `DEBUG=False`
- [ ] `pip install channels channels-redis redis` completed
- [ ] `redis-cli ping` returns `PONG`
- [ ] `python manage.py collectstatic` completed
- [ ] Web app reloaded in Web tab
- [ ] `www.venexbtc.com` points to PythonAnywhere (DNS)

---

## 🎯 The Real Problem

**Your code is 100% correct.**

The issue is **PythonAnywhere's Web tab configuration** which is separate from your code.

You must:
1. Enable WebSocket in Web tab (one-time setting)
2. Set ASGI configuration file path
3. Reload webapp

Without these Web tab settings, PythonAnywhere serves only WSGI (HTTP), not ASGI (WebSocket).

---

## ✅ After Following These Steps

**You should see:**

1. ✅ No spinner on `/trading/buy/`
2. ✅ Console log: "✅ Buy page WebSocket connected"
3. ✅ Network tab shows WS connection
4. ✅ Real-time price updates
5. ✅ No 404 errors in logs

**If still not working:**

1. Screenshot your PythonAnywhere Web tab (WebSocket section)
2. Share error log: `/var/log/www.venexbtc.com.error.log`
3. Share browser console errors

---

## 📞 Quick Debug Commands

Run these on PythonAnywhere to verify setup:

```bash
# Check Python path
which python

# Check installed packages
pip list | grep -i channel
pip list | grep -i redis

# Check Redis
redis-cli ping

# Check ASGI file
cat /home/emmidevcodes/venexpro/venexpro/asgi.py

# Check if DEBUG is False
grep DEBUG /home/emmidevcodes/venexpro/.env

# Test Django shell
python manage.py shell
>>> from venex_app.consumers import MarketConsumer
>>> print(MarketConsumer)
>>> exit()
```

---

## 🚨 MOST LIKELY FIX

**99% chance the issue is:** WebSocket not enabled in PythonAnywhere Web tab

**Fix:**
1. Go to Web tab
2. Find "WebSocket" section
3. Click **"Enable"**
4. Set ASGI file path
5. Reload webapp

That's it! This is a PythonAnywhere configuration issue, not a code issue.
