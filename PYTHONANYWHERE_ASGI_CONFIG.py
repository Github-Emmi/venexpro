# ===============================================================================
# PythonAnywhere ASGI Configuration File (REQUIRED FOR WEBSOCKETS)
# ===============================================================================
# File location on PythonAnywhere: /var/www/www_venexbtc_com_asgi.py
#
# This configuration ENABLES WebSocket support via Django Channels
#
# SETUP INSTRUCTIONS:
# 1. Upload this file to /var/www/www_venexbtc_com_asgi.py on PythonAnywhere
# 2. Contact PythonAnywhere support to switch from WSGI to ASGI mode
# 3. Install required packages: pip install channels-redis redis
# 4. Verify Redis is running: redis-cli ping
# 5. Reload your webapp
# ===============================================================================

import os
import sys
from pathlib import Path

# ============================
# Add Project to Python Path
# ============================
project_home = '/home/emmidevcodes/venexpro'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# ============================
# Activate Virtual Environment
# ============================
# Activate the virtualenv
activate_this = '/home/emmidevcodes/.virtualenvs/venv/bin/activate_this.py'
try:
    with open(activate_this) as f:
        exec(f.read(), {'__file__': activate_this})
except FileNotFoundError:
    # If activate_this.py doesn't exist, manually add to path
    venv_path = '/home/emmidevcodes/.virtualenvs/venv/lib/python3.13/site-packages'
    if venv_path not in sys.path:
        sys.path.insert(0, venv_path)

# ============================
# Set Django Settings Module
# ============================
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'venexpro.settings')

# ============================
# Load Environment Variables
# ============================
try:
    from dotenv import load_dotenv
    project_folder = Path(project_home)
    env_path = project_folder / '.env'
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # python-dotenv not installed

# ============================
# Django Setup (CRITICAL)
# ============================
# IMPORTANT: Get Django ASGI app BEFORE importing Channels
# This prevents AppRegistryNotReady errors
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# ============================
# Import Channels Components
# ============================
# NOW safe to import Channels (after Django is initialized)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from venex_app.routing import websocket_urlpatterns

# ============================
# Create ASGI Application
# ============================
application = ProtocolTypeRouter({
    # HTTP requests are handled by Django
    "http": django_asgi_app,
    
    # WebSocket requests are handled by Channels
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})

# ===============================================================================
# ASGI Application Ready!
#
# This configuration enables:
# - HTTP requests: Handled by Django (normal web pages)
# - WebSocket connections: Handled by Channels (/ws/market/, /wss/market/, etc.)
#
# Supported WebSocket URLs:
# - ws://www.venexbtc.com/ws/market/
# - wss://www.venexbtc.com/wss/market/ (secure)
# - ws://www.venexbtc.com/ws/prices/
# - wss://www.venexbtc.com/wss/prices/ (secure)
#
# Channel Layer Backend:
# - Development (DEBUG=True): InMemoryChannelLayer
# - Production (DEBUG=False): Redis (127.0.0.1:6379)
# ===============================================================================
