# 🚀 WebSocket Configuration for PythonAnywhere PAID Plan

**Your Plan:** $5/month (WebSocket Support ✅)  
**Domain:** www.venexbtc.com / emmidevcodes.pythonanywhere.com

---

## ✅ What You Need to Do

### 1️⃣ Enable Redis on PythonAnywhere

**On PythonAnywhere Dashboard:**
1. Go to **Consoles** → Open a **Bash console**
2. Install Redis (if not already installed):
   ```bash
   pip install channels-redis redis
   ```

3. Check if Redis is available:
   ```bash
   redis-cli ping
   ```
   Should return: `PONG`

---

### 2️⃣ Update Django Settings

Your settings need Redis for WebSocket channel layers.

**In `venexpro/settings.py`, replace InMemoryChannelLayer with Redis:**

```python
# Channel layers configuration for WebSocket support
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],  # Local Redis on PythonAnywhere
        },
    },
}
```

---

### 3️⃣ Configure ASGI in PythonAnywhere

**PythonAnywhere Web Tab → ASGI Configuration File:**

Replace content with:

```python
import os
import sys
from pathlib import Path

# Add your project directory to the sys.path
project_home = '/home/yourusername/RBC'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment variable for Django settings
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

# Load environment variables
from dotenv import load_dotenv
project_folder = Path(project_home)
load_dotenv(project_folder / '.env')

# Import Django ASGI application
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# Import Channels
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from venex_app.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

---

### 4️⃣ Update JavaScript WebSocket URLs

Your JavaScript files need to use the correct domain.

**Current Issue:** Hardcoded URLs like `wss://www.venexbtc.com/wss/market/`

**Fix:** Use dynamic URLs based on current hostname:

```javascript
// Instead of:
const wsUrl = 'wss://www.venexbtc.com/wss/market/';

// Use:
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws/market/`;
```

---

### 5️⃣ Revert to Original WebSocket Files

Since you have WebSocket support, revert the templates to use original files:

**buy.html:**
```django
<script src="{% static 'assets/js/buySocket.js' %}"></script>
```

**sell.html:**
```django
<script src="{% static 'assets/js/sellSocket.js' %}"></script>
```

**dashboard.html:**
```django
<script src="{% static 'assets/js/venex-dashboard.js' %}"></script>
```

**portfolio.html:**
```django
<script src="{% static 'assets/js/portfolioSocket.js' %}"></script>
```

---

## 🔧 Quick Implementation

I can either:

**Option A:** Keep the fallback system (it works fine, polls every 5-10 sec)

**Option B:** Properly configure WebSockets for true real-time updates

Which would you prefer? WebSockets give you:
- ✅ Instant updates (no 5-10 sec delay)
- ✅ Lower server load
- ✅ Better user experience
- ✅ Bi-directional communication

Let me know and I'll implement it properly!
