import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .services.crypto_api_service import crypto_service
import logging

logger = logging.getLogger(__name__)

class PriceConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'price_updates'
        self.symbol = 'BTC'  # Default symbol
        self.user = self.scope["user"] # type: ignore

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # Send initial data
        await self.send_current_price()
        await self.send_historical_data()
        
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

    async def receive(self, text_data=None, bytes_data=None):
        """Receive message from WebSocket with proper method signature"""
        try:
            if text_data:
                data = json.loads(text_data)
                message_type = data.get('type')
                
                if message_type == 'subscribe':
                    symbol = data.get('symbol', 'BTC').upper()
                    await self.handle_subscription(symbol)
                elif message_type == 'ping':
                    await self.send(text_data=json.dumps({'type': 'pong'}))
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error', 
                'message': 'Internal server error'
            }))

    async def handle_subscription(self, symbol):
        """Handle symbol subscription changes"""
        valid_symbols = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX']
        
        if symbol in valid_symbols:
            self.symbol = symbol
            await self.send_current_price()
            await self.send_historical_data()
            
            await self.send(text_data=json.dumps({
                'type': 'subscription_update',
                'symbol': symbol,
                'message': f'Subscribed to {symbol} updates'
            }))
        else:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Invalid symbol: {symbol}. Valid symbols: {", ".join(valid_symbols)}'
            }))

    async def send_current_price(self):
        """Send current price for subscribed symbol"""
        try:
            price_data = await self.get_current_price(self.symbol)
            await self.send(text_data=json.dumps({
                'type': 'price_update',
                'symbol': self.symbol,
                'data': price_data,
                'timestamp': await self.get_current_timestamp()
            }))
        except Exception as e:
            logger.error(f"Error sending current price: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to get price for {self.symbol}'
            }))

    async def send_historical_data(self):
        """Send historical data for chart"""
        try:
            historical_data = await self.get_historical_data(self.symbol)
            await self.send(text_data=json.dumps({
                'type': 'historical_data',
                'symbol': self.symbol,
                'data': historical_data
            }))
        except Exception as e:
            logger.error(f"Error sending historical data: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to get historical data for {self.symbol}'
            }))

    async def periodic_updates(self):
        """Send periodic price updates"""
        while True:
            try:
                await asyncio.sleep(10)  # Update every 10 seconds
                await self.send_current_price()
                
                # Also update the room group with latest prices
                price_data = await self.get_current_price(self.symbol)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'price_update',
                        'symbol': self.symbol,
                        'data': price_data,
                        'timestamp': await self.get_current_timestamp()
                    }
                )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic updates: {e}")
                await asyncio.sleep(5)  # Wait before retrying

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
                'market_cap': float(crypto.market_cap) if crypto.market_cap else 0,
                'last_updated': crypto.last_updated.isoformat() if crypto.last_updated else None
            }
        except Cryptocurrency.DoesNotExist:
            logger.warning(f"Cryptocurrency {symbol} not found in database")
            return {
                'price': 0, 
                'change_24h': 0, 
                'change_percentage_24h': 0, 
                'volume': 0,
                'market_cap': 0,
                'last_updated': None
            }

    @database_sync_to_async
    def get_historical_data(self, symbol):
        """Get historical data for chart"""
        try:
            return crypto_service.get_historical_data(symbol, days=30)
        except Exception as e:
            logger.error(f"Error getting historical data: {e}")
            return []

    @database_sync_to_async
    def get_current_timestamp(self):
        """Get current timestamp"""
        from django.utils import timezone
        return timezone.now().isoformat()

    async def price_update(self, event):
        """Receive price update from room group"""
        # This handles messages sent to the group
        try:
            # Only send if it's for our subscribed symbol or we want all updates
            if event.get('symbol') == self.symbol:
                await self.send(text_data=json.dumps(event))
        except Exception as e:
            logger.error(f"Error in price_update handler: {e}")