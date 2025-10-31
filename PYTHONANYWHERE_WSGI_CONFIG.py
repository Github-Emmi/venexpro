# ===============================================================================
# PythonAnywhere WSGI Configuration File (TEMPORARY - NO WEBSOCKET SUPPORT)
# ===============================================================================
# File location on PythonAnywhere: /var/www/www_venexbtc_com_wsgi.py
#
# IMPORTANT: This configuration does NOT support WebSockets!
# WebSockets will return 404 errors until you switch to ASGI.
#
# To enable WebSockets, you MUST:
# 1. Contact PythonAnywhere support to enable ASGI for www.venexbtc.com
# 2. Use the ASGI configuration file instead
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
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

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
# Get WSGI Application
# ============================
# IMPORTANT: Use wsgi.py, NOT asgi.py for WSGI configuration
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()

# ===============================================================================
# WARNING: WebSockets will NOT work with this configuration!
# You will see 404 errors for /ws/market/ and /wss/market/
#
# To fix WebSocket errors:
# 1. Contact PythonAnywhere support
# 2. Request ASGI configuration for www.venexbtc.com
# 3. Use PYTHONANYWHERE_ASGI_CONFIG.py instead
# ===============================================================================
