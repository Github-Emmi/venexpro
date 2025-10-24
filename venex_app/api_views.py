
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal
from django.utils import timezone
import logging
from rest_framework.decorators import api_view, permission_classes
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from rest_framework.decorators import api_view, permission_classes
from .services.crypto_api_service import crypto_service, CryptoDataService
from .services.dashboard_service import DashboardService
from .services.trading_service import ( TradingService, OrderMatchingEngine )
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from .models import CustomUser, Transaction, Order, Portfolio, Cryptocurrency
from .serializers import (
    TransactionSerializer, OrderSerializer, PortfolioSerializer, 
    CryptocurrencySerializer, TransactionCreateSerializer, OrderCreateSerializer
)

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    """
    GET /api/dashboard/data/
    Returns summary data for the user's dashboard (portfolio, recent transactions, market overview)
    """
    try:
        user = request.user
        portfolio = Portfolio.objects.filter(user=user)
        transactions = Transaction.objects.filter(user=user).order_by('-completed_at')[:10]
        market_overview = crypto_service.get_market_overview() if hasattr(crypto_service, 'get_market_overview') else {}

        portfolio_serializer = PortfolioSerializer(portfolio, many=True)
        transaction_serializer = TransactionSerializer(transactions, many=True)

        return Response({
            'portfolio': portfolio_serializer.data,
            'recent_transactions': transaction_serializer.data,
            'market_overview': market_overview,
        })
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        return Response({'error': str(e)}, status=400)

