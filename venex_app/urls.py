from django.urls import path, include
from . import views
from . import user_views
from . import api_views
from . import consumers

urlpatterns = [
    ###########################################
    # Buy Code Verification API
    path('api/trading/verify-buy-code/', api_views.api_verify_buy_code, name='api_verify_buy_code'),
    path('api/trading/verify-sell-code/', api_views.api_verify_sell_code, name='api_verify_sell_code'),
    # Landing Page URLs
    ###########################################
    path('', views.index, name='index'),
    path('about/', views.about, name='about'),
    path('started/', views.started, name='started'),
    path('faq/', views.faq, name='faq'),
    path('affiliate/', views.affiliate, name='affiliate'),
    path('terms-and-conditions/', views.terms, name='terms'),
    
    ###########################################
    # Authentication URLs
    ###########################################
    path('login/', views.user_login, name='login'),
    path('logout/', views.user_logout, name='logout'),
    path('signup/', views.signup, name='signup'),
    
    ###########################################
    # Password Reset URLs
    ###########################################
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset/verify/', views.password_reset_verify, name='password_reset_verify'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),
    path('password-reset/resend-code/', views.password_reset_resend_code, name='password_reset_resend_code'),
    
    ###########################################
    # Contact & Communication URLs
    ###########################################
    path('contact/', views.contact, name='contact'),

    ###########################################
    # AJAX URLs
    ###########################################
    path('ajax/get-states/', views.get_states, name='get_states'),
    
    ###########################################
    # DASHBOARD & USER AREA URLs (HTML Views)
    ###########################################
    # User Dashboard URLs
    path('dashboard/', user_views.dashboard, name='dashboard'),
    path('profile/', user_views.user_profile_view, name='profile'),
    path('deposit/', user_views.deposit_funds_view, name='deposit'),
    path('withdraw/', user_views.withdraw_funds_view, name='withdraw'),
    path('wallet/', user_views.wallet_management_view, name='wallet'),
    path('security/', user_views.security_settings_view, name='security'),
    
    ###########################################
    # TRADING INTERFACE URLs (HTML Views)
    ###########################################
    # User Trading URLs
    path('trading/buy/', user_views.buy_crypto_view, name='buy'),
    path('trading/sell/', user_views.sell_crypto_view, name='sell'),
    path('trading/deposit/', user_views.deposit_funds_view, name='deposit_funds'),
    path('trading/withdraw/', user_views.withdraw_funds_view, name='withdraw_funds'),
    path('trading/orders/', user_views.orders_view, name='orders_view'),
    
    ###########################################
    # MARKET & PORTFOLIO URLs (HTML Views)
    ###########################################
    # User Market & Portfolio URLs
    path('markets/', user_views.market_data_view, name='market_data'),
    path('portfolio/', user_views.portfolio_view, name='portfolio'),
    path('history/', user_views.transaction_history_view, name='transaction_history_view'),
    
    ###########################################
    # API ENDPOINTS - Dash Board Features
    ###########################################
    # API URLs for Dashboard Data
    path('api/market/chart/<str:symbol>/', api_views.market_prices_history, name='market_prices_history'),
    path('api/trade/quick/', api_views.quick_trade, name='quick_trade'),
    path('api/orders/open/', api_views.open_orders, name='open_orders'),
    path('api/dashboard/', api_views.dashboard_data, name='dashboard_data'),
    path('api/orders/<uuid:order_id>/cancel/', api_views.cancel_order, name='cancel_order'),
    path('api/portfolio/overview/', api_views.portfolio_overview, name='portfolio_overview'),

    ###########################################
    # API ENDPOINTS - TRADING OPERATIONS
    ###########################################
    path('api/data/crypto/prices/', api_views.get_multiple_prices, name='get_multiple_prices'),
    path('api/data/crypto/<str:symbol>/', api_views.get_crypto_price_data, name='get_crypto_price_data'),
    path('api/data/crypto/<str:symbol>/historical/', api_views.get_historical_data, name='get_historical_data'),

    ###########################################
    # API ENDPOINTS - Real-Time Data endpoints
    ###########################################
    path('api/trading/buy/', api_views.api_buy_crypto, name='api_buy_crypto'),
    path('api/trading/sell/', api_views.api_sell_crypto, name='api_sell_crypto'),
    path('api/trading/deposit/', api_views.api_deposit_funds, name='api_deposit_funds'),
    path('api/trading/withdraw/', api_views.api_withdraw_funds, name='api_withdraw_funds'),
    
    ###########################################
    # API ENDPOINTS - Currency Conversion
    ###########################################
    path('api/exchange-rate/', api_views.api_get_exchange_rate, name='api_get_exchange_rate'),
    path('api/convert-currency/', api_views.api_convert_currency, name='api_convert_currency'),
    
    ###########################################
    # API ENDPOINTS - Transactions
    ###########################################
    path('api/transactions/recent/', api_views.api_recent_transactions, name='api_recent_transactions'),
    
    # API URLs
    path('api/v1/', include([
        path('prices/<str:symbol>/', api_views.get_crypto_price_data, name='api_crypto_price'),
        path('prices/historical/<str:symbol>/', api_views.get_historical_data, name='api_historical_data'),
        path('prices/multiple/', api_views.get_multiple_prices, name='api_multiple_prices'),
        # path('trade/quick/', api_views.quick_trade, name='api_quick_trade'),
    ])),
    
    ###########################################
    # API ENDPOINTS - ORDER MANAGEMENT
    ###########################################
    path('api/trading/orders/create/', api_views.api_create_order, name='api_create_order'),
    path('api/trading/orders/<uuid:order_id>/cancel/', api_views.api_cancel_order, name='api_cancel_order'),
    path('api/trading/orders/', api_views.api_get_orders, name='api_get_orders'),
    
    ###########################################
    # API ENDPOINTS - MARKET DATA
    ###########################################
    path('api/market/data/', api_views.api_market_data, name='api_market_data'),
    path('api/market/crypto/<str:symbol>/', api_views.api_get_crypto_detail, name='api_get_crypto_detail'),
    # WebSocket URL (add to your existing WebSocket patterns)
    
    ###########################################
    # API ENDPOINTS - PORTFOLIO
    ###########################################
    path('api/portfolio/data/', api_views.api_portfolio_data, name='api_portfolio_data'),
    path('api/portfolio/performance/', api_views.api_portfolio_performance, name='api_portfolio_performance'),
    
    ###########################################
    # API ENDPOINTS - TRANSACTIONS
    ###########################################
    path('api/transactions/history/', api_views.api_transaction_history, name='api_transaction_history'),
    
    ###########################################
    # API ENDPOINTS - USER PROFILE
    ###########################################
    path('api/user/profile/', api_views.api_user_profile, name='api_user_profile'),
    path('api/user/profile/update/', api_views.api_update_profile, name='api_update_profile'),
]

# Error handlers
handler404 = 'venex_app.views.handler404'
handler500 = 'venex_app.views.handler500'