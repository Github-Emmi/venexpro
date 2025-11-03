# venex_app/consumers.py
import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .services.crypto_api_service import crypto_service
from .models import Cryptocurrency
from django.utils import timezone
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



logger = logging.getLogger(__name__)

class MarketConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'market_updates'
        
        # Join market group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"Market WebSocket connected: {self.channel_name}")
        
        # Send initial market data
        await self.send_initial_market_data()

    async def disconnect(self, close_code): # type: ignore
        # Leave market group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"Market WebSocket disconnected: {self.channel_name}")

    async def receive(self, text_data): # type: ignore
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'subscribe_chart':
                symbol = data.get('symbol', 'BTC')
                timeframe = data.get('timeframe', '1d')
                await self.send_chart_data(symbol, timeframe)
                
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def market_update(self, event):
        """Receive market update from group"""
        await self.send(text_data=json.dumps(event['data']))

    async def price_update(self, event):
        """Receive price update from group"""
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def get_market_data(self):
        """Get current market data from database"""
        from .models import Cryptocurrency
        from .serializers import CryptocurrencySerializer
        
        cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('rank')
        serializer = CryptocurrencySerializer(cryptocurrencies, many=True)
        
        # Calculate market stats
        total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies)
        total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies)
        
        # Calculate BTC dominance
        btc = cryptocurrencies.filter(symbol='BTC').first()
        btc_dominance = (float(btc.market_cap) / total_market_cap * 100) if btc and total_market_cap > 0 else 0
        
        return {
            'type': 'market_data',
            'data': {
                'cryptocurrencies': serializer.data,
                'market_stats': {
                    'total_market_cap': total_market_cap,
                    'total_volume_24h': total_volume,
                    'btc_dominance': round(btc_dominance, 2),
                    'active_cryptocurrencies': cryptocurrencies.count(),
                    'timestamp': timezone.now().isoformat()
                }
            }
        }

    @database_sync_to_async
    def get_chart_data(self, symbol, timeframe):
        """Get chart data for specific symbol and timeframe"""
        from .services.crypto_api_service import crypto_service
        return crypto_service.get_price_history(symbol, timeframe)

    async def send_initial_market_data(self):
        """Send initial market data on connection"""
        try:
            market_data = await self.get_market_data()
            await self.send(text_data=json.dumps(market_data))
        except Exception as e:
            logger.error(f"Error sending initial market data: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to load market data'
            }))

    async def send_chart_data(self, symbol, timeframe):
        """Send chart data for specific cryptocurrency"""
        try:
            chart_data = await self.get_chart_data(symbol, timeframe)
            await self.send(text_data=json.dumps({
                'type': 'chart_data',
                'symbol': symbol,
                'timeframe': timeframe,
                'data': chart_data
            }))
        except Exception as e:
            logger.error(f"Error sending chart data for {symbol}: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to load chart data for {symbol}'
            }))

class PortfolioConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"] # type: ignore
        if self.user.is_anonymous: # type: ignore
            await self.close()
            return
            
        self.portfolio_group_name = f'portfolio_{self.user.id}' # type: ignore
        
        # Join portfolio group
        await self.channel_layer.group_add(
            self.portfolio_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"Portfolio WebSocket connected for user: {self.user.username}") # type: ignore
        
        # Send initial portfolio data
        await self.send_initial_portfolio_data()

    async def disconnect(self, close_code): # type: ignore
        # Leave portfolio group
        await self.channel_layer.group_discard(
            self.portfolio_group_name,
            self.channel_name
        )
        logger.info(f"Portfolio WebSocket disconnected for user: {self.user.username}") # type: ignore

    async def receive(self, text_data): # type: ignore
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'get_analytics':
                timeframe = data.get('timeframe', '1M')
                await self.send_analytics_data(timeframe)
                
        except Exception as e:
            logger.error(f"Error processing portfolio WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))

    async def portfolio_update(self, event):
        """Receive portfolio update from group"""
        await self.send(text_data=json.dumps(event['data']))

    async def price_update(self, event):
        """Handle price updates that affect portfolio"""
        # Recalculate portfolio when prices change
        await self.send_updated_portfolio_data()

    @database_sync_to_async
    def get_portfolio_data(self):
        """Get current portfolio data"""
        from .services.portfolio_service import portfolio_service
        
        portfolio = portfolio_service.get_user_portfolio(self.user)
        portfolio_service.calculate_portfolio_value(portfolio)
        
        holdings = portfolio.holdings.all().select_related('cryptocurrency')
        holdings_data = []
        
        for holding in holdings:
            crypto = holding.cryptocurrency
            holdings_data.append({
                'symbol': crypto.symbol,
                'name': crypto.name,
                'amount': float(holding.amount),
                'current_price': float(crypto.current_price),
                'value_usd': float(holding.current_value),
                'allocation': float(holding.allocation_percentage),
                'unrealized_pl': float(holding.unrealized_pl),
                'unrealized_pl_percentage': float(holding.unrealized_pl_percentage),
                '24h_change': float(crypto.price_change_percentage_24h)
            })
        
        return {
            'type': 'portfolio_data',
            'data': {
                'portfolio': {
                    'total_value': float(portfolio.total_value),
                    'unrealized_pl': float(portfolio.unrealized_pl),
                    'realized_pl': float(portfolio.realized_pl),
                    'daily_change': float(portfolio.daily_change),
                    'daily_change_percentage': float(portfolio.daily_change_percentage),
                    'initial_investment': float(portfolio.initial_investment)
                },
                'holdings': holdings_data
            }
        }

    @database_sync_to_async
    def get_analytics_data(self, timeframe):
        """Get portfolio analytics data"""
        from .services.portfolio_service import portfolio_service
        
        portfolio = portfolio_service.get_user_portfolio(self.user)
        analytics = portfolio_service.get_portfolio_analytics(portfolio, timeframe)
        
        return {
            'type': 'analytics_data',
            'data': analytics
        }

    async def send_initial_portfolio_data(self):
        """Send initial portfolio data on connection"""
        try:
            portfolio_data = await self.get_portfolio_data()
            await self.send(text_data=json.dumps(portfolio_data))
        except Exception as e:
            logger.error(f"Error sending initial portfolio data: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to load portfolio data'
            }))

    async def send_updated_portfolio_data(self):
        """Send updated portfolio data"""
        try:
            portfolio_data = await self.get_portfolio_data()
            await self.send(text_data=json.dumps(portfolio_data))
        except Exception as e:
            logger.error(f"Error sending updated portfolio data: {e}")

    async def send_analytics_data(self, timeframe):
        """Send analytics data"""
        try:
            analytics_data = await self.get_analytics_data(timeframe)
            await self.send(text_data=json.dumps(analytics_data))
        except Exception as e:
            logger.error(f"Error sending analytics data: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to load analytics data'
            }))


class WithdrawalConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time withdrawal updates"""
    
    async def connect(self):
        """Handle WebSocket connection"""
        self.user = self.scope["user"]  # type: ignore
        
        # Require authentication
        if self.user.is_anonymous:  # type: ignore
            await self.close()
            return
        
        # Create unique group name for this user's withdrawals
        self.withdrawal_group_name = f'withdrawals_{self.user.id}'  # type: ignore
        
        # Join withdrawal group
        await self.channel_layer.group_add(
            self.withdrawal_group_name,
            self.channel_name
        )
        
        await self.accept()
        logger.info(f"Withdrawal WebSocket connected for user: {self.user.username}")  # type: ignore
        
        # Send connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to withdrawal updates',
            'timestamp': await self.get_current_timestamp()
        }))

    async def disconnect(self, close_code):  # type: ignore
        """Handle WebSocket disconnection"""
        # Leave withdrawal group
        if hasattr(self, 'withdrawal_group_name'):
            await self.channel_layer.group_discard(
                self.withdrawal_group_name,
                self.channel_name
            )
        logger.info(f"Withdrawal WebSocket disconnected for user: {self.user.username}")  # type: ignore

    async def receive(self, text_data=None, bytes_data=None):  # type: ignore
        """Receive message from WebSocket"""
        try:
            if text_data:
                data = json.loads(text_data)
                message_type = data.get('type')
                
                if message_type == 'ping':
                    # Respond to ping with pong
                    await self.send(text_data=json.dumps({
                        'type': 'pong',
                        'timestamp': await self.get_current_timestamp()
                    }))
                elif message_type == 'get_recent_withdrawals':
                    # Send recent withdrawals
                    await self.send_recent_withdrawals()
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error processing withdrawal WebSocket message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Internal server error'
            }))

    # Event handlers called from channel layer
    async def withdrawal_status_update(self, event):
        """Handle withdrawal status update event"""
        await self.send(text_data=json.dumps({
            'type': 'withdrawal_status_update',
            'withdrawal_id': event['withdrawal_id'],
            'status': event['status'],
            'message': event.get('message', ''),
            'timestamp': event.get('timestamp', await self.get_current_timestamp())
        }))

    async def withdrawal_completed(self, event):
        """Handle withdrawal completed event"""
        await self.send(text_data=json.dumps({
            'type': 'withdrawal_completed',
            'withdrawal_id': event['withdrawal_id'],
            'cryptocurrency': event['cryptocurrency'],
            'amount': event['amount'],
            'transaction_hash': event.get('transaction_hash', ''),
            'message': event.get('message', 'Withdrawal completed successfully'),
            'timestamp': event.get('timestamp', await self.get_current_timestamp())
        }))
        
        # Also send updated balance
        await self.send_balance_update()

    async def withdrawal_failed(self, event):
        """Handle withdrawal failed event"""
        await self.send(text_data=json.dumps({
            'type': 'withdrawal_failed',
            'withdrawal_id': event['withdrawal_id'],
            'cryptocurrency': event['cryptocurrency'],
            'amount': event['amount'],
            'reason': event.get('reason', 'Unknown error'),
            'message': event.get('message', 'Withdrawal failed'),
            'timestamp': event.get('timestamp', await self.get_current_timestamp())
        }))

    async def balance_update(self, event):
        """Handle balance update event"""
        await self.send(text_data=json.dumps({
            'type': 'balance_update',
            'balances': event['balances'],
            'timestamp': event.get('timestamp', await self.get_current_timestamp())
        }))

    @database_sync_to_async
    def get_recent_withdrawals_data(self):
        """Get recent withdrawals for the user"""
        from .models import Transaction
        
        withdrawals = Transaction.objects.filter(
            user=self.user,
            transaction_type='WITHDRAWAL'
        ).order_by('-created_at')[:10]
        
        withdrawal_list = []
        for withdrawal in withdrawals:
            withdrawal_list.append({
                'id': withdrawal.id,
                'cryptocurrency': withdrawal.cryptocurrency,
                'amount': float(withdrawal.amount),
                'wallet_address': withdrawal.wallet_address or '',
                'status': withdrawal.status,
                'transaction_hash': withdrawal.transaction_hash or '',
                'created_at': withdrawal.created_at.isoformat(),
                'completed_at': withdrawal.completed_at.isoformat() if withdrawal.completed_at else None
            })
        
        return withdrawal_list

    @database_sync_to_async
    def get_user_balances(self):
        """Get current user balances"""
        balances = {
            'BTC': float(self.user.btc_balance),
            'ETH': float(self.user.ethereum_balance),
            'USDT': float(self.user.usdt_balance),
            'LTC': float(self.user.litecoin_balance),
            'TRX': float(self.user.tron_balance)
        }
        return balances

    @database_sync_to_async
    def get_current_timestamp(self):
        """Get current timestamp"""
        return timezone.now().isoformat()

    async def send_recent_withdrawals(self):
        """Send recent withdrawals to client"""
        try:
            withdrawals = await self.get_recent_withdrawals_data()
            await self.send(text_data=json.dumps({
                'type': 'recent_withdrawals',
                'withdrawals': withdrawals,
                'timestamp': await self.get_current_timestamp()
            }))
        except Exception as e:
            logger.error(f"Error sending recent withdrawals: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Failed to load recent withdrawals'
            }))

    async def send_balance_update(self):
        """Send updated balances to client"""
        try:
            balances = await self.get_user_balances()
            await self.send(text_data=json.dumps({
                'type': 'balance_update',
                'balances': balances,
                'timestamp': await self.get_current_timestamp()
            }))
        except Exception as e:
            logger.error(f"Error sending balance update: {e}")