# ================================
# TRADING OPERATIONS API ENDPOINTS
# ================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_buy_crypto(request):
    """
    API endpoint for buying cryptocurrency
    """
    try:
        serializer = TransactionCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            with transaction.atomic():
                # Get current price if not provided
                if not data.get('price_per_unit'): ## type:ignore
                    current_price = get_current_price(data['cryptocurrency']) ## type:ignore
                    data['price_per_unit'] = current_price ## type:ignore
                 ## type:ignore
                if not data.get('total_amount'): ## type:ignore
                    data['total_amount'] = data['quantity'] * data['price_per_unit'] ## type:ignore
                
                # Create buy transaction
                buy_transaction = Transaction.objects.create(
                    user=request.user,
                    transaction_type='BUY',
                    cryptocurrency=data['cryptocurrency'], ## type:ignore
                    quantity=data['quantity'], ## type:ignore
                    price_per_unit=data['price_per_unit'], ## type:ignore
                    total_amount=data['total_amount'], ## type:ignore
                    currency=data.get('currency', 'USD'), ## type:ignore
                    status='COMPLETED',
                    completed_at=timezone.now()
                )
                
                # Update user balances
                update_user_balances_after_buy(request.user, data)
                
                # Update portfolio
                update_user_portfolio(request.user, data['cryptocurrency']) ## type:ignore
                
                return Response(
                    {
                        'message': 'Buy order executed successfully',
                        'transaction': TransactionSerializer(buy_transaction).data
                    },
                    status=status.HTTP_201_CREATED
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to execute buy order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@require_GET
def get_crypto_price_data(request, symbol):
    """API endpoint to get current price data for a cryptocurrency"""
    try:
        from .models import Cryptocurrency
        crypto = Cryptocurrency.objects.get(symbol=symbol.upper())
        
        data = {
            'symbol': crypto.symbol,
            'price': float(crypto.current_price),
            'change_24h': float(crypto.price_change_24h),
            'change_percentage_24h': float(crypto.price_change_percentage_24h),
            'volume': float(crypto.volume_24h),
            'market_cap': float(crypto.market_cap),
            'last_updated': crypto.last_updated.isoformat()
        }
        return JsonResponse({'success': True, 'data': data})
    except Cryptocurrency.DoesNotExist: # type: ignore
        return JsonResponse({'success': False, 'error': 'Cryptocurrency not found'})

@require_GET
def get_historical_data(request, symbol):
    """API endpoint to get historical data for charts"""
    days = request.GET.get('days', 30)
    try:
        days = int(days)
    except ValueError:
        days = 30
    
    historical_data = crypto_service.get_historical_data (symbol, days)
    return JsonResponse({
        'success': True, 
        'symbol': symbol,
        'data': historical_data
    })

@require_GET
def get_multiple_prices(request):
    """API endpoint to get multiple cryptocurrency prices at once"""
    symbols = request.GET.get('symbols', 'BTC,ETH,USDT,LTC,TRX')
    symbol_list = [s.strip().upper() for s in symbols.split(',')]
    
    prices = crypto_service.get_multiple_prices(symbol_list)
    return JsonResponse({'success': True, 'prices': prices})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_sell_crypto(request):
    """
    API endpoint for selling cryptocurrency
    """
    try:
        serializer = TransactionCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            with transaction.atomic():
                # Get current price if not provided ## type:ignore
                if not data.get('price_per_unit'): ## type:ignore
                    current_price = get_current_price(data['cryptocurrency']) ## type:ignore
                    data['price_per_unit'] = current_price ## type:ignore
                
                if not data.get('total_amount'): ## type:ignore
                    data['total_amount'] = data['quantity'] * data['price_per_unit'] ## type:ignore
                
                # Check if user has sufficient balance to sell
                crypto_field = f"{data['cryptocurrency'].lower()}_balance" ## type:ignore
                current_balance = getattr(request.user, crypto_field)
                 ## type:ignore
                if current_balance >= data['quantity']: ## type:ignore
                    # Create sell transaction
                    sell_transaction = Transaction.objects.create(
                        user=request.user,
                        transaction_type='SELL',
                        cryptocurrency=data['cryptocurrency'], ## type:ignore
                        quantity=data['quantity'], ## type:ignore
                        price_per_unit=data['price_per_unit'], ## type:ignore
                        total_amount=data['total_amount'], ## type:ignore
                        currency=data.get('currency', 'USD'), ## type:ignore
                        status='COMPLETED',
                        completed_at=timezone.now()
                    )
                    
                    # Update user balances
                    update_user_balances_after_sell(request.user, data)
                    
                    # Update portfolio
                    update_user_portfolio(request.user, data['cryptocurrency']) ## type:ignore
                    
                    return Response(
                        {
                            'message': 'Sell order executed successfully',
                            'transaction': TransactionSerializer(sell_transaction).data
                        },
                        status=status.HTTP_201_CREATED
                    )
                else:
                    return Response(
                        {'error': f'Insufficient {data["cryptocurrency"]} balance'}, ## type:ignore
                        status=status.HTTP_400_BAD_REQUEST
                    )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to execute sell order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_deposit_funds(request):
    """
    API endpoint for depositing funds
    """
    try:
        data = request.data
        cryptocurrency = data.get('cryptocurrency', 'USDT')
        quantity = Decimal(str(data.get('quantity', 0)))
        
        if quantity <= 0:
            return Response(
                {'error': 'Deposit amount must be positive'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create deposit transaction (pending until admin confirms)
            deposit_transaction = Transaction.objects.create(
                user=request.user,
                transaction_type='DEPOSIT',
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                status='PENDING',
                wallet_address=get_user_wallet_address(request.user, cryptocurrency)
            )
            
            return Response(
                {
                    'message': 'Deposit request submitted successfully. Please send funds to the provided wallet address.',
                    'transaction': TransactionSerializer(deposit_transaction).data,
                    'wallet_address': deposit_transaction.wallet_address
                },
                status=status.HTTP_201_CREATED
            )
            
    except Exception as e:
        return Response(
            {'error': f'Failed to process deposit request: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_withdraw_funds(request):
    """
    API endpoint for withdrawing funds
    """
    try:
        data = request.data
        cryptocurrency = data.get('cryptocurrency', 'USDT')
        quantity = Decimal(str(data.get('quantity', 0)))
        wallet_address = data.get('wallet_address')
        
        if not wallet_address:
            return Response(
                {'error': 'Wallet address is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if quantity <= 0:
            return Response(
                {'error': 'Withdrawal amount must be positive'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check user balance
        crypto_field = f"{cryptocurrency.lower()}_balance"
        current_balance = getattr(request.user, crypto_field)
        
        if current_balance < quantity:
            return Response(
                {'error': f'Insufficient {cryptocurrency} balance'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create withdrawal transaction (pending until admin processes)
            withdrawal_transaction = Transaction.objects.create(
                user=request.user,
                transaction_type='WITHDRAWAL',
                cryptocurrency=cryptocurrency,
                quantity=quantity,
                wallet_address=wallet_address,
                status='PENDING'
            )
            
            # Reserve the funds by deducting immediately
            setattr(request.user, crypto_field, current_balance - quantity)
            request.user.save()
            
            return Response(
                {
                    'message': 'Withdrawal request submitted successfully. Please wait for processing.',
                    'transaction': TransactionSerializer(withdrawal_transaction).data
                },
                status=status.HTTP_201_CREATED
            )
            
    except Exception as e:
        return Response(
            {'error': f'Failed to process withdrawal request: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# ORDER MANAGEMENT API ENDPOINTS
# ================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_order(request):
    """
    API endpoint for creating trading orders (limit/stop/market)
    """
    try:
        serializer = OrderCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            # For market orders, execute immediately
            if data['order_type'] == 'MARKET': ## type:ignore
                return execute_market_order(request.user, data)
            
            # For limit/stop orders, create pending order
            order = Order.objects.create(
                user=request.user,
                order_type=data['order_type'], ## type:ignore
                side=data['side'], ## type:ignore
                cryptocurrency=data['cryptocurrency'], ## type:ignore
                quantity=data['quantity'], ## type:ignore
                price=data.get('price'), ## type:ignore
                stop_price=data.get('stop_price'), ## type:ignore
                time_in_force=data.get('time_in_force', 'GTC'), ## type:ignore
                expires_at=data.get('expires_at'), ## type:ignore
                status='OPEN'
            )
            
            return Response(
                {
                    'message': f'{order.get_order_type_display()} order created successfully',  ## type:ignore
                    'order': OrderSerializer(order).data
                },
                status=status.HTTP_201_CREATED
            )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response(
            {'error': f'Failed to create order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_cancel_order(request, order_id):
    """
    API endpoint for canceling orders
    """
    try:
        order = get_object_or_404(Order, id=order_id, user=request.user)
        
        if order.status not in ['OPEN', 'PARTIALLY_FILLED']:
            return Response(
                {'error': 'Cannot cancel order that is not open or partially filled'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        order.status = 'CANCELLED'
        order.save()
        
        return Response(
            {'message': 'Order cancelled successfully'},
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        return Response(
            {'error': f'Failed to cancel order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_orders(request):
    """
    API endpoint for getting user orders
    """
    try:
        status_filter = request.GET.get('status', '')
        orders = Order.objects.filter(user=request.user)
        
        if status_filter:
            orders = orders.filter(status=status_filter)
            
        orders = orders.order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        
        return Response({
            'orders': serializer.data,
            'total_count': orders.count()
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch orders: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# MARKET DATA API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_market_data(request):
    """
    API endpoint for market data
    """
    try:
        cryptocurrencies = Cryptocurrency.objects.filter(is_active=True)
        serializer = CryptocurrencySerializer(cryptocurrencies, many=True)
        
        # Calculate market statistics
        total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies)
        total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies)
        
        return Response({
            'cryptocurrencies': serializer.data,
            'market_stats': {
                'total_market_cap': total_market_cap,
                'total_volume': total_volume,
                'total_cryptocurrencies': cryptocurrencies.count(),
                'timestamp': timezone.now()
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch market data: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_crypto_detail(request, symbol):
    """
    API endpoint for specific cryptocurrency details
    """
    try:
        cryptocurrency = get_object_or_404(Cryptocurrency, symbol=symbol.upper(), is_active=True)
        serializer = CryptocurrencySerializer(cryptocurrency)
        
        return Response({
            'cryptocurrency': serializer.data
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch cryptocurrency data: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# PORTFOLIO API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_portfolio_data(request):
    """
    API endpoint for portfolio data
    """
    try:
        portfolio = Portfolio.objects.filter(user=request.user)
        serializer = PortfolioSerializer(portfolio, many=True)
        
        # Calculate totals
        total_invested = sum(float(item.total_invested) for item in portfolio)
        current_value = sum(float(item.current_value) for item in portfolio)
        total_profit_loss = current_value - total_invested
        
        return Response({
            'portfolio': serializer.data,
            'summary': {
                'total_invested': total_invested,
                'current_value': current_value,
                'total_profit_loss': total_profit_loss,
                'total_profit_loss_percentage': (total_profit_loss / total_invested * 100) if total_invested > 0 else 0
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch portfolio data: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_portfolio_performance(request):
    """
    API endpoint for portfolio performance data
    """
    try:
        portfolio = Portfolio.objects.filter(user=request.user)
        
        # Calculate performance metrics
        performance_data = []
        for item in portfolio:
            performance_data.append({
                'cryptocurrency': item.cryptocurrency,
                'quantity': float(item.total_quantity),
                'average_buy_price': float(item.average_buy_price),
                'current_price': float(get_current_price(item.cryptocurrency)),
                'profit_loss': float(item.profit_loss),
                'profit_loss_percentage': float(item.profit_loss_percentage)
            })
        
        return Response({
            'performance': performance_data
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch portfolio performance: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# TRANSACTION HISTORY API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_transaction_history(request):
    """
    API endpoint for transaction history
    """
    try:
        transaction_type = request.GET.get('type', '')
        status_filter = request.GET.get('status', '')
        limit = int(request.GET.get('limit', 50))
        
        transactions = Transaction.objects.filter(user=request.user)
        
        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)
        if status_filter:
            transactions = transactions.filter(status=status_filter)
            
        transactions = transactions.order_by('-created_at')[:limit]
        serializer = TransactionSerializer(transactions, many=True)
        
        return Response({
            'transactions': serializer.data,
            'total_count': transactions.count()
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch transaction history: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# USER PROFILE API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_user_profile(request):
    """
    API endpoint for user profile data
    """
    try:
        user = request.user
        profile_data = {
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_no': user.phone_no,
            'is_verified': user.is_verified,
            'balances': {
                'btc_balance': float(user.btc_balance),
                'ethereum_balance': float(user.ethereum_balance),
                'usdt_balance': float(user.usdt_balance),
                'litecoin_balance': float(user.litecoin_balance),
                'tron_balance': float(user.tron_balance),
            }
        }
        
        return Response(profile_data)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch user profile: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_update_profile(request):
    """
    API endpoint for updating user profile
    """
    try:
        user = request.user
        data = request.data
        
        # Update allowed fields
        allowed_fields = ['first_name', 'last_name', 'phone_no']
        for field in allowed_fields:
            if field in data:
                setattr(user, field, data[field])
        
        user.save()
        
        return Response({
            'message': 'Profile updated successfully',
            'user': {
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone_no': user.phone_no,
            }
        })
        
    except Exception as e:
        return Response(
            {'error': f'Failed to update profile: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# UTILITY FUNCTIONS
# ================================

def update_user_balances_after_buy(user, data):
    """
    Update user balances after a buy transaction
    """
    crypto_field = f"{data['cryptocurrency'].lower()}_balance"
    
    # For crypto buys, deduct USDT and add crypto
    if data['cryptocurrency'] != 'USDT':
        total_cost = data['quantity'] * data['price_per_unit']
        if user.usdt_balance >= total_cost:
            user.usdt_balance -= total_cost
            current_balance = getattr(user, crypto_field)
            setattr(user, crypto_field, current_balance + data['quantity'])
        else:
            raise ValueError('Insufficient USDT balance')
    else:
        # For USDT buy (deposit scenario)
        user.usdt_balance += data['quantity']
    
    user.save()

def update_user_balances_after_sell(user, data):
    """
    Update user balances after a sell transaction
    """
    crypto_field = f"{data['cryptocurrency'].lower()}_balance"
    current_balance = getattr(user, crypto_field)
    
    if current_balance >= data['quantity']:
        # Deduct sold crypto
        setattr(user, crypto_field, current_balance - data['quantity'])
        
        # Add USDT from sale
        sale_proceeds = data['quantity'] * data['price_per_unit']
        user.usdt_balance += sale_proceeds
        
        user.save()
    else:
        raise ValueError(f'Insufficient {data["cryptocurrency"]} balance')

def update_user_portfolio(user, cryptocurrency):
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
        
        for tx in transactions:
            if tx.transaction_type == 'BUY':
                total_quantity += tx.quantity ## type:ignore
                total_invested += tx.total_amount if tx.total_amount else Decimal('0')
            elif tx.transaction_type == 'SELL':
                total_quantity -= tx.quantity ## type:ignore
                # Simplified cost basis calculation
                if total_quantity > 0:
                    avg_buy_price = total_invested / total_quantity
                    total_invested -= tx.quantity * avg_buy_price ## type:ignore
        
        # Get current price
        current_price = get_current_price(cryptocurrency)
        
        # Update or create portfolio
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
        
        portfolio.current_value = total_quantity * current_price
        portfolio.profit_loss = portfolio.current_value - total_invested
        portfolio.profit_loss_percentage = (portfolio.profit_loss / total_invested * 100) if total_invested > 0 else Decimal('0')
        portfolio.save()
        
    except Exception as e:
        print(f"Error updating portfolio: {e}")

def get_user_wallet_address(user, cryptocurrency):
    """
    Get user's wallet address for a specific cryptocurrency
    """
    wallet_fields = {
        'BTC': 'btc_wallet',
        'ETH': 'ethereum_wallet', 
        'USDT': 'usdt_wallet',
        'LTC': 'litecoin_wallet',
        'TRX': 'tron_wallet'
    }
    
    field = wallet_fields.get(cryptocurrency)
    return getattr(user, field) if field else "Admin wallet address"

def execute_market_order(user, order_data):
    """
    Execute a market order immediately
    """
    try:
        with transaction.atomic():
            current_price = get_current_price(order_data['cryptocurrency'])
            
            if order_data['side'] == 'BUY':
                transaction_type = 'BUY'
                # For buy: check USDT balance
                total_cost = order_data['quantity'] * current_price
                if user.usdt_balance >= total_cost:
                    user.usdt_balance -= total_cost
                    crypto_field = f"{order_data['cryptocurrency'].lower()}_balance"
                    current_balance = getattr(user, crypto_field)
                    setattr(user, crypto_field, current_balance + order_data['quantity'])
                else:
                    return Response(
                        {'error': 'Insufficient USDT balance'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:  # SELL
                transaction_type = 'SELL'
                # For sell: check crypto balance
                crypto_field = f"{order_data['cryptocurrency'].lower()}_balance"
                current_balance = getattr(user, crypto_field)
                if current_balance >= order_data['quantity']:
                    setattr(user, crypto_field, current_balance - order_data['quantity'])
                    sale_proceeds = order_data['quantity'] * current_price
                    user.usdt_balance += sale_proceeds
                else:
                    return Response(
                        {'error': f'Insufficient {order_data["cryptocurrency"]} balance'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            user.save()
            
            # Create completed order
            order = Order.objects.create(
                user=user,
                order_type='MARKET',
                side=order_data['side'],
                cryptocurrency=order_data['cryptocurrency'],
                quantity=order_data['quantity'],
                filled_quantity=order_data['quantity'],
                average_filled_price=current_price,
                status='FILLED',
                filled_at=timezone.now()
            )
            
            # Create transaction record
            tx = Transaction.objects.create(
                user=user,
                transaction_type=transaction_type,
                cryptocurrency=order_data['cryptocurrency'],
                quantity=order_data['quantity'],
                price_per_unit=current_price,
                total_amount=order_data['quantity'] * current_price,
                status='COMPLETED',
                completed_at=timezone.now()
            )
            
            # Update portfolio
            update_user_portfolio(user, order_data['cryptocurrency'])
            
            return Response(
                {
                    'message': 'Market order executed successfully',
                    'order': OrderSerializer(order).data,
                    'transaction': TransactionSerializer(tx).data
                },
                status=status.HTTP_201_CREATED
            )
            
    except Exception as e:
        return Response(
            {'error': f'Failed to execute market order: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def get_current_price(cryptocurrency):
    """
    Get current price for a cryptocurrency
    """
    try:
        crypto = Cryptocurrency.objects.get(symbol=cryptocurrency)
        return crypto.current_price
    except Cryptocurrency.DoesNotExist:
        return Decimal('0')
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market_prices_history(request, symbol):
    """
    GET /api/market/prices/<symbol>/history/
    Returns price history for charting
    """
    range_param = request.GET.get('range', '1d')
    
    try:
        from .services.crypto_api_service import crypto_service
       
        history_data = crypto_service.get_price_history(symbol, range_param)
        
        # Rest of your code remains the same...
        if isinstance(history_data, dict):
            hd = history_data
        else:
            hd = {
                'prices': getattr(history_data, 'prices', None),
                'timestamps': getattr(history_data, 'timestamps', None),
                'current_price': getattr(history_data, 'current_price', None),
                'price_change_24h': getattr(history_data, 'price_change_24h', None),
                'price_change_percentage_24h': getattr(history_data, 'price_change_percentage_24h', None),
                'error': getattr(history_data, 'error', None)
            }
        
        if hd.get('error'):
            return Response({'error': hd.get('error')}, status=400)
        
        return Response({
            'success': True,
            'symbol': symbol,
            'range': range_param,
            'prices': hd.get('prices', []),
            'timestamps': hd.get('timestamps', []),
            'current_price': hd.get('current_price', 0),
            'price_change_24h': hd.get('price_change_24h', 0),
            'price_change_percentage_24h': hd.get('price_change_percentage_24h', 0)
        })
        
    except Exception as e:
        logger.error(f"Error in market_prices_history for {symbol}: {e}")
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def quick_trade(request):
    """
    POST /api/trade/quick/
    Quick trade execution
    """
    try:
        data = request.data
        user = request.user
        
        # Validate required fields
        required_fields = ['crypto', 'side', 'quantity']
        for field in required_fields:
            if field not in data:
                return Response({
                    'error': f'Missing required field: {field}'
                }, status=400)
        
        crypto_symbol = data['crypto'].upper()
        side = data['side'].upper()
        quantity = Decimal(str(data['quantity']))
        
        # Get current price
        current_price = crypto_service.get_crypto_price(crypto_symbol)
        if not current_price or current_price <= 0:
            return Response({
                'error': f'Could not get current price for {crypto_symbol}'
            }, status=400)
        
        # Validate quantity
        if quantity <= 0:
            return Response({
                'error': 'Quantity must be positive'
            }, status=400)
        
        total_amount = quantity * current_price
        
        # Check balances based on side
        if side == 'SELL':
            # Check if user has enough cryptocurrency
            try:
                portfolio = Portfolio.objects.get(user=user, cryptocurrency=crypto_symbol)
                if portfolio.total_quantity < quantity:
                    return Response({
                        'error': f'Insufficient {crypto_symbol} balance'
                    }, status=400)
            except Portfolio.DoesNotExist:
                return Response({
                    'error': f'No {crypto_symbol} holdings found'
                }, status=400)
        
        elif side == 'BUY':
            # Check if user has enough USD balance (simplified)
            # In real implementation, check user's fiat balance
            portfolio_data = DashboardService.get_user_portfolio_value(user)
            if portfolio_data['total_balance'] < total_amount:
                return Response({
                    'error': 'Insufficient funds'
                }, status=400)
        
        else:
            return Response({
                'error': 'Invalid side. Use BUY or SELL'
            }, status=400)
        
        # Create order
        order = Order.objects.create(
            user=user,
            order_type='MARKET',
            side=side,
            cryptocurrency=crypto_symbol,
            quantity=quantity,
            price=current_price,
            status='OPEN'
        )
        
        # Create transaction
        transaction = Transaction.objects.create(
            user=user,
            transaction_type=side,
            cryptocurrency=crypto_symbol,
            quantity=quantity,
            price_per_unit=current_price,
            total_amount=total_amount,
            currency=user.currency_type,
            status='PENDING'
        )
        
        # Update portfolio (simplified - in production, this would be more complex)
        try:
            portfolio, created = Portfolio.objects.get_or_create(
                user=user,
                cryptocurrency=crypto_symbol,
                defaults={
                    'total_quantity': quantity if side == 'BUY' else -quantity,
                    'average_buy_price': current_price,
                    'total_invested': total_amount if side == 'BUY' else Decimal('0.0'),
                    'currency_type': user.currency_type
                }
            )
            
            if not created:
                if side == 'BUY':
                    new_quantity = portfolio.total_quantity + quantity
                    new_invested = portfolio.total_invested + total_amount
                    portfolio.average_buy_price = new_invested / new_quantity
                    portfolio.total_quantity = new_quantity
                    portfolio.total_invested = new_invested
                else:  # SELL
                    portfolio.total_quantity -= quantity
                    # For simplicity, we're not adjusting average_buy_price on sells
                
                portfolio.save()
                portfolio.update_portfolio_value(current_price)
                
        except Exception as e:
            # Log portfolio update error but don't fail the trade
            logger.error(f"Portfolio update error: {e}")
        
        # Update order status
        order.status = 'FILLED'
        order.filled_quantity = quantity
        order.average_filled_price = current_price
        order.filled_at = timezone.now()
        order.save()
        
        # Update transaction status
        transaction.status = 'COMPLETED'
        transaction.completed_at = timezone.now()
        transaction.save()
        
        return Response({
            'success': True,
            'order_id': str(order.id),
            'transaction_id': str(transaction.id),
            'status': 'COMPLETED',
            'filled_quantity': float(quantity),
            'average_price': float(current_price),
            'total_amount': float(total_amount)
        })
        
    except Exception as e:
        return Response({
            'error': f'Trade execution failed: {str(e)}'
        }, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def open_orders(request):
    """
    GET /api/orders/open/
    Returns user's open orders
    """
    try:
        orders = Order.objects.filter(
            user=request.user, 
            status='OPEN'
        ).order_by('-created_at')
        
        serializer = OrderSerializer(orders, many=True)
        
        return Response({
            'success': True,
            'orders': serializer.data
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_order(request, order_id):
    """
    POST /api/orders/<order_id>/cancel/
    Cancel an open order
    """
    try:
        order = Order.objects.get(id=order_id, user=request.user)
        
        if order.status != 'OPEN':
            return Response({
                'error': 'Only open orders can be cancelled'
            }, status=400)
        
        order.status = 'CANCELLED'
        order.save()
        
        return Response({
            'success': True,
            'message': 'Order cancelled successfully'
        })
        
    except Order.DoesNotExist:
        return Response({
            'error': 'Order not found'
        }, status=404)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def portfolio_overview(request):
    """
    GET /api/portfolio/overview/
    Returns user's portfolio overview
    """
    try:
        portfolio_data = DashboardService.get_user_portfolio_value(request.user)
        
        return Response({
            'success': True,
            'total_balance': float(portfolio_data['total_balance']),
            'total_profit_loss': float(portfolio_data['total_profit_loss']),
            'total_profit_loss_pct': float(portfolio_data['total_profit_loss_pct']),
            'portfolio_details': portfolio_data['portfolio_details']
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=400)