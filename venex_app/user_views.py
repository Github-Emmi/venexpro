# venex_app/user_views.py
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Sum, Q
from decimal import Decimal
import logging
from django.utils import timezone
from .models import CustomUser, Transaction, Order, Portfolio, Cryptocurrency
from .services.dashboard_service import DashboardService
from .services.crypto_api_service import crypto_service

logger = logging.getLogger(__name__)

# ================================
# DASHBOARD & PROFILE VIEWS
# ================================

@login_required
def dashboard(request):
    """
    Enhanced main user dashboard with real-time cryptocurrency data
    """
    user = request.user
    
    # Initialize latest_crypto
    latest_crypto = None
    
    try:
        # Update cryptocurrency data if it's stale (older than 5 minutes)
        latest_crypto = Cryptocurrency.objects.order_by('-last_updated').first()
        if not latest_crypto or (timezone.now() - latest_crypto.last_updated).total_seconds() > 300:
            crypto_service.update_cryptocurrency_data()
            logger.info("Cryptocurrency data updated successfully")
            latest_crypto = Cryptocurrency.objects.order_by('-last_updated').first()
    except Exception as e:
        logger.error(f"Failed to update crypto data: {e}")
    
    # Get portfolio data from service
    portfolio_data = DashboardService.get_user_portfolio_value(user)
    
    # Get recent transactions
    recent_transactions = Transaction.objects.filter(
        user=user
    ).select_related('cryptocurrency').order_by('-created_at')[:10]
    
    # Get open orders
    open_orders = Order.objects.filter(
        user=user, 
        status='OPEN'
    ).order_by('-created_at')[:5]
    
    # Get cryptocurrencies for chart dropdown
    cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('rank')[:10]
    
    # Get current market prices for all supported cryptocurrencies
    current_prices = {}
    for crypto in cryptocurrencies:
        current_prices[crypto.symbol] = {
            'price': crypto.current_price,
            'change_24h': crypto.price_change_24h,
            'change_percentage_24h': crypto.price_change_percentage_24h,
            'market_cap': crypto.market_cap,
            'volume_24h': crypto.volume_24h
        }
    
    # Get user's crypto balances with current values
    crypto_balances = {}
    for symbol in ['BTC', 'ETH', 'USDT', 'LTC', 'TRX']:
        try:
            crypto = Cryptocurrency.objects.get(symbol=symbol)
            balance = user.get_crypto_balance(symbol)
            current_value = balance * crypto.current_price
            
            crypto_balances[symbol] = {
                'balance': balance,
                'current_price': crypto.current_price,
                'value': current_value,
                'change_24h': crypto.price_change_24h,
                'change_percentage_24h': crypto.price_change_percentage_24h
            }
        except Cryptocurrency.DoesNotExist:
            crypto_balances[symbol] = {
                'balance': Decimal('0.0'),
                'current_price': Decimal('0.0'),
                'value': Decimal('0.0'),
                'change_24h': Decimal('0.0'),
                'change_percentage_24h': Decimal('0.0')
            }
    
    # Prepare context with new service data
    context = {
        'user': user,
        'total_balance': portfolio_data['total_balance'],
        'total_profit_loss': portfolio_data['total_profit_loss'],
        'total_profit_loss_pct': portfolio_data['total_profit_loss_pct'],
        'portfolio_details': portfolio_data['portfolio_details'],
        'recent_transactions': recent_transactions,
        'open_orders': open_orders,
        'cryptocurrencies': cryptocurrencies,
        'current_prices': current_prices,
        'crypto_balances': crypto_balances,
        'chart_choices': cryptocurrencies,
        'market_overview': {
            'active_cryptocurrencies': Cryptocurrency.objects.filter(is_active=True).count(),
            'total_market_cap': sum(crypto.market_cap for crypto in cryptocurrencies if crypto.market_cap),
            'total_volume_24h': sum(crypto.volume_24h for crypto in cryptocurrencies if crypto.volume_24h),
            'btc_dominance': 0,  # This would need to be calculated from market cap ratios
            'last_updated': latest_crypto.last_updated if latest_crypto else timezone.now()
        }
    }
    
    return render(request, 'jobs/admin_templates/dashboard.html', context)

@login_required
def user_profile_view(request):
    """
    User profile management page
    """
    context = {
        'user': request.user,
    }
    return render(request, 'jobs/admin_templates/profile.html', context)

# ================================
# TRADING INTERFACE VIEWS
# ================================

@login_required
def buy_crypto_view(request):
    """
    Buy cryptocurrency page
    """
    # Get recent 4 buy transactions for this user
    recent_buy_transactions = Transaction.objects.filter(
        user=request.user,
        transaction_type='BUY'
    ).order_by('-created_at')[:4]
    
    context = {
        'user': request.user,
        'cryptocurrencies': Cryptocurrency.objects.filter(is_active=True),
        'currency_balance': request.user.currency_balance,  # Use currency_balance instead
        'recent_buy_transactions': recent_buy_transactions,
    }
    return render(request, 'jobs/admin_templates/buy.html', context)

@login_required
def sell_crypto_view(request):
    """
    Sell cryptocurrency page
    """
    context = {
        'user': request.user,
        'portfolio': Portfolio.objects.filter(user=request.user),
    }
    return render(request, 'jobs/admin_templates/sell.html', context)

@login_required
def deposit_funds_view(request):
    """
    Deposit funds page
    """
    context = {
        'user': request.user,
    }
    return render(request, 'jobs/admin_templates/deposit.html', context)

@login_required
def withdraw_funds_view(request):
    """
    Withdraw funds page
    """
    context = {
        'user': request.user,
    }
    return render(request, 'jobs/admin_templates/withdraw.html', context)

@login_required
def orders_view(request):
    """
    User orders management page
    """
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    
    context = {
        'user': request.user,
        'orders': orders,
        'open_orders': orders.filter(status='OPEN'),
        'filled_orders': orders.filter(status='FILLED'),
    }
    return render(request, 'jobs/admin_templates/orders.html', context)

# ================================
# MARKET DATA & PORTFOLIO VIEWS
# ================================

