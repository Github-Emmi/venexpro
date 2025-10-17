from django.urls import path
from . import views


urlpatterns = [
    ###########################################
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
    # Contact & Communication URLs
    ###########################################
    path('contact/', views.contact, name='contact'),

    ###########################################
    # Password Reset URLs
    ###########################################
    path('password-reset/', views.password_reset_request, name='password_reset_request'),
    path('password-reset/verify/', views.password_reset_verify, name='password_reset_verify'),
    path('password-reset/confirm/', views.password_reset_confirm, name='password_reset_confirm'),
    path('password-reset/resend-code/', views.password_reset_resend_code, name='password_reset_resend_code'),

    ###########################################
    # AJAX URLs
    ###########################################
    path('ajax/get-states/', views.get_states, name='get_states'),
    
    ###########################################
    # Dashboard & User Area URLs
    ###########################################
    path('dashboard/', views.dashboard, name='dashboard'),
]

# Error handlers
handler404 = 'venex_app.views.handler404'
handler500 = 'venex_app.views.handler500'