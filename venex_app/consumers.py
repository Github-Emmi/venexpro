import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .services.crypto_api_service import crypto_service

class PriceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'price_updates'
        self.symbol = 'BTC'  # Default symbol

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Send initial data
        await self.send_current_price()
        
        # Start periodic updates
        self.update_task = asyncio.create_task(self.periodic_updates())

    async def disconnect(self, close_code): # type: ignore
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        # Cancel periodic updates
        if hasattr(self, 'update_task'):
            self.update_task.cancel()

    async def receive(self, text_data): # type: ignore
        """Receive message from WebSocket"""
        data = json.loads(text_data)
        
        if data['type'] == 'subscribe':
            self.symbol = data['symbol']
            await self.send_current_price()
            await self.send_historical_data()

    async def send_current_price(self):
        """Send current price for subscribed symbol"""
        price_data = await self.get_current_price(self.symbol)
        await self.send(text_data=json.stringify({ # type: ignore
            'type': 'price_update',
            'symbol': self.symbol,
            'data': price_data
        }))

    async def send_historical_data(self):
        """Send historical data for chart"""
        historical_data = await self.get_historical_data(self.symbol)
        await self.send(text_data=json.stringify({ # type: ignore
            'type': 'historical_data',
            'symbol': self.symbol,
            'data': historical_data
        }))

    async def periodic_updates(self):
        """Send periodic price updates"""
        while True:
            await asyncio.sleep(10)  # Update every 10 seconds
            await self.send_current_price()

    @database_sync_to_async
    def get_current_price(self, symbol):
        """Get current price from database"""
        from .models import Cryptocurrency
        try:
            crypto = Cryptocurrency.objects.get(symbol=symbol)
            return {
                'price': float(crypto.current_price),
                'change_24h': float(crypto.price_change_24h),
                'change_percentage_24h': float(crypto.price_change_percentage_24h),
                'volume': float(crypto.volume_24h),
                'timestamp': crypto.last_updated.isoformat()
            }
        except Cryptocurrency.DoesNotExist:
            return {'price': 0, 'change_24h': 0, 'change_percentage_24h': 0, 'volume': 0}

    @database_sync_to_async
    def get_historical_data(self, symbol):
        """Get historical data for chart"""
        return crypto_service.get_historical_data(symbol, days=30)

    async def price_update(self, event):
        """Receive price update from room group"""
        await self.send(text_data=json.stringify(event)) # type: ignore