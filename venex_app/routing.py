from django.urls import re_path
from .consumers import PriceConsumer, MarketConsumer

websocket_urlpatterns = [
    re_path(r'^ws/prices/$', PriceConsumer.as_asgi()), # type: ignore
    re_path(r'^wss/prices/$', PriceConsumer.as_asgi()), # type: ignore
    re_path(r'^ws/market/$', MarketConsumer.as_asgi()), # type: ignore
    re_path(r'^wss/market/$', MarketConsumer.as_asgi()), # type: ignore
]
