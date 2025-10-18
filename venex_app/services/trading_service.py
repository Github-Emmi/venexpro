from django.db import transaction
from django.utils import timezone
from decimal import Decimal
import logging
from ..models import CustomUser, Transaction, Order, Portfolio, Cryptocurrency

logger = logging.getLogger(__name__)

class TradingService:
    """Service class for handling trading operations"""
    
    @staticmethod
    @transaction.atomic
    def execute_market_buy(user, cryptocurrency, quantity, current_price):
        """
        Execute a market buy order
        """
        try:
            # Calculate total cost
            total_cost = quantity * current_price
            
            # Check if user has sufficient USDT balance
            if user.usdt_balance < total_cost:
                raise ValueError(f"Insufficient USDT balance. Required: {total_cost}, Available: {user.usdt_balance}")
            
            # Update user balances
            user.usdt_balance -= total_cost
            crypto_field = f"{cryptocurrency.lower()}_balance"
            current_crypto_balance = getattr(user, crypto_field)
            setattr(user, crypto_field, current_crypto_balance + quantity)
            user.save()
            
            # Create transaction record
            buy_transaction = Transaction.objects.create(
                user=user,
                transaction_type='BUY',
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                price_per_unit=current_price,
                total_amount=total_cost,
                currency='USD',
                status='COMPLETED',
                completed_at=timezone.now()
            )
            
            # Update portfolio
            TradingService.update_portfolio(user, cryptocurrency)
            
            logger.info(f"Market buy executed: {user.email} bought {quantity} {cryptocurrency} at {current_price}")
            return buy_transaction
            
        except Exception as e:
            logger.error(f"Market buy failed for {user.email}: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def execute_market_sell(user, cryptocurrency, quantity, current_price):
        """
        Execute a market sell order
        """
        try:
            # Check if user has sufficient cryptocurrency balance
            crypto_field = f"{cryptocurrency.lower()}_balance"
            current_balance = getattr(user, crypto_field)
            
            if current_balance < quantity:
                raise ValueError(f"Insufficient {cryptocurrency} balance. Required: {quantity}, Available: {current_balance}")
            
            # Calculate total proceeds
            total_proceeds = quantity * current_price
            
            # Update user balances
            setattr(user, crypto_field, current_balance - quantity)
            user.usdt_balance += total_proceeds
            user.save()
            
            # Create transaction record
            sell_transaction = Transaction.objects.create(
                user=user,
                transaction_type='SELL',
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                price_per_unit=current_price,
                total_amount=total_proceeds,
                currency='USD',
                status='COMPLETED',
                completed_at=timezone.now()
            )
            
            # Update portfolio
            TradingService.update_portfolio(user, cryptocurrency)
            
            logger.info(f"Market sell executed: {user.email} sold {quantity} {cryptocurrency} at {current_price}")
            return sell_transaction
            
        except Exception as e:
            logger.error(f"Market sell failed for {user.email}: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def create_limit_order(user, cryptocurrency, side, quantity, price, time_in_force='GTC'):
        """
        Create a limit order
        """
        try:
            # For buy orders, reserve USDT
            if side == 'BUY':
                total_cost = quantity * price
                if user.usdt_balance < total_cost:
                    raise ValueError(f"Insufficient USDT balance for limit buy order")
                # In a real system, we'd reserve the funds
                
            # For sell orders, check cryptocurrency balance
            else:
                crypto_field = f"{cryptocurrency.lower()}_balance"
                current_balance = getattr(user, crypto_field)
                if current_balance < quantity:
                    raise ValueError(f"Insufficient {cryptocurrency} balance for limit sell order")
                # In a real system, we'd reserve the cryptocurrency
            
            # Create the order
            order = Order.objects.create(
                user=user,
                order_type='LIMIT',
                side=side,
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                price=price,
                time_in_force=time_in_force,
                status='OPEN'
            )
            
            logger.info(f"Limit order created: {user.email} {side} {quantity} {cryptocurrency} at {price}")
            return order
            
        except Exception as e:
            logger.error(f"Limit order creation failed for {user.email}: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def create_stop_order(user, cryptocurrency, side, quantity, stop_price, time_in_force='GTC'):
        """
        Create a stop order
        """
        try:
            # Validate balances based on order side
            if side == 'BUY':
                # For stop buy orders, we need to check funds when the order triggers
                pass
            else:
                # For stop sell orders, check cryptocurrency balance
                crypto_field = f"{cryptocurrency.lower()}_balance"
                current_balance = getattr(user, crypto_field)
                if current_balance < quantity:
                    raise ValueError(f"Insufficient {cryptocurrency} balance for stop sell order")
            
            # Create the order
            order = Order.objects.create(
                user=user,
                order_type='STOP_LOSS',
                side=side,
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                stop_price=stop_price,
                time_in_force=time_in_force,
                status='OPEN'
            )
            
            logger.info(f"Stop order created: {user.email} {side} {quantity} {cryptocurrency} at {stop_price}")
            return order
            
        except Exception as e:
            logger.error(f"Stop order creation failed for {user.email}: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def cancel_order(user, order_id):
        """
        Cancel an existing order
        """
        try:
            order = Order.objects.get(id=order_id, user=user)
            
            if order.status not in ['OPEN', 'PARTIALLY_FILLED']:
                raise ValueError("Cannot cancel order that is not open or partially filled")
            
            order.status = 'CANCELLED'
            order.save()
            
            # In a real system, we'd release any reserved funds here
            
            logger.info(f"Order cancelled: {order_id} for user {user.email}")
            return order
            
        except Order.DoesNotExist:
            raise ValueError("Order not found")
        except Exception as e:
            logger.error(f"Order cancellation failed for {user.email}: {str(e)}")
            raise

    @staticmethod
    def update_portfolio(user, cryptocurrency):
        """
        Update user's portfolio for a specific cryptocurrency
        """
        try:
            # Get all completed transactions for this crypto
            transactions = Transaction.objects.filter(
                user=user, 
                cryptocurrency=cryptocurrency,
                status='COMPLETED'
            )
            
            total_quantity = Decimal('0')
            total_invested = Decimal('0')
            
            # Calculate total quantity and investment
            for tx in transactions:
                if tx.transaction_type == 'BUY':
                    total_quantity += tx.quantity # type:ignore
                    total_invested += tx.total_amount if tx.total_amount else Decimal('0')
                elif tx.transaction_type == 'SELL':
                    total_quantity -= tx.quantity # type:ignore
                    # Adjust investment using average cost method
                    if total_quantity > 0 and total_invested > 0:
                        avg_cost = total_invested / total_quantity
                        total_invested -= tx.quantity * avg_cost # type:ignore
            
            # Get current price
            try:
                crypto = Cryptocurrency.objects.get(symbol=cryptocurrency)
                current_price = crypto.current_price
            except Cryptocurrency.DoesNotExist:
                current_price = Decimal('0')
            
            # Update or create portfolio entry
            portfolio, created = Portfolio.objects.get_or_create(
                user=user,
                cryptocurrency=cryptocurrency,
                defaults={
                    'total_quantity': total_quantity,
                    'average_buy_price': total_invested / total_quantity if total_quantity > 0 else Decimal('0'),
                    'total_invested': total_invested,
                }
            )
            
            if not created:
                portfolio.total_quantity = total_quantity
                portfolio.average_buy_price = total_invested / total_quantity if total_quantity > 0 else Decimal('0')
                portfolio.total_invested = total_invested
            
            # Calculate current values
            portfolio.current_value = total_quantity * current_price
            portfolio.profit_loss = portfolio.current_value - total_invested
            portfolio.profit_loss_percentage = (
                (portfolio.profit_loss / total_invested * 100) 
                if total_invested > 0 else Decimal('0')
            )
            portfolio.save()
            
        except Exception as e:
            logger.error(f"Portfolio update failed for {user.email}: {str(e)}")

    @staticmethod
    def get_user_balance(user, cryptocurrency):
        """
        Get user's available balance for a cryptocurrency
        """
        balance_fields = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance'
        }
        
        field = balance_fields.get(cryptocurrency)
        if field:
            return getattr(user, field)
        return Decimal('0')

    @staticmethod
    def validate_trade(user, cryptocurrency, quantity, price, action):
        """
        Validate if a trade can be executed
        """
        errors = []
        
        if quantity <= 0:
            errors.append("Quantity must be positive")
        
        if price <= 0:
            errors.append("Price must be positive")
        
        if action == 'BUY':
            total_cost = quantity * price
            if user.usdt_balance < total_cost:
                errors.append(f"Insufficient USDT balance. Required: {total_cost}, Available: {user.usdt_balance}")
        
        else:  # SELL
            current_balance = TradingService.get_user_balance(user, cryptocurrency)
            if current_balance < quantity:
                errors.append(f"Insufficient {cryptocurrency} balance. Required: {quantity}, Available: {current_balance}")
        
        return errors

class OrderMatchingEngine:
    """Simple order matching engine for limit orders"""
    
    @staticmethod
    def match_orders():
        """
        Match open limit orders (simplified implementation)
        In production, this would be much more complex
        """
        try:
            # Get all open buy orders sorted by price (descending) and time
            buy_orders = Order.objects.filter(
                order_type='LIMIT',
                side='BUY',
                status='OPEN'
            ).order_by('-price', 'created_at')
            
            # Get all open sell orders sorted by price (ascending) and time
            sell_orders = Order.objects.filter(
                order_type='LIMIT', 
                side='SELL',
                status='OPEN'
            ).order_by('price', 'created_at')
            
            matches = []
            
            for buy_order in buy_orders:
                for sell_order in sell_orders:
                    # Check if orders can be matched (buy price >= sell price)
                    if buy_order.price >= sell_order.price: # type:ignore

                        match_quantity = min(buy_order.quantity - buy_order.filled_quantity,
                                           sell_order.quantity - sell_order.filled_quantity)
                        
                        if match_quantity > 0:
                            matches.append({
                                'buy_order': buy_order,
                                'sell_order': sell_order,
                                'quantity': match_quantity,
                                'price': sell_order.price  # Use sell order price
                            })
            
            # Execute matches
            for match in matches:
                OrderMatchingEngine.execute_match(match)
                
        except Exception as e:
            logger.error(f"Order matching failed: {str(e)}")

    @staticmethod
    @transaction.atomic
    def execute_match(match):
        """
        Execute a matched order pair
        """
        try:
            buy_order = match['buy_order']
            sell_order = match['sell_order']
            quantity = match['quantity']
            price = match['price']
            
            # Update order fills
            buy_order.filled_quantity += quantity
            sell_order.filled_quantity += quantity
            
            # Calculate average filled prices
            if buy_order.average_filled_price == 0:
                buy_order.average_filled_price = price
            else:
                buy_order.average_filled_price = (
                    (buy_order.average_filled_price * (buy_order.filled_quantity - quantity) + price * quantity) /
                    buy_order.filled_quantity
                )
            
            if sell_order.average_filled_price == 0:
                sell_order.average_filled_price = price
            else:
                sell_order.average_filled_price = (
                    (sell_order.average_filled_price * (sell_order.filled_quantity - quantity) + price * quantity) /
                    sell_order.filled_quantity
                )
            
            # Check if orders are fully filled
            if buy_order.filled_quantity >= buy_order.quantity:
                buy_order.status = 'FILLED'
                buy_order.filled_at = timezone.now()
            
            if sell_order.filled_quantity >= sell_order.quantity:
                sell_order.status = 'FILLED' 
                sell_order.filled_at = timezone.now()
            
            buy_order.save()
            sell_order.save()
            
            # Create transactions for both sides
            TradingService.execute_market_buy(
                buy_order.user,
                buy_order.cryptocurrency,
                quantity,
                price
            )
            
            TradingService.execute_market_sell(
                sell_order.user,
                sell_order.cryptocurrency, 
                quantity,
                price
            )
            
            logger.info(f"Order match executed: {quantity} {buy_order.cryptocurrency} at {price}")
            
        except Exception as e:
            logger.error(f"Order match execution failed: {str(e)}")
            raise