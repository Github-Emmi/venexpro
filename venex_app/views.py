from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_protect
import logging

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

@login_required
def user_logout(request):
    """Handle user logout"""
    logout(request)
    messages.success(request, "You have been successfully logged out.")
    return redirect('index')

def signup(request):
    """
    Placeholder for signup view - will be implemented after model updates
    """
    # TODO: Implement signup logic after model modifications
    messages.info(request, "Signup functionality will be available soon.")
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
            return render(request, 'contact.html')
        
        try:
            # Prepare email content
            subject = f"New Contact Form Submission from {name}"
            message_body = f"""
            New contact form submission from Venex BTC website:
            
            Name: {name}
            Email: {email}
            
            Message:
            {message_text}
            
            ---
            This message was sent from the contact form on Venex BTC website.
            """
            
            # Send email using Zoho SMTP
            send_mail(
                subject=subject,
                message=message_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.CONTACT_EMAIL],
                fail_silently=False,
            )
            
            # Log successful email sending
            logger.info(f"Contact form submitted successfully by {name} ({email})")
            
            # Success message - will be handled by jQuery on frontend
            messages.success(request, "Your message has been sent successfully! We'll get back to you soon.")
            return redirect('contact')
            
        except Exception as e:
            # Log the error
            logger.error(f"Failed to send contact form email: {str(e)}")
            
            # Error message - will be handled by jQuery on frontend
            messages.error(request, "Sorry, there was an error sending your message. Please try again later.")
            return render(request, 'contact.html')
    
    # GET request - show contact form
    return render(request, 'jobs/contact.html')

###########################################################
# Dashboard Views (Placeholder for now)
###########################################################

@login_required
def dashboard(request):
    """
    Placeholder dashboard view - will be fully implemented later
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