from venv import logger
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.db.models import Sum, Q
from decimal import Decimal
import logging
from .models import CustomUser, Transaction, Order, Portfolio, Cryptocurrency

# ================================
# DASHBOARD & PROFILE VIEWS
# ================================

@login_required
def dashboard(request):
    """
    Enhanced main user dashboard with real-time cryptocurrency data
    """
    user = request.user
    
    # Update cryptocurrency data from API (in background - you might want to use Celery for this)
    try:
        from .services.crypto_api_service import crypto_service
        crypto_service.update_cryptocurrency_data()
    except Exception as e:
        logger.error(f"Failed to update crypto data: {e}")
    
    # Get user portfolio summary
    portfolio_items = Portfolio.objects.filter(user=user)
    total_portfolio_value = user.get_total_portfolio_value()
    
    # Calculate portfolio performance
    total_invested = sum(float(item.total_invested) for item in portfolio_items)
    total_profit_loss = total_portfolio_value - total_invested
    total_profit_loss_percentage = (total_profit_loss / total_invested * 100) if total_invested > 0 else 0
    
    # Get portfolio distribution for the grid
    portfolio_distribution = user.get_portfolio_distribution()
    
    # Get recent transactions
    recent_transactions = Transaction.objects.filter(user=user).order_by('-created_at')[:5]
    
    # Get open orders
    open_orders = Order.objects.filter(user=user, status='OPEN').order_by('-created_at')[:5]
    
    # Get top cryptocurrencies for charts and trading
    top_cryptos = Cryptocurrency.objects.filter(is_active=True).order_by('rank')[:6]
    
    # Get user's crypto balances for quick display with current prices
    crypto_balances = {}
    for symbol in ['BTC', 'ETH', 'USDT', 'LTC', 'TRX']:
        try:
            crypto = Cryptocurrency.objects.get(symbol=symbol)
            
            # Use the correct field names from your model
            if symbol == 'BTC':
                balance = user.btc_balance
            elif symbol == 'ETH':
                balance = user.ethereum_balance  # Correct field name
            elif symbol == 'USDT':
                balance = user.usdt_balance
            elif symbol == 'LTC':
                balance = user.litecoin_balance
            elif symbol == 'TRX':
                balance = user.tron_balance
            else:
                balance = Decimal('0.0')
                
            crypto_balances[symbol] = {
                'balance': balance,
                'current_price': crypto.current_price,
                'value': float(balance) * float(crypto.current_price),
                'change_24h': crypto.price_change_percentage_24h
            }
        except Cryptocurrency.DoesNotExist:
            # Fallback using the same logic for balance retrieval
            if symbol == 'BTC':
                balance = user.btc_balance
            elif symbol == 'ETH':
                balance = user.ethereum_balance
            elif symbol == 'USDT':
                balance = user.usdt_balance
            elif symbol == 'LTC':
                balance = user.litecoin_balance
            elif symbol == 'TRX':
                balance = user.tron_balance
            else:
                balance = Decimal('0.0')
                
            crypto_balances[symbol] = {
                'balance': balance,
                'current_price': 0,
                'value': 0,
                'change_24h': 0
            }
    
    # Get current prices for the crypto grid display
    current_prices = {}
    for crypto in top_cryptos:
        current_prices[crypto.symbol] = {
            'price': crypto.current_price,
            'change_24h': crypto.price_change_24h,
            'change_percentage_24h': crypto.price_change_percentage_24h
        }
    
    context = {
        'user': user,
        'portfolio': portfolio_items,
        'portfolio_distribution': portfolio_distribution,
        'total_portfolio_value': total_portfolio_value,
        'total_invested': total_invested,
        'total_profit_loss': total_profit_loss,
        'total_profit_loss_percentage': total_profit_loss_percentage,
        'recent_transactions': recent_transactions,
        'open_orders': open_orders,
        'cryptocurrencies': top_cryptos,
        'top_cryptos': top_cryptos,
        'crypto_balances': crypto_balances,
        'current_prices': current_prices,
        'websocket_url': 'ws://' + request.get_host() + '/ws/prices/'
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
def trading_dashboard(request):
    """
    Trading interface dashboard
    """
    context = {
        'user': request.user,
        'cryptocurrencies': Cryptocurrency.objects.filter(is_active=True),
    }
    return render(request, 'jobs/admin_templates/trading.html', context)

@login_required
def buy_crypto_view(request):
    """
    Buy cryptocurrency page
    """
    context = {
        'user': request.user,
        'cryptocurrencies': Cryptocurrency.objects.filter(is_active=True),
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
    Market data and prices page
    """
    cryptocurrencies = Cryptocurrency.objects.filter(is_active=True).order_by('rank')
    
    # Calculate market statistics
    total_market_cap = sum(float(crypto.market_cap) for crypto in cryptocurrencies)
    total_volume = sum(float(crypto.volume_24h) for crypto in cryptocurrencies)
    
    context = {
        'user': request.user,
        'cryptocurrencies': cryptocurrencies,
        'total_market_cap': total_market_cap,
        'total_volume': total_volume,
    }
    return render(request, 'jobs/admin_templates/market_data.html', context)

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
    Transaction history page
    """
    transactions = Transaction.objects.filter(user=request.user).order_by('-created_at')
    
    # Filter options
    transaction_type = request.GET.get('type', '')
    status_filter = request.GET.get('status', '')
    
    if transaction_type:
        transactions = transactions.filter(transaction_type=transaction_type)
    if status_filter:
        transactions = transactions.filter(status=status_filter)
    
    context = {
        'user': request.user,
        'transactions': transactions,
        'filters': {
            'type': transaction_type,
            'status': status_filter,
        }
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
    context = {
        'user': request.user,
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