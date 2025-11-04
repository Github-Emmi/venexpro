
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal, InvalidOperation as DecimalException
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
from .services.currency_service import CurrencyConversionService
from .services.email_service import EmailService
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_verify_sell_code(request):
    """
    API endpoint to verify sell transaction code and complete the sale
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
        
        # Find the most recent PENDING SELL transaction and mark it as COMPLETED
        pending_transaction = Transaction.objects.filter(
            user=user,
            transaction_type='SELL',
            status='PENDING'
        ).order_by('-created_at').first()
        
        if pending_transaction:
            with transaction.atomic():
                # Update balances
                crypto_symbol = pending_transaction.cryptocurrency.symbol
                crypto_field_map = {
                    'BTC': 'btc_balance',
                    'ETH': 'ethereum_balance',
                    'USDT': 'usdt_balance',
                    'LTC': 'litecoin_balance',
                    'TRX': 'tron_balance',
                }
                crypto_field = crypto_field_map.get(crypto_symbol.upper())
                
                if crypto_field:
                    # Deduct cryptocurrency
                    current_crypto = getattr(user, crypto_field, Decimal('0'))
                    new_crypto = current_crypto - pending_transaction.quantity # type: ignore
                    setattr(user, crypto_field, new_crypto)
                    
                    # Add net proceeds to currency_balance
                    net_proceeds = pending_transaction.total_amount - pending_transaction.network_fee
                    
                    # Convert to user's currency if needed
                    currency_service = CurrencyConversionService()
                    try:
                        net_proceeds_user_currency = currency_service.usd_to_user_currency(
                            float(net_proceeds),
                            user.currency_type
                        )
                    except Exception as e:
                        logger.error(f"Currency conversion error in sell verification: {str(e)}")
                        net_proceeds_user_currency = float(net_proceeds)
                    
                    user.currency_balance += Decimal(str(net_proceeds_user_currency))
                    user.save()
                    
                    # Mark transaction as COMPLETED
                    pending_transaction.status = 'COMPLETED'
                    pending_transaction.completed_at = timezone.now()
                    pending_transaction.save()
                    
                    # Update portfolio
                    try:
                        update_user_portfolio(user, pending_transaction.cryptocurrency)
                    except Exception as e:
                        logger.error(f"Portfolio update error: {str(e)}")
                
                return Response(
                    {
                        'success': True,
                        'message': 'Sale verified successfully! Funds have been added to your balance.',
                        'transaction': TransactionSerializer(pending_transaction).data,
                        'new_currency_balance': float(user.currency_balance),
                        'currency': user.currency_type
                    },
                    status=status.HTTP_200_OK
                )
        else:
            return Response(
                {
                    'success': True,
                    'message': 'Code verified successfully.',
                    'warning': 'No pending sell transaction found.'
                },
                status=status.HTTP_200_OK
            )
            
    except Exception as e:
        logger.error(f"Sell verification error: {str(e)}", exc_info=True)
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
    """API endpoint to get multiple cryptocurrency prices at once with currency conversion"""
    from .services.currency_service import currency_service
    
    symbols = request.GET.get('symbols', 'BTC,ETH,USDT,LTC,TRX')
    symbol_list = [s.strip().upper() for s in symbols.split(',')]
    
    # Get user's currency preference (default to USD)
    target_currency = request.GET.get('currency', 'USD').upper()
    
    # Get prices in USD
    prices = crypto_service.get_multiple_prices(symbol_list)
    
    # Convert prices to user's currency if not USD
    if target_currency != 'USD':
        try:
            for symbol, price_data in prices.items():
                if price_data and 'price' in price_data:
                    usd_price = price_data['price']
                    # Convert USD price to target currency
                    converted_price = currency_service.convert_amount(
                        usd_price, 
                        from_currency='USD', 
                        to_currency=target_currency
                    )
                    price_data['converted_price'] = float(converted_price)
                    price_data['original_price_usd'] = usd_price
                    price_data['currency'] = target_currency
        except Exception as e:
            logger.error(f"Currency conversion error: {e}")
            # If conversion fails, keep USD prices
            for symbol, price_data in prices.items():
                if price_data and 'price' in price_data:
                    price_data['converted_price'] = price_data['price']
                    price_data['currency'] = 'USD'
    else:
        # For USD, just copy the price
        for symbol, price_data in prices.items():
            if price_data and 'price' in price_data:
                price_data['converted_price'] = price_data['price']
                price_data['currency'] = 'USD'
    
    # Debug logging
    logger.info(f"get_multiple_prices called with symbols: {symbol_list}, currency: {target_currency}")
    logger.info(f"Returning prices: {prices}")
    
    return JsonResponse({'success': True, 'prices': prices, 'currency': target_currency})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_total_crypto_value(request):
    """
    API endpoint to calculate total cryptocurrency portfolio value in user's currency
    """
    try:
        user = request.user
        
        # Get all crypto balances
        crypto_balances = {
            'BTC': user.btc_balance,
            'ETH': user.ethereum_balance,
            'USDT': user.usdt_balance,
            'LTC': user.litecoin_balance,
            'TRX': user.tron_balance,
        }
        
        # Get current prices for all cryptocurrencies
        symbols = ['BTC', 'ETH', 'USDT', 'LTC', 'TRX']
        prices_data = crypto_service.get_multiple_prices(symbols)
        
        # Calculate total value in USD
        total_value_usd = Decimal('0.0')
        breakdown = {}
        
        for symbol in symbols:
            balance = crypto_balances.get(symbol, 0)
            if balance and balance > 0:
                # Extract price from nested dict
                price_info = prices_data.get(symbol, {})
                price = price_info.get('price', 0) if isinstance(price_info, dict) else 0
                
                if price and price > 0:
                    try:
                        balance_decimal = Decimal(str(balance))
                        price_decimal = Decimal(str(price))
                        value = balance_decimal * price_decimal
                        total_value_usd += value
                        breakdown[symbol] = {
                            'balance': float(balance),
                            'price': float(price),
                            'value': float(value)
                        }
                    except (ValueError, TypeError, ArithmeticError) as e:
                        logger.warning(f"Error calculating value for {symbol}: {e}")
                        continue
        
        # Convert to user's currency if not USD
        total_value_user_currency = total_value_usd
        if user.currency_type != 'USD':
            from venex_app.services.currency_service import CurrencyConversionService
            conversion_rate = CurrencyConversionService.get_exchange_rate('USD', user.currency_type)
            if conversion_rate:
                total_value_user_currency = total_value_usd * Decimal(str(conversion_rate))
        
        return Response({
            'success': True,
            'total_value': float(total_value_user_currency),
            'total_value_usd': float(total_value_usd),
            'currency': user.currency_type,
            'breakdown': breakdown
        })
        
    except Exception as e:
        logger.error(f"Error calculating total crypto value: {str(e)}", exc_info=True)
        return Response({
            'success': False,
            'error': 'Failed to calculate total crypto value',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_sell_crypto(request):
    """
    API endpoint for selling cryptocurrency with email verification
    Creates PENDING transaction and sends verification code
    """
    try:
        # Get data from request
        cryptocurrency = request.data.get('cryptocurrency')
        amount = request.data.get('amount')
        wallet_address = request.data.get('wallet_address')
        
        if not all([cryptocurrency, amount, wallet_address]):
            return Response(
                {
                    'error': 'Missing required fields',
                    'message': 'Please provide cryptocurrency, amount, and wallet address.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate amount
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except (ValueError, DecimalException) as e:
            return Response(
                {
                    'error': 'Invalid amount',
                    'message': 'Please enter a valid positive amount.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get current price
        try:
            current_price = get_current_price(cryptocurrency)
            if not current_price:
                raise ValueError("Price not available")
        except Exception as e:
            logger.error(f"Error getting price for {cryptocurrency}: {str(e)}")
            return Response(
                {
                    'error': 'Price unavailable',
                    'message': f'Unable to get current price for {cryptocurrency}. Please try again.'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Calculate totals
        total_usd = amount * Decimal(str(current_price))
        network_fee = total_usd * Decimal('0.001')  # 0.1% network fee
        net_proceeds_usd = total_usd - network_fee
        
        # Convert to user's currency using CurrencyConversionService
        currency_service = CurrencyConversionService()
        try:
            net_proceeds_user_currency = currency_service.usd_to_user_currency(
                float(net_proceeds_usd),
                request.user.currency_type
            )
        except Exception as e:
            logger.error(f"Currency conversion error: {str(e)}")
            net_proceeds_user_currency = float(net_proceeds_usd)
        
        # Map crypto symbols to model field names
        crypto_field_map = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance',
        }
        crypto_field = crypto_field_map.get(cryptocurrency.upper())
        if not crypto_field:
            return Response(
                {
                    'error': 'Unsupported cryptocurrency',
                    'message': f'{cryptocurrency} is not supported.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user has sufficient cryptocurrency balance
        current_crypto_balance = getattr(request.user, crypto_field, Decimal('0'))
        if current_crypto_balance < amount:
            return Response(
                {
                    'error': 'Insufficient cryptocurrency balance',
                    'message': f'You need {amount:.8f} {cryptocurrency} but only have {current_crypto_balance:.8f} {cryptocurrency}.',
                    'required': float(amount),
                    'available': float(current_crypto_balance),
                    'cryptocurrency': cryptocurrency
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Get or create Cryptocurrency instance
            crypto_obj, created = Cryptocurrency.objects.get_or_create(
                symbol=cryptocurrency.upper(),
                defaults={
                    'name': cryptocurrency.upper(),
                    'get_cryptocurrency_display': cryptocurrency.upper()
                }
            )
            
            # Create PENDING sell transaction
            sell_transaction = Transaction.objects.create(
                user=request.user,
                transaction_type='SELL',
                cryptocurrency=crypto_obj,
                quantity=amount,
                price_per_unit=Decimal(str(current_price)),
                total_amount=total_usd,
                currency=request.user.currency_type,
                network_fee=network_fee,
                status='PENDING',
                wallet_address=wallet_address
            )
            
            # Generate and send verification code
            import random
            verification_code = str(random.randint(100000, 999999))
            
            # Save code to DB for later verification
            PasswordResetCode.objects.create(
                user=request.user,
                code=verification_code
            )
            
            # Send verification code email
            EmailService.send_verification_notification(request.user, verification_code)
            logger.info(f"Sell verification code sent to {request.user.email}")
            
            return Response(
                {
                    'success': True,
                    'message': 'Verification code sent to your email',
                    'verification_code': verification_code,  # For development/testing
                    'transaction': TransactionSerializer(sell_transaction).data,
                    'email': request.user.email,
                    'net_proceeds': float(net_proceeds_user_currency),
                    'network_fee': float(network_fee),
                    'currency': request.user.currency_type
                },
                status=status.HTTP_200_OK
            )
            
    except Exception as e:
        logger.error(f"Sell API error: {str(e)}", exc_info=True)
        return Response(
            {
                'error': 'Sell failed',
                'message': f'An error occurred while processing your sale: {str(e)}'
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        crypto_symbol = data.get('cryptocurrency', 'USDT')
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
        
        # Get the Cryptocurrency instance
        try:
            cryptocurrency = Cryptocurrency.objects.get(symbol=crypto_symbol)
        except Cryptocurrency.DoesNotExist:
            return Response(
                {'error': f'Cryptocurrency {crypto_symbol} not found'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check user balance
        # Map crypto symbols to correct balance field names
        balance_field_map = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance'
        }
        
        crypto_field = balance_field_map.get(crypto_symbol)
        if not crypto_field:
            return Response(
                {'error': f'Unsupported cryptocurrency: {crypto_symbol}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        current_balance = getattr(request.user, crypto_field)
        
        if current_balance < quantity:
            return Response(
                {'error': f'Insufficient {crypto_symbol} balance'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Create withdrawal transaction (pending until admin processes)
            withdrawal_transaction = Transaction.objects.create(
                user=request.user,
                transaction_type='WITHDRAWAL',
                cryptocurrency=cryptocurrency,  # Now passing the instance
                quantity=quantity,
                wallet_address=wallet_address,
                status='PENDING',
                currency=request.user.currency_type  # Add user's currency
            )
            
            # Reserve the funds by deducting immediately
            setattr(request.user, crypto_field, current_balance - quantity)
            request.user.save()
            
            # Send email notification for withdrawal pending
            try:
                EmailService.send_withdrawal_pending_email(request.user, withdrawal_transaction)
            except Exception as email_error:
                logger.warning(f"Failed to send withdrawal pending email: {email_error}")
            
            # Send WebSocket notification for withdrawal created
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f'withdrawals_{request.user.id}',
                        {
                            'type': 'withdrawal_status_update',
                            'withdrawal_id': str(withdrawal_transaction.id),
                            'status': 'PENDING',
                            'message': f'Withdrawal request for {quantity} {crypto_symbol} submitted successfully',
                            'timestamp': timezone.now().isoformat()
                        }
                    )
            except Exception as ws_error:
                logger.warning(f"Failed to send WebSocket notification: {ws_error}")
            
            return Response(
                {
                    'message': 'Withdrawal request submitted successfully. Please wait for processing.',
                    'transaction': TransactionSerializer(withdrawal_transaction).data
                },
                status=status.HTTP_201_CREATED
            )
            
    except Exception as e:
        logger.error(f"Withdrawal error: {str(e)}", exc_info=True)
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
def api_market_data(request):
    """
    API endpoint for market data (public endpoint, no authentication required)
    Used by JavaScript polling as fallback when WebSocket is unavailable
    """
    try:
        # Update cryptocurrency data from external API
        crypto_service.update_cryptocurrency_data()
        
        cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('symbol')
        serializer = CryptocurrencySerializer(cryptocurrencies, many=True)
        
        # Calculate market statistics
        total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies if crypto.market_cap)
        total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies if crypto.volume_24h)
        
        # Calculate BTC dominance
        btc_market_cap = 0
        btc_crypto = cryptocurrencies.filter(symbol='BTC').first()
        if btc_crypto and btc_crypto.market_cap:
            btc_market_cap = float(btc_crypto.market_cap)
        
        btc_dominance = (btc_market_cap / total_market_cap * 100) if total_market_cap > 0 else 0
        
        return Response({
            'success': True,
            'cryptocurrencies': serializer.data,
            'market_stats': {
                'active_cryptocurrencies': cryptocurrencies.count(),
                'total_market_cap': total_market_cap,
                'total_volume_24h': total_volume,
                'btc_dominance': btc_dominance,
                'timestamp': timezone.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f'Error in api_market_data: {str(e)}')
        return Response(
            {
                'success': False,
                'error': f'Failed to fetch market data: {str(e)}'
            },
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
    API endpoint for portfolio data with enhanced metrics
    """
    try:
        portfolio = Portfolio.objects.filter(user=request.user)
        
        # Build enhanced portfolio data with current prices
        portfolio_data = []
        total_invested = Decimal('0.0')
        current_value = Decimal('0.0')
        
        for item in portfolio:
            # Get current cryptocurrency price
            try:
                crypto = Cryptocurrency.objects.get(symbol=item.cryptocurrency)
                current_price = crypto.current_price
                price_change_24h = crypto.price_change_24h
                price_change_percentage_24h = crypto.price_change_percentage_24h
            except Cryptocurrency.DoesNotExist:
                current_price = item.average_buy_price
                price_change_24h = Decimal('0.0')
                price_change_percentage_24h = Decimal('0.0')
            
            # Calculate current value
            item_current_value = item.total_quantity * current_price
            item_profit_loss = item_current_value - item.total_invested
            item_profit_loss_percentage = (item_profit_loss / item.total_invested * 100) if item.total_invested > 0 else Decimal('0.0')
            
            portfolio_data.append({
                'cryptocurrency': item.cryptocurrency,
                'total_quantity': float(item.total_quantity),
                'average_buy_price': float(item.average_buy_price),
                'total_invested': float(item.total_invested),
                'current_price': float(current_price),
                'current_value': float(item_current_value),
                'profit_loss': float(item_profit_loss),
                'profit_loss_percentage': float(item_profit_loss_percentage),
                'price_change_24h': float(price_change_24h),
                'price_change_percentage_24h': float(price_change_percentage_24h)
            })
            
            total_invested += item.total_invested
            current_value += item_current_value
        
        total_profit_loss = current_value - total_invested
        total_profit_loss_percentage = (total_profit_loss / total_invested * 100) if total_invested > 0 else Decimal('0.0')
        
        return Response({
            'success': True,
            'portfolio': portfolio_data,
            'summary': {
                'total_invested': float(total_invested),
                'current_value': float(current_value),
                'total_profit_loss': float(total_profit_loss),
                'total_profit_loss_percentage': float(total_profit_loss_percentage)
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch portfolio data: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch portfolio data: {str(e)}'},
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
            try:
                crypto = Cryptocurrency.objects.get(symbol=item.cryptocurrency)
                current_price = crypto.current_price
            except Cryptocurrency.DoesNotExist:
                current_price = item.average_buy_price
                
            performance_data.append({
                'cryptocurrency': item.cryptocurrency,
                'quantity': float(item.total_quantity),
                'average_buy_price': float(item.average_buy_price),
                'current_price': float(current_price),
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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_portfolio_allocation(request):
    """
    API endpoint for portfolio allocation data
    """
    try:
        portfolio = Portfolio.objects.filter(user=request.user)
        
        # Calculate total value
        total_value = Decimal('0.0')
        allocation_data = []
        
        for item in portfolio:
            try:
                crypto = Cryptocurrency.objects.get(symbol=item.cryptocurrency)
                current_price = crypto.current_price
            except Cryptocurrency.DoesNotExist:
                current_price = item.average_buy_price
            
            current_value = item.total_quantity * current_price
            total_value += current_value
            
            allocation_data.append({
                'cryptocurrency': item.cryptocurrency,
                'value': float(current_value),
                'quantity': float(item.total_quantity)
            })
        
        # Calculate percentages
        for item in allocation_data:
            item['percentage'] = (item['value'] / float(total_value) * 100) if total_value > 0 else 0
        
        return Response({
            'success': True,
            'allocation': allocation_data,
            'total_value': float(total_value)
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch portfolio allocation: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch portfolio allocation: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_portfolio_history(request):
    """
    API endpoint for portfolio history data
    """
    try:
        from .models import PortfolioHistory
        from datetime import timedelta
        
        days = int(request.GET.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        
        # Get portfolio history
        history = PortfolioHistory.objects.filter(
            portfolio__user=request.user,
            timestamp__gte=start_date
        ).order_by('timestamp')
        
        # Group by portfolio and aggregate
        history_data = []
        for record in history:
            history_data.append({
                'timestamp': record.timestamp.isoformat(),
                'total_value': float(record.total_value)
            })
        
        # If no history, generate from current portfolio
        if not history_data:
            portfolio = Portfolio.objects.filter(user=request.user)
            total_value = sum(float(item.current_value) for item in portfolio)
            
            # Create sample history points
            for i in range(days):
                date = timezone.now() - timedelta(days=days-i)
                # Simulate historical value (90-100% of current value)
                historical_value = total_value * (0.9 + (i / days) * 0.1)
                history_data.append({
                    'timestamp': date.isoformat(),
                    'total_value': historical_value
                })
        
        return Response({
            'success': True,
            'history': history_data
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch portfolio history: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch portfolio history: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_portfolio_analytics(request):
    """
    API endpoint for portfolio analytics and AI insights
    """
    try:
        from .services.portfolio_service import portfolio_service
        
        # Calculate risk metrics for user
        risk_metrics = portfolio_service.calculate_risk_metrics(request.user)
        
        # Generate AI insights for user
        insights = portfolio_service.generate_ai_insights(request.user)
        
        return Response({
            'success': True,
            'risk_metrics': risk_metrics,
            'insights': insights
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch portfolio analytics: {str(e)}")
        
        # Return default analytics if service fails
        return Response({
            'success': True,
            'risk_metrics': {
                'risk_score': 50,
                'volatility': 0.15,
                'diversification_score': 60,
                'max_drawdown': 0,
                'sharpe_ratio': 0
            },
            'insights': [
                'Your portfolio data is being analyzed.',
                'Add more holdings to get personalized insights.',
                'Diversification helps reduce risk in volatile markets.'
            ]
        })

# ================================
# TRANSACTION HISTORY API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_transaction_history(request):
    """
    API endpoint for transaction history with search, filters, and pagination
    """
    logger.info(f"Transaction history API called by user: {request.user}")
    try:
        # Get filter parameters
        transaction_type = request.GET.get('type', '')
        status_filter = request.GET.get('status', '')
        crypto_filter = request.GET.get('crypto', '')
        search_query = request.GET.get('search', '')
        start_date = request.GET.get('start_date', '')
        end_date = request.GET.get('end_date', '')
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 25))
        
        # Base queryset
        transactions = Transaction.objects.filter(user=request.user).select_related('cryptocurrency')
        
        # Apply filters
        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)
        if status_filter:
            transactions = transactions.filter(status=status_filter)
        if crypto_filter:
            transactions = transactions.filter(cryptocurrency__symbol=crypto_filter)
            
        # Date range filter
        if start_date:
            from datetime import datetime
            start = datetime.strptime(start_date, '%Y-%m-%d')
            transactions = transactions.filter(created_at__gte=start)
        if end_date:
            from datetime import datetime
            end = datetime.strptime(end_date, '%Y-%m-%d')
            from datetime import timedelta
            end = end + timedelta(days=1)  # Include the entire end date
            transactions = transactions.filter(created_at__lt=end)
            
        # Search filter
        if search_query:
            from django.db.models import Q
            transactions = transactions.filter(
                Q(id__icontains=search_query) |
                Q(cryptocurrency__symbol__icontains=search_query) |
                Q(cryptocurrency__name__icontains=search_query) |
                Q(transaction_hash__icontains=search_query)
            )
        
        # Get total count before pagination
        total_count = transactions.count()
        
        # Calculate pagination
        total_pages = (total_count + per_page - 1) // per_page  # Ceiling division
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        
        # Apply pagination
        transactions = transactions.order_by('-created_at')[start_index:end_index]
        
        # Serialize transactions
        transactions_data = []
        for txn in transactions:
            crypto_symbol = txn.cryptocurrency.symbol if txn.cryptocurrency else 'N/A'
            crypto_name = txn.cryptocurrency.name if txn.cryptocurrency else 'N/A'
            
            transactions_data.append({
                'id': str(txn.id),
                'transaction_type': txn.transaction_type,
                'cryptocurrency': {
                    'symbol': crypto_symbol,
                    'name': crypto_name,
                },
                'quantity': str(txn.quantity) if txn.quantity else '0',
                'price_per_unit': str(txn.price_per_unit) if txn.price_per_unit else '0',
                'total_amount': str(txn.total_amount),
                'fiat_amount': str(txn.fiat_amount) if txn.fiat_amount else str(txn.total_amount),
                'currency': txn.currency,
                'status': txn.status,
                'transaction_hash': txn.transaction_hash or '',
                'wallet_address': txn.wallet_address or '',
                'network_fee': str(txn.network_fee),
                'platform_fee': str(txn.platform_fee),
                'created_at': txn.created_at.isoformat(),
                'updated_at': txn.updated_at.isoformat(),
                'completed_at': txn.completed_at.isoformat() if txn.completed_at else None,
            })
        
        # Calculate statistics
        all_transactions = Transaction.objects.filter(user=request.user)
        stats = {
            'total_transactions': all_transactions.count(),
            'completed': all_transactions.filter(status='COMPLETED').count(),
            'pending': all_transactions.filter(status='PENDING').count(),
            'failed': all_transactions.filter(status='FAILED').count(),
            'total_volume': sum(float(t.fiat_amount or t.total_amount) for t in all_transactions if t.status == 'COMPLETED'),
        }
        
        return Response({
            'success': True,
            'transactions': transactions_data,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_count': total_count,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1,
            },
            'statistics': stats,
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch transaction history: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch transaction history: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# ORDER HISTORY API ENDPOINT
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_order_history(request):
    """
    API endpoint for order history with search, filters, and pagination
    """
    try:
        # Get filter parameters
        order_type = request.GET.get('order_type', '')
        side_filter = request.GET.get('side', '')
        status_filter = request.GET.get('status', '')
        crypto_filter = request.GET.get('crypto', '')
        search_query = request.GET.get('search', '')
        start_date = request.GET.get('start_date', '')
        end_date = request.GET.get('end_date', '')
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 25))
        
        # Base queryset
        orders = Order.objects.filter(user=request.user)
        
        # Apply filters
        if order_type:
            orders = orders.filter(order_type=order_type)
        if side_filter:
            orders = orders.filter(side=side_filter)
        if status_filter:
            orders = orders.filter(status=status_filter)
        if crypto_filter:
            orders = orders.filter(cryptocurrency=crypto_filter)
            
        # Date range filter
        if start_date:
            from datetime import datetime
            start = datetime.strptime(start_date, '%Y-%m-%d')
            orders = orders.filter(created_at__gte=start)
        if end_date:
            from datetime import datetime
            end = datetime.strptime(end_date, '%Y-%m-%d')
            from datetime import timedelta
            end = end + timedelta(days=1)
            orders = orders.filter(created_at__lt=end)
            
        # Search filter
        if search_query:
            from django.db.models import Q
            orders = orders.filter(
                Q(id__icontains=search_query) |
                Q(cryptocurrency__icontains=search_query)
            )
        
        # Get total count before pagination
        total_count = orders.count()
        
        # Calculate pagination
        total_pages = (total_count + per_page - 1) // per_page
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        
        # Apply pagination
        orders = orders.order_by('-created_at')[start_index:end_index]
        
        # Serialize orders
        orders_data = []
        for order in orders:
            orders_data.append({
                'id': str(order.id),
                'order_type': order.order_type,
                'side': order.side,
                'cryptocurrency': order.cryptocurrency,
                'quantity': str(order.quantity),
                'price': str(order.price) if order.price else '0',
                'stop_price': str(order.stop_price) if order.stop_price else None,
                'filled_quantity': str(order.filled_quantity),
                'average_filled_price': str(order.average_filled_price),
                'status': order.status,
                'time_in_force': order.time_in_force,
                'created_at': order.created_at.isoformat(),
                'updated_at': order.updated_at.isoformat(),
                'filled_at': order.filled_at.isoformat() if order.filled_at else None,
                'expires_at': order.expires_at.isoformat() if order.expires_at else None,
            })
        
        return Response({
            'success': True,
            'orders': orders_data,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_count': total_count,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1,
            },
        })
        
    except Exception as e:
        logger.error(f"Failed to fetch order history: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch order history: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ================================
# CRYPTOCURRENCIES API ENDPOINT
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_cryptocurrencies(request):
    """
    API endpoint to get list of available cryptocurrencies
    """
    try:
        cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('name')
        crypto_data = []
        
        for crypto in cryptocurrencies:
            crypto_data.append({
                'id': crypto.id,
                'symbol': crypto.symbol,
                'name': crypto.name,
                'code': crypto.symbol,  # Alias for compatibility
            })
        
        return Response({
            'success': True,
            'cryptocurrencies': crypto_data
        })
    except Exception as e:
        logger.error(f"Failed to fetch cryptocurrencies: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to fetch cryptocurrencies: {str(e)}'},
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
    API endpoint for updating user profile including wallet addresses
    """
    try:
        user = request.user
        
        # Handle file uploads (profile_pic, id_document)
        if request.FILES:
            if 'profile_pic' in request.FILES:
                user.profile_pic = request.FILES['profile_pic']
            if 'id_document' in request.FILES:
                user.id_document = request.FILES['id_document']
                # If KYC document is uploaded, mark for verification
                if not user.is_verified:
                    # In a real app, this would trigger admin review
                    # For now, we'll just save the document
                    logger.info(f"KYC document uploaded for user {user.email}")
            user.save()
            return Response({
                'success': True,
                'message': 'File uploaded successfully'
            })
        
        # Handle JSON data
        if request.content_type == 'application/json':
            data = request.data
        else:
            data = request.POST.dict()
        
        # Update personal info fields
        personal_fields = ['first_name', 'last_name', 'phone_no', 'gender', 'address']
        for field in personal_fields:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        
        # Update wallet addresses
        wallet_fields = ['btc_wallet', 'ethereum_wallet', 'usdt_wallet', 'litecoin_wallet', 'tron_wallet']
        for field in wallet_fields:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        
        user.save()
        
        return Response({
            'success': True,
            'message': 'Profile updated successfully',
            'user': {
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone_no': user.phone_no,
                'gender': user.gender,
                'address': user.address,
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to update profile: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to update profile: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_change_password(request):
    """
    API endpoint for changing user password
    """
    try:
        user = request.user
        data = request.data
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return Response({
                'success': False,
                'error': 'Current password and new password are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify current password
        if not user.check_password(current_password):
            return Response({
                'success': False,
                'error': 'Current password is incorrect'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate new password strength
        if len(new_password) < 8:
            return Response({
                'success': False,
                'error': 'New password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Set new password
        user.set_password(new_password)
        user.save()
        
        logger.info(f"Password changed for user {user.email}")
        
        return Response({
            'success': True,
            'message': 'Password changed successfully'
        })
        
    except Exception as e:
        logger.error(f"Failed to change password: {str(e)}")
        return Response(
            {'success': False, 'error': f'Failed to change password: {str(e)}'},
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
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_recent_transactions(request):
    """
    API endpoint to get recent transactions for the authenticated user
    GET /api/transactions/recent/?type=DEPOSIT&limit=4
    
    Query params:
        - type: Transaction type filter (BUY, SELL, DEPOSIT, WITHDRAWAL, all) - defaults to 'all'
        - limit: Number of transactions to return - defaults to 10
    
    Returns:
        - transactions: List of recent transactions
    """
    try:
        user = request.user
        transaction_type = request.GET.get('type', 'all').upper()
        limit = int(request.GET.get('limit', 10))
        
        # Query transactions
        transactions = Transaction.objects.filter(user=user).order_by('-created_at')
        
        # Filter by type if specified
        if transaction_type in ['SELL', 'BUY', 'DEPOSIT', 'WITHDRAWAL']:
            transactions = transactions.filter(transaction_type=transaction_type)
        elif transaction_type != 'ALL':
            # Handle legacy 'all' keyword
            pass
        
        # Limit results
        transactions = transactions[:limit]
        
        # Serialize data
        transactions_data = []
        for txn in transactions:
            transactions_data.append({
                'id': str(txn.id),
                'cryptocurrency': txn.cryptocurrency.symbol if txn.cryptocurrency else None,
                'transaction_type': txn.transaction_type,
                'quantity': str(txn.quantity) if txn.quantity else '0',
                'amount': str(txn.fiat_amount) if txn.fiat_amount else str(txn.total_amount),
                'fiat_amount': str(txn.fiat_amount) if txn.fiat_amount else '0',
                'currency': txn.currency if txn.currency else 'USD',
                'status': txn.status,
                'created_at': txn.created_at.isoformat(),
                'wallet_address': txn.wallet_address,
            })
        
        return Response({
            'success': True,
            'transactions': transactions_data,
            'count': len(transactions_data)
        })
        
    except Exception as e:
        logger.error(f"Error fetching recent transactions: {e}")
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to fetch recent transactions'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ================================
# DEPOSIT SYSTEM API ENDPOINTS
# ================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_admin_wallets(request):
    """
    Get admin wallet addresses for crypto deposits
    GET /api/deposit/admin-wallets/
    
    Returns:
        - wallets: Dictionary of cryptocurrency wallet addresses
    """
    try:
        from .models import Admin_Wallet
        
        # Get the first (or only) admin wallet record
        admin_wallet = Admin_Wallet.objects.first()
        
        if not admin_wallet:
            return Response({
                'success': False,
                'error': 'Admin wallets not configured'
            }, status=status.HTTP_404_NOT_FOUND)
        
        wallets = {
            'BTC': admin_wallet.btc_wallet,
            'ETH': admin_wallet.ethereum_wallet,
            'USDT': admin_wallet.usdt_wallet,
            'LTC': admin_wallet.litecoin_wallet,
            'TRX': admin_wallet.tron_wallet,
        }
        
        return Response({
            'success': True,
            'wallets': wallets
        })
        
    except Exception as e:
        logger.error(f"Error fetching admin wallets: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_get_admin_banks(request):
    """
    Get admin bank accounts for fiat deposits
    GET /api/deposit/admin-banks/
    
    Optional Query Parameters:
        - currency: Filter by currency type (e.g., USD, EUR)
    
    Returns:
        - banks: List of bank account details
    """
    try:
        from .models import Admin_Bank
        
        currency_filter = request.GET.get('currency')
        
        if currency_filter:
            banks = Admin_Bank.objects.filter(currency_type=currency_filter.upper())
        else:
            banks = Admin_Bank.objects.all()
        
        banks_data = []
        for bank in banks:
            banks_data.append({
                'id': bank.id,
                'currency_type': bank.currency_type,
                'bank_name': bank.bank_name,
                'account_number': bank.account_number,
                'routing_number': bank.routing_number,
                'swift_code': bank.swift_code,
                'iban': bank.iban,
            })
        
        return Response({
            'success': True,
            'banks': banks_data
        })
        
    except Exception as e:
        logger.error(f"Error fetching admin banks: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_crypto_deposit(request):
    """
    Create a cryptocurrency deposit transaction
    POST /api/deposit/crypto/
    
    Payload:
        - cryptocurrency: Crypto symbol (BTC, ETH, USDT, LTC, TRX)
        - amount: Amount to deposit
    
    Returns:
        - transaction: Created transaction details
        - admin_wallet: Admin wallet address to send funds to
    """
    try:
        from .models import Admin_Wallet
        from .services.email_service import EmailService
        
        cryptocurrency = request.data.get('cryptocurrency', '').upper()
        amount = request.data.get('amount')
        
        # Validate inputs
        if not cryptocurrency or cryptocurrency not in ['BTC', 'ETH', 'USDT', 'LTC', 'TRX']:
            return Response({
                'success': False,
                'error': 'Invalid cryptocurrency. Must be BTC, ETH, USDT, LTC, or TRX.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except (ValueError, InvalidOperation, TypeError):
            return Response({
                'success': False,
                'error': 'Invalid amount. Must be a positive number.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Minimum deposit thresholds
        min_deposits = {
            'BTC': Decimal('0.0001'),
            'ETH': Decimal('0.001'),
            'USDT': Decimal('10'),
            'LTC': Decimal('0.01'),
            'TRX': Decimal('100'),
        }
        
        if amount < min_deposits.get(cryptocurrency, Decimal('0')):
            return Response({
                'success': False,
                'error': f'Minimum deposit for {cryptocurrency} is {min_deposits[cryptocurrency]}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get admin wallet
        admin_wallet = Admin_Wallet.objects.first()
        if not admin_wallet:
            return Response({
                'success': False,
                'error': 'Admin wallet not configured. Please contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Get wallet address for the cryptocurrency
        wallet_field_map = {
            'BTC': admin_wallet.btc_wallet,
            'ETH': admin_wallet.ethereum_wallet,
            'USDT': admin_wallet.usdt_wallet,
            'LTC': admin_wallet.litecoin_wallet,
            'TRX': admin_wallet.tron_wallet,
        }
        
        admin_wallet_address = wallet_field_map.get(cryptocurrency)
        if not admin_wallet_address:
            return Response({
                'success': False,
                'error': f'Admin {cryptocurrency} wallet not configured'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Get current crypto price for fiat conversion
        try:
            crypto_obj = Cryptocurrency.objects.get(symbol=cryptocurrency)
            current_price = crypto_obj.current_price
            fiat_equivalent = amount * current_price
        except Cryptocurrency.DoesNotExist:
            return Response({
                'success': False,
                'error': f'{cryptocurrency} not found in system. Please contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Create pending deposit transaction
        with transaction.atomic():
            deposit_txn = Transaction.objects.create(
                user=request.user,
                transaction_type='DEPOSIT',
                cryptocurrency=crypto_obj,  # Use the Cryptocurrency instance, not the symbol string
                quantity=amount,
                price_per_unit=current_price,
                total_amount=amount,
                fiat_amount=fiat_equivalent,
                currency=request.user.currency_type,
                status='PENDING',
                wallet_address=admin_wallet_address,
            )
            
            # Send deposit pending email
            try:
                logger.info(f"Attempting to send deposit pending email to {request.user.email}")
                email_sent = EmailService.send_deposit_pending_email(
                    user=request.user,
                    transaction=deposit_txn,
                    admin_wallet_address=admin_wallet_address
                )
                if email_sent:
                    logger.info(f"Deposit pending email sent successfully to {request.user.email}")
                else:
                    logger.warning(f"Deposit pending email failed to send to {request.user.email}")
            except Exception as email_error:
                logger.error(f"Failed to send deposit pending email to {request.user.email}: {email_error}", exc_info=True)
            
            return Response({
                'success': True,
                'message': 'Deposit request created successfully! A confirmation email has been sent to your registered email address.',
                'transaction': {
                    'id': str(deposit_txn.id),
                    'cryptocurrency': cryptocurrency,
                    'amount': str(amount),
                    'fiat_equivalent': str(fiat_equivalent),
                    'currency': request.user.currency_type,
                    'status': 'PENDING',
                    'created_at': deposit_txn.created_at.isoformat(),
                },
                'admin_wallet_address': admin_wallet_address,
                'instructions': f'Please send exactly {amount} {cryptocurrency} to the wallet address above. Your deposit will be credited after confirmation.'
            }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating crypto deposit: {e}")
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to create deposit transaction'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_create_bank_deposit(request):
    """
    Create a bank deposit transaction
    POST /api/deposit/bank/
    
    Payload:
        - amount: Amount to deposit
        - bank_id: Admin bank account ID
    
    Returns:
        - transaction: Created transaction details
        - bank_details: Bank account information
    """
    try:
        from .models import Admin_Bank
        from .services.currency_service import currency_service
        from .services.email_service import EmailService
        
        amount = request.data.get('amount')
        bank_id = request.data.get('bank_id')
        
        # Validate amount
        try:
            amount = Decimal(str(amount))
            if amount <= 0:
                raise ValueError("Amount must be positive")
        except (ValueError, InvalidOperation, TypeError):
            return Response({
                'success': False,
                'error': 'Invalid amount. Must be a positive number.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Minimum deposit
        if amount < Decimal('10'):
            return Response({
                'success': False,
                'error': 'Minimum bank deposit is $10 (or equivalent)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get admin bank
        try:
            admin_bank = Admin_Bank.objects.get(id=bank_id)
        except Admin_Bank.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Invalid bank account selected'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Convert amount from admin bank currency to user currency
        user_currency = request.user.currency_type
        bank_currency = admin_bank.currency_type
        
        if user_currency != bank_currency:
            # Convert amount from user currency to bank currency
            amount_in_bank_currency = currency_service.convert_amount(
                amount, user_currency, bank_currency
            )
        else:
            amount_in_bank_currency = amount
        
        # Create pending deposit transaction
        with transaction.atomic():
            deposit_txn = Transaction.objects.create(
                user=request.user,
                transaction_type='DEPOSIT',
                cryptocurrency=None,  # Bank deposit
                quantity=None,
                fiat_amount=amount,
                currency=user_currency,
                status='PENDING',
                wallet_address=f"Bank: {admin_bank.bank_name} - {admin_bank.account_number}",
            )
            
            # Send deposit pending email
            try:
                EmailService.send_bank_deposit_pending_email(
                    user=request.user,
                    transaction=deposit_txn,
                    admin_bank=admin_bank,
                    amount_in_bank_currency=amount_in_bank_currency
                )
            except Exception as email_error:
                logger.error(f"Failed to send bank deposit pending email: {email_error}")
            
            return Response({
                'success': True,
                'message': 'Bank deposit request created. Please transfer funds to the provided bank account.',
                'transaction': {
                    'id': str(deposit_txn.id),
                    'amount': str(amount),
                    'currency': user_currency,
                    'amount_in_bank_currency': str(amount_in_bank_currency),
                    'bank_currency': bank_currency,
                    'status': 'PENDING',
                    'created_at': deposit_txn.created_at.isoformat(),
                },
                'bank_details': {
                    'bank_name': admin_bank.bank_name,
                    'account_number': admin_bank.account_number,
                    'routing_number': admin_bank.routing_number,
                    'swift_code': admin_bank.swift_code,
                    'iban': admin_bank.iban,
                    'currency': bank_currency,
                },
                'instructions': f'Please transfer {amount_in_bank_currency} {bank_currency} to the bank account above. Include your username ({request.user.username}) as the reference.'
            }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error creating bank deposit: {e}")
        return Response({
            'success': False,
            'error': str(e),
            'message': 'Failed to create deposit transaction'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
