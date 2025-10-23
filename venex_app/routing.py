from django.urls import re_path
from .consumers import PriceConsumer

websocket_urlpatterns = [
    re_path(r'^ws/prices/$', PriceConsumer.as_asgi()), # type: ignore
    re_path(r'^ws/$', PriceConsumer.as_asgi()), # Backward compatibility for /ws/ # type: ignore
    # Add more websocket routes here as needed
]