@login_required
def market_data_view(request):
    """
    Enhanced market data and prices page with real-time updates
    """
    try:
        # Get all active cryptocurrencies
        cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('rank')
        
        # Calculate market statistics
        total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies if crypto.market_cap)
        total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies if crypto.volume_24h)
        
        # Calculate Bitcoin dominance
        btc = cryptocurrencies.filter(symbol='BTC').first()
        btc_dominance = (float(btc.market_cap) / total_market_cap * 100) if btc and btc.market_cap and total_market_cap > 0 else 0
        
        # Get top gainers and losers
        top_gainers = cryptocurrencies.filter(price_change_percentage_24h__gt=0).order_by('-price_change_percentage_24h')[:5]
        top_losers = cryptocurrencies.filter(price_change_percentage_24h__lt=0).order_by('price_change_percentage_24h')[:5]
        
        # Prepare market stats matching market.js expectations
        market_stats = {
            'total_market_cap': float(total_market_cap),  # Ensure float for JS
            'total_volume_24h': float(total_volume),  # Ensure float for JS
            'btc_dominance': float(round(btc_dominance, 2)),  # Ensure float for JS
            'active_cryptocurrencies': cryptocurrencies.count(),
            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Prepare cryptocurrency data for JSON serialization
        crypto_list = [{
            'symbol': crypto.symbol,
            'name': crypto.name,
            'rank': crypto.rank,
            'current_price': float(crypto.current_price),
            'price_change_percentage_24h': float(crypto.price_change_percentage_24h) if crypto.price_change_percentage_24h else 0,
            'market_cap': float(crypto.market_cap) if crypto.market_cap else 0,
            'volume_24h': float(crypto.volume_24h) if crypto.volume_24h else 0
        } for crypto in cryptocurrencies]

        # Convert data to JSON strings for template
        from django.core.serializers.json import DjangoJSONEncoder
        import json
        
        context = {
            'cryptocurrencies': json.dumps(crypto_list, cls=DjangoJSONEncoder),
            'market_stats': json.dumps(market_stats, cls=DjangoJSONEncoder),
            'top_gainers': top_gainers,
            'top_losers': top_losers,
            'current_prices': json.dumps({
                crypto.symbol: {'price': float(crypto.current_price)} 
                for crypto in cryptocurrencies
            }, cls=DjangoJSONEncoder),
        }
        
        return render(request, 'jobs/admin_templates/market.html', context)
        
    except Exception as e:
        logger.error(f"Error in market_data_view: {str(e)}")
        messages.error(request, 'Failed to load market data. Please try again.')
        return render(request, 'jobs/admin_templates/market.html', {
            'cryptocurrencies': [],
            'market_stats': {},
            'top_gainers': [],
            'top_losers': [],
            'current_prices': {}
        })

@login_required
def portfolio_view(request):
    """
    User portfolio page
    """
    user_portfolio = Portfolio.objects.filter(user=request.user)
    
    # Calculate portfolio statistics
    total_invested = sum(float(item.total_invested) for item in user_portfolio)
    total_current_value = sum(float(item.current_value) for item in user_portfolio)
    total_profit_loss = total_current_value - total_invested
    total_profit_loss_percentage = (total_profit_loss / total_invested * 100) if total_invested > 0 else 0
    
    context = {
        'user': request.user,
        'portfolio': user_portfolio,
        'total_invested': total_invested,
        'total_current_value': total_current_value,
        'total_profit_loss': total_profit_loss,
        'total_profit_loss_percentage': total_profit_loss_percentage,
    }
    return render(request, 'jobs/admin_templates/portfolio.html', context)

@login_required
def transaction_history_view(request):
    """
    Transaction history page with statistics and initial data
    """
    # Get user's transactions for statistics
    all_transactions = Transaction.objects.filter(user=request.user)
    all_orders = Order.objects.filter(user=request.user)
    
    # Calculate statistics
    completed_transactions = all_transactions.filter(status='COMPLETED')
    total_volume = sum(
        float(txn.fiat_amount or txn.total_amount) 
        for txn in completed_transactions
    )
    
    statistics = {
        'total_transactions': all_transactions.count(),
        'completed': completed_transactions.count(),
        'pending': all_transactions.filter(status='PENDING').count(),
        'failed': all_transactions.filter(status='FAILED').count(),
        'total_volume': total_volume,
        'total_orders': all_orders.count(),
        'open_orders': all_orders.filter(status='OPEN').count(),
    }
    
    # Get available cryptocurrencies for filter
    from .models import Cryptocurrency
    cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('rank')
    
    context = {
        'user': request.user,
        'statistics': statistics,
        'cryptocurrencies': cryptocurrencies,
        'transaction_types': ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL'],
        'statuses': ['COMPLETED', 'PENDING', 'FAILED', 'CANCELLED'],
    }
    return render(request, 'jobs/admin_templates/transaction_history.html', context)

# ================================
# WALLET MANAGEMENT VIEWS
# ================================

@login_required
def wallet_management_view(request):
    """
    Wallet addresses management page
    """
    # Get user's portfolio value for display
    portfolio_data = DashboardService.get_user_portfolio_value(request.user)
    
    context = {
        'user': request.user,
        'currency_balance': request.user.currency_balance,
        'total_portfolio_value': portfolio_data['total_balance'],
    }
    return render(request, 'jobs/admin_templates/wallet.html', context)

@login_required
def security_settings_view(request):
    """
    Security settings page
    """
    context = {
        'user': request.user,
    }
    return render(request, 'jobs/admin_templates/security.html', context)