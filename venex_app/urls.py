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
    # Dashboard & User Area URLs
    ###########################################
    path('dashboard/', views.dashboard, name='dashboard'),
]

# Error handlers
handler404 = 'venex_app.views.handler404'
handler500 = 'venex_app.views.handler500'