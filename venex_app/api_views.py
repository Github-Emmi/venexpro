
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
from .models import PasswordResetCode

logger = logging.getLogger(__name__)

# ================================
# BUY CODE VERIFICATION ENDPOINT
# ================================

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_verify_buy_code(request):
    """
    API endpoint to verify buy transaction code and complete the purchase
    """
    user = request.user
    code = request.data.get('code')
    
    if not code or len(code) != 6:
        return Response(
            {
                'error': 'Invalid code',
                'message': 'Please enter a valid 6-digit verification code.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Find the most recent unused code for this user
        reset_code = PasswordResetCode.objects.filter(
            user=user,
            code=code,
            is_used=False
        ).order_by('-created_at').first()
        
        if not reset_code:
            return Response(
                {
                    'error': 'Invalid code',
                    'message': 'The verification code you entered is incorrect.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not reset_code.is_valid():
            return Response(
                {
                    'error': 'Code expired',
                    'message': 'This verification code has expired. Please request a new one.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Mark code as used
        reset_code.mark_used()
        
        # Find the most recent PENDING transaction and mark it as COMPLETED
        pending_transaction = Transaction.objects.filter(
            user=user,
            status='PENDING'
        ).order_by('-created_at').first()
        
        if pending_transaction:
            pending_transaction.status = 'COMPLETED'
            pending_transaction.completed_at = timezone.now()
            pending_transaction.save()
            
            return Response(
                {
                    'success': True,
                    'message': 'Purchase verified successfully! Your cryptocurrency has been added to your wallet.',
                    'transaction': TransactionSerializer(pending_transaction).data
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    'success': True,
                    'message': 'Code verified successfully.',
                    'warning': 'No pending transaction found.'
                },
                status=status.HTTP_200_OK
            )
            
    except Exception as e:
        logger.error(f"Verification error: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Verification failed',
                'message': f'An error occurred while verifying your code: {str(e)}'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

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
        market_overview = crypto_service.get_market_overview() if hasattr(crypto_service, 'get_market_overview') else {} # type: ignore

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
    API endpoint for buying cryptocurrency with currency_balance validation
    Supports multi-currency with real-time exchange rate conversion
    """
    try:
        logger.info(f"Buy API called with data: {request.data}")
        serializer = TransactionCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            with transaction.atomic():
                # Get current price if not provided (price is always in USD)
                if not data.get('price_per_unit'): # type: ignore
                    current_price = get_current_price(data['cryptocurrency'])  # type: ignore
                    data['price_per_unit'] = current_price  # type: ignore
                if not data.get('total_amount'):  # type: ignore
                    data['total_amount'] = data['quantity'] * data['price_per_unit']  # type: ignore

                # Calculate total cost in USD
                total_cost_usd = Decimal(str(data['total_amount']))  # type: ignore
                network_fee_usd = total_cost_usd * Decimal('0.001')  # 0.1% network fee
                final_cost_usd = total_cost_usd + network_fee_usd
                
                # Convert to user's currency if not USD
                from .services.currency_service import currency_service
                user_currency = request.user.currency_type
                
                if user_currency != 'USD':
                    # Get exchange rate
                    exchange_rate = currency_service.get_exchange_rate('USD', user_currency)
                    
                    # Convert all amounts to user's currency
                    final_cost_in_user_currency = currency_service.usd_to_user_currency(
                        final_cost_usd, 
                        user_currency
                    )
                    network_fee_in_user_currency = currency_service.usd_to_user_currency(
                        network_fee_usd,
                        user_currency
                    )
                    
                    logger.info(
                        f"Currency conversion: {final_cost_usd:.2f} USD = "
                        f"{final_cost_in_user_currency:.2f} {user_currency} "
                        f"(rate: {exchange_rate})"
                    )
                else:
                    # User has USD, no conversion needed
                    final_cost_in_user_currency = final_cost_usd
                    network_fee_in_user_currency = network_fee_usd
                    exchange_rate = Decimal('1.00')
                
                # Validate sufficient currency_balance (in user's currency)
                if request.user.currency_balance < final_cost_in_user_currency:
                    shortfall = final_cost_in_user_currency - request.user.currency_balance
                    currency_symbol = currency_service.get_currency_symbol(user_currency)
                    
                    return Response(
                        {
                            'error': 'Insufficient balance',
                            'message': f'You need {currency_symbol}{final_cost_in_user_currency:.2f} but only have {currency_symbol}{request.user.currency_balance:.2f}. Shortfall: {currency_symbol}{shortfall:.2f}',
                            'required': float(final_cost_in_user_currency),
                            'available': float(request.user.currency_balance),
                            'shortfall': float(shortfall),
                            'currency': user_currency,
                            'currency_symbol': currency_symbol,
                            'total_usd': float(final_cost_usd),
                            'exchange_rate': float(exchange_rate)
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Create buy transaction with PENDING status (will be COMPLETED after email verification)
                buy_transaction = Transaction.objects.create(
                    user=request.user,
                    transaction_type='BUY',
                    cryptocurrency=data['cryptocurrency'],  # type: ignore
                    quantity=data['quantity'],  # type: ignore
                    price_per_unit=data['price_per_unit'],  # type: ignore (in USD)
                    total_amount=final_cost_in_user_currency,  # Store in user's currency
                    currency=user_currency,
                    network_fee=network_fee_in_user_currency,
                    status='PENDING',  # Changed to PENDING until email verification
                )

                # Update user balances (deduct currency_balance in user's currency, add crypto)
                update_user_balances_after_buy(
                    request.user, 
                    data, 
                    network_fee_in_user_currency,
                    final_cost_in_user_currency
                )

                # Update portfolio
                update_user_portfolio(request.user, data['cryptocurrency'])  # type: ignore

                # Generate verification code (6 digits)
                import random
                verification_code = str(random.randint(100000, 999999))

                # Save code to DB for later verification
                from .models import PasswordResetCode
                PasswordResetCode.objects.create(
                    user=request.user,
                    code=verification_code
                )

                # Send verification code email
                from .services.email_service import EmailService
                EmailService.send_verification_notification(request.user, verification_code)
                logger.info(f"Verification code sent to {request.user.email}")
                
                currency_symbol = currency_service.get_currency_symbol(user_currency)

                return Response(
                    {
                        'success': True,
                        'message': 'Purchase initiated successfully. Please check your email for the verification code.',
                        'transaction': TransactionSerializer(buy_transaction).data,
                        'verification_code': verification_code,
                        'total_cost': float(final_cost_in_user_currency),
                        'total_cost_usd': float(final_cost_usd),
                        'network_fee': float(network_fee_in_user_currency),
                        'remaining_balance': float(request.user.currency_balance),
                        'currency': user_currency,
                        'currency_symbol': currency_symbol,
                        'exchange_rate': float(exchange_rate)
                    },
                    status=status.HTTP_201_CREATED
                )
        else:
            logger.error(f"Buy API serializer errors: {serializer.errors}")
            return Response(
                {
                    'error': 'Validation failed',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except ValueError as ve:
        logger.error(f"Buy API validation error: {str(ve)}")
        return Response(
            {
                'error': 'Transaction failed',
                'message': str(ve)
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Buy API exception: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Transaction failed',
                'message': f'An unexpected error occurred: {str(e)}'
            },
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
    API endpoint for selling cryptocurrency with currency_balance credits
    """
    try:
        serializer = TransactionCreateSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            
            with transaction.atomic():
                # Get current price if not provided
                if not data.get('price_per_unit'): # type:ignore
                    current_price = get_current_price(data['cryptocurrency']) # type:ignore
                    data['price_per_unit'] = current_price # type:ignore
                
                if not data.get('total_amount'): # type:ignore
                    data['total_amount'] = data['quantity'] * data['price_per_unit'] # type:ignore
                
                # Calculate network fee
                sale_amount = Decimal(str(data['total_amount'])) # type:ignore
                network_fee = sale_amount * Decimal('0.001')  # 0.1% network fee
                net_proceeds = sale_amount - network_fee
                
                # Check if user has sufficient cryptocurrency balance to sell
                crypto_symbol = data['cryptocurrency'].symbol if hasattr(data['cryptocurrency'], 'symbol') else data['cryptocurrency']
                
                # Map crypto symbols to model field names
                crypto_field_map = {
                    'BTC': 'btc_balance',
                    'ETH': 'ethereum_balance',
                    'USDT': 'usdt_balance',
                    'LTC': 'litecoin_balance',
                    'TRX': 'tron_balance',
                }
                crypto_field = crypto_field_map.get(crypto_symbol.upper())
                if not crypto_field:
                    return Response(
                        {'error': 'Unsupported cryptocurrency', 'message': f'{crypto_symbol} is not supported.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                current_balance = getattr(request.user, crypto_field, Decimal('0'))
                
                # Validate sufficient cryptocurrency balance
                if current_balance < data['quantity']: # type:ignore
                    return Response(
                        {
                            'error': 'Insufficient cryptocurrency balance',
                            'message': f'You need {data["quantity"]:.8f} {crypto_symbol} but only have {current_balance:.8f} {crypto_symbol}.',
                            'required': float(data['quantity']), # type:ignore
                            'available': float(current_balance),
                            'cryptocurrency': crypto_symbol
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create sell transaction
                sell_transaction = Transaction.objects.create(
                    user=request.user,
                    transaction_type='SELL',
                    cryptocurrency=data['cryptocurrency'], # type:ignore
                    quantity=data['quantity'], # type:ignore
                    price_per_unit=data['price_per_unit'], # type:ignore
                    total_amount=data['total_amount'], # type:ignore
                    currency=data.get('currency', request.user.currency_type), # type:ignore
                    network_fee=network_fee,
                    status='COMPLETED',
                    completed_at=timezone.now()
                )
                
                # Update user balances (deduct crypto, add currency_balance)
                update_user_balances_after_sell(request.user, data, network_fee)
                
                # Update portfolio
                update_user_portfolio(request.user, data['cryptocurrency']) # type:ignore
                
                return Response(
                    {
                        'success': True,
                        'message': 'Cryptocurrency sold successfully',
                        'transaction': TransactionSerializer(sell_transaction).data,
                        'sale_proceeds': float(net_proceeds),
                        'network_fee': float(network_fee),
                        'new_balance': float(request.user.currency_balance),
                        'currency': request.user.currency_type
                    },
                    status=status.HTTP_201_CREATED
                )
        else:
            return Response(
                {
                    'error': 'Validation failed',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
    except ValueError as ve:
        logger.error(f"Sell API validation error: {str(ve)}")
        return Response(
            {
                'error': 'Transaction failed',
                'message': str(ve)
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Sell API exception: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Transaction failed',
                'message': f'An unexpected error occurred: {str(e)}'
            },
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
    API endpoint for user profile data including currency_balance
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
            'currency_type': user.currency_type,
            'balances': {
                'currency_balance': float(user.currency_balance),
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

def update_user_balances_after_buy(user, data, network_fee=None, total_cost=None):
    """
    Update user balances after a buy transaction
    Uses currency_balance to purchase cryptocurrency
    
    Args:
        user: User object
        data: Transaction data dict
        network_fee: Network fee in user's currency (optional)
        total_cost: Total cost in user's currency (optional, if not provided will calculate)
    """
    # Get the cryptocurrency symbol (data['cryptocurrency'] is now a Cryptocurrency object)
    crypto_symbol = data['cryptocurrency'].symbol if hasattr(data['cryptocurrency'], 'symbol') else data['cryptocurrency']
    
    # Map crypto symbols to model field names
    crypto_field_map = {
        'BTC': 'btc_balance',
        'ETH': 'ethereum_balance',
        'USDT': 'usdt_balance',
        'LTC': 'litecoin_balance',
        'TRX': 'tron_balance',
    }
    
    crypto_field = crypto_field_map.get(crypto_symbol.upper())
    if not crypto_field:
        raise ValueError(f'Unsupported cryptocurrency: {crypto_symbol}')
    
    # Calculate total cost if not provided
    if total_cost is None:
        total_cost = data['quantity'] * data['price_per_unit']
        if network_fee:
            total_cost += network_fee
    
    # Validate sufficient currency_balance
    if user.currency_balance < total_cost:
        raise ValueError(
            f'Insufficient balance. Required: {total_cost:.2f} {user.currency_type}, '
            f'Available: {user.currency_balance:.2f} {user.currency_type}'
        )
    
    # Deduct from currency_balance
    user.currency_balance -= total_cost
    
    # Add cryptocurrency to user's crypto balance
    current_crypto_balance = getattr(user, crypto_field, Decimal('0'))
    setattr(user, crypto_field, current_crypto_balance + data['quantity'])
    
    user.save()
    logger.info(
        f"Balance updated for {user.email}: -{total_cost:.2f} {user.currency_type}, "
        f"+{data['quantity']:.8f} {crypto_symbol}"
    )

def update_user_balances_after_sell(user, data, network_fee=None):
    """
    Update user balances after a sell transaction
    Adds to currency_balance when selling cryptocurrency
    """
    # Get the cryptocurrency symbol (data['cryptocurrency'] is now a Cryptocurrency object)
    crypto_symbol = data['cryptocurrency'].symbol if hasattr(data['cryptocurrency'], 'symbol') else data['cryptocurrency']
    
    # Map crypto symbols to model field names
    crypto_field_map = {
        'BTC': 'btc_balance',
        'ETH': 'ethereum_balance',
        'USDT': 'usdt_balance',
        'LTC': 'litecoin_balance',
        'TRX': 'tron_balance',
    }
    
    crypto_field = crypto_field_map.get(crypto_symbol.upper())
    if not crypto_field:
        raise ValueError(f'Unsupported cryptocurrency: {crypto_symbol}')
    
    current_crypto_balance = getattr(user, crypto_field, Decimal('0'))
    
    # Validate sufficient cryptocurrency balance
    if current_crypto_balance < data['quantity']:
        raise ValueError(
            f'Insufficient {crypto_symbol} balance. Required: {data["quantity"]:.8f} {crypto_symbol}, '
            f'Available: {current_crypto_balance:.8f} {crypto_symbol}'
        )
    
    # Deduct sold cryptocurrency
    setattr(user, crypto_field, current_crypto_balance - data['quantity'])
    
    # Calculate sale proceeds
    sale_proceeds = data['quantity'] * data['price_per_unit']
    if network_fee:
        sale_proceeds -= network_fee
    
    # Add to currency_balance
    user.currency_balance += sale_proceeds
    
    user.save()
    logger.info(
        f"Balance updated for {user.email}: -{data['quantity']:.8f} {crypto_symbol}, "
        f"+{sale_proceeds:.2f} {user.currency_type}"
    )

def update_user_portfolio(user, cryptocurrency):
    """
    Update user's portfolio for a specific cryptocurrency
    """
    try:
        # Handle both Cryptocurrency object and symbol string
        crypto_symbol = cryptocurrency.symbol if hasattr(cryptocurrency, 'symbol') else cryptocurrency
        
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
        
        # Update or create portfolio (use symbol string for CharField)
        portfolio, created = Portfolio.objects.get_or_create(
            user=user,
            cryptocurrency=crypto_symbol,
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
        logger.error(f"Error updating portfolio: {e}", exc_info=True)

def get_user_wallet_address(user, cryptocurrency):
    """
    Get user's wallet address for a specific cryptocurrency
    """
    # Handle both Cryptocurrency object and symbol string
    crypto_symbol = cryptocurrency.symbol if hasattr(cryptocurrency, 'symbol') else cryptocurrency
    
    wallet_fields = {
        'BTC': 'btc_wallet',
        'ETH': 'ethereum_wallet', 
        'USDT': 'usdt_wallet',
        'LTC': 'litecoin_wallet',
        'TRX': 'tron_wallet'
    }
    
    field = wallet_fields.get(crypto_symbol)
    return getattr(user, field) if field else "Admin wallet address"

def execute_market_order(user, order_data):
    """
    Execute a market order immediately
    """
    try:
        with transaction.atomic():
            current_price = get_current_price(order_data['cryptocurrency'])
            
            # Get the cryptocurrency symbol (order_data['cryptocurrency'] is now a Cryptocurrency object)
            crypto_symbol = order_data['cryptocurrency'].symbol if hasattr(order_data['cryptocurrency'], 'symbol') else order_data['cryptocurrency']
            
            # Map crypto symbols to model field names
            crypto_field_map = {
                'BTC': 'btc_balance',
                'ETH': 'ethereum_balance',
                'USDT': 'usdt_balance',
                'LTC': 'litecoin_balance',
                'TRX': 'tron_balance',
            }
            crypto_field = crypto_field_map.get(crypto_symbol.upper())
            if not crypto_field:
                return Response(
                    {'error': 'Unsupported cryptocurrency'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if order_data['side'] == 'BUY':
                transaction_type = 'BUY'
                # For buy: check USDT balance
                total_cost = order_data['quantity'] * current_price
                if user.usdt_balance >= total_cost:
                    user.usdt_balance -= total_cost
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
                current_balance = getattr(user, crypto_field)
                if current_balance >= order_data['quantity']:
                    setattr(user, crypto_field, current_balance - order_data['quantity'])
                    sale_proceeds = order_data['quantity'] * current_price
                    user.usdt_balance += sale_proceeds
                else:
                    return Response(
                        {'error': f'Insufficient {crypto_symbol} balance'},
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
        # Handle both Cryptocurrency object and symbol string
        if hasattr(cryptocurrency, 'current_price'):
            # It's already a Cryptocurrency object
            return cryptocurrency.current_price
        else:
            # It's a symbol string, query the database
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
def api_get_exchange_rate(request):
    """
    API endpoint to get current exchange rate for user's currency
    GET /api/exchange-rate/
    
    Returns:
        - exchange_rate: Current rate from USD to user's currency
        - user_currency: User's currency code
        - currency_symbol: Currency symbol for display
    """
    try:
        from .services.currency_service import currency_service
        
        user_currency = request.user.currency_type
        exchange_rate = currency_service.get_exchange_rate('USD', user_currency)
        currency_symbol = currency_service.get_currency_symbol(user_currency)
        
        # Get all available rates for reference
        all_rates = currency_service.get_exchange_rates()
        
        return Response({
            'success': True,
            'exchange_rate': float(exchange_rate),
            'user_currency': user_currency,
            'currency_symbol': currency_symbol,
            'all_rates': {k: float(v) for k, v in all_rates.items()} if len(all_rates) < 50 else {}
        })
        
    except Exception as e:
        logger.error(f"Error fetching exchange rate: {e}")
        return Response({
            'error': str(e),
            'message': 'Failed to fetch exchange rate'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_convert_currency(request):
    """
    API endpoint to convert amount between currencies
    POST /api/convert-currency/
    
    Payload:
        - amount: Amount to convert
        - from_currency: Source currency (optional, defaults to USD)
        - to_currency: Target currency (optional, defaults to user's currency)
    
    Returns:
        - converted_amount: Amount in target currency
        - exchange_rate: Rate used for conversion
    """
    try:
        from .services.currency_service import currency_service
        
        amount = Decimal(str(request.data.get('amount', 0)))
        from_currency = request.data.get('from_currency', 'USD')
        to_currency = request.data.get('to_currency', request.user.currency_type)
        
        converted_amount = currency_service.convert_amount(amount, from_currency, to_currency)
        exchange_rate = currency_service.get_exchange_rate(from_currency, to_currency)
        
        return Response({
            'success': True,
            'original_amount': float(amount),
            'converted_amount': float(converted_amount),
            'from_currency': from_currency,
            'to_currency': to_currency,
            'exchange_rate': float(exchange_rate),
            'formatted': currency_service.format_currency(converted_amount, to_currency)
        })
        
    except Exception as e:
        logger.error(f"Error converting currency: {e}")
        return Response({
            'error': str(e),
            'message': 'Failed to convert currency'
        }, status=status.HTTP_400_BAD_REQUEST)

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