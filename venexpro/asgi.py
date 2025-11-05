import os
import sys

# Add your project directory to the sys.path
path = '/home/emmidevcodes/venexpro'
if path not in sys.path:
    sys.path.insert(0, path)

# Set environment variable to tell Django where settings are
os.environ['DJANGO_SETTINGS_MODULE'] = 'venexpro.settings'

# Import Django ASGI application
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

# Import Channels
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from venex_app.routing import websocket_urlpatterns

# Define the ASGI application
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})