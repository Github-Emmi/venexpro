from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse
from .forms import SignUpForm
from .models import State
from .services.email_service import EmailService
import logging
import json

# Setup logger
logger = logging.getLogger(__name__)

###########################################################
# Landing Page Views
###########################################################

def index(request):
    """Home page view"""
    return render(request, 'jobs/index.html', {})

def about(request):
    """About page view"""
    return render(request, 'about.html', {})

def started(request):
    """Getting started page view"""
    return render(request, 'started.html', {})

def faq(request):
    """FAQ page view"""
    return render(request, 'faq.html', {})

def affiliate(request):
    """Affiliate program page view"""
    return render(request, 'affiliate.html', {})

def terms(request):
    """Terms and conditions page view"""
    return render(request, 'terms.html', {})

###########################################################
# Authentication Views
###########################################################

@require_http_methods(["GET", "POST"])
@csrf_protect
def user_login(request):
    """
    Handle user login with proper validation and error handling
    """
    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')
        remember_me = request.POST.get('remember')
        
        # Validate required fields
        if not email or not password:
            messages.error(request, "Please provide both email and password.")
            return render(request, 'jobs/login.html')
        
        try:
            # Authenticate user
            user = authenticate(request, email=email, password=password)
            
            if user is not None:
                if user.is_active and not user.is_blocked: # type: ignore
                    login(request, user)
                    
                    # Handle remember me functionality
                    if not remember_me:
                        request.session.set_expiry(0)  # Session expires when browser closes
                    
                    messages.success(request, f"Welcome back, {user.first_name}!")
                    
                    # Redirect to next parameter or dashboard
                    next_page = request.GET.get('next', 'dashboard')
                    return redirect(next_page)
                else:
                    if not user.is_active:
                        messages.error(request, "Your account is inactive. Please contact support.")
                    elif user.is_blocked: # type: ignore
                        messages.error(request, "Your account has been blocked. Please contact support.")
            else:
                messages.error(request, "Invalid email or password. Please try again.")
                
        except Exception as e:
            logger.error(f"Login error for email {email}: {str(e)}")
            messages.error(request, "An error occurred during login. Please try again.")
        
        return render(request, 'jobs/login.html')
    
    # GET request - show login form
    return render(request, 'jobs/login.html')

@require_http_methods(["GET", "POST"])
@csrf_protect
def signup(request):
    """
    Handle user registration with country/state selection
    """
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            try:
                # Create user
                user = form.save()
                
                # Log the user in
                login(request, user)
                
                # Send professional welcome email
                EmailService.send_welcome_email(user)
                
                messages.success(request, f"Welcome {user.first_name}! Your account has been created successfully.")
                return redirect('dashboard')
                
            except Exception as e:
                logger.error(f"Error creating user: {str(e)}")
                messages.error(request, "An error occurred during registration. Please try again.")
        else:
            # Form has errors
            for field, errors in form.errors.items():
                for error in errors:
                    messages.error(request, f"{error}")
    else:
        form = SignUpForm()
    
    return render(request, 'jobs/signup.html', {'form': form})

@login_required
def user_logout(request):
    """Handle user logout"""
    logout(request)
    messages.success(request, "You have been successfully logged out.")
    return redirect('index')

###########################################################
# Contact View with Zoho Email Integration
###########################################################

@require_http_methods(["GET", "POST"])
@csrf_protect
def contact(request):
    """
    Handle contact form submissions with Zoho email integration
    """
    if request.method == 'POST':
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        message_text = request.POST.get('message', '').strip()
        
        # Validate form data
        if not name or not email or not message_text:
            messages.error(request, "Please fill in all required fields.")
            return render(request, 'jobs/contact.html')
        
        try:
            # Prepare contact data
            contact_data = {
                'name': name,
                'email': email,
                'message': message_text,
            }
            
            # Send professional contact notification
            EmailService.send_contact_notification(contact_data)
            
            # Log successful email sending
            logger.info(f"Contact form submitted successfully by {name} ({email})")
            
            # Success message
            messages.success(request, "Your message has been sent successfully! We'll get back to you soon.")
            return redirect('contact')
            
        except Exception as e:
            # Log the error
            logger.error(f"Failed to send contact form email: {str(e)}")
            
            # Error message
            messages.error(request, "Sorry, there was an error sending your message. Please try again later.")
            return render(request, 'jobs/contact.html')
    
    # GET request - show contact form
    return render(request, 'jobs/contact.html')

###########################################################
# AJAX Views for Dynamic Form Handling
###########################################################

def get_states(request):
    """AJAX view to get states for a selected country"""
    country_id = request.GET.get('country_id')
    if country_id:
        states = State.objects.filter(country_id=country_id).order_by('name')
        states_data = [{'id': state.id, 'name': state.name} for state in states]
        return JsonResponse(states_data, safe=False)
    return JsonResponse([], safe=False)

###########################################################
# Dashboard Views
###########################################################

@login_required
def dashboard(request):
    """
    User dashboard view
    """
    return render(request, 'jobs/admin_templates/account.html', {'user': request.user})

###########################################################
# Error Handlers
###########################################################

def handler404(request, exception):
    """Custom 404 error handler"""
    return render(request, '404.html', status=404)

def handler500(request):
    """Custom 500 error handler"""
    return render(request, '500.html', status=500)