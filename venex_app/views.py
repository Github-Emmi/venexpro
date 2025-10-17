from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse
from .forms import *
import random
from django.utils import timezone
from django.contrib.auth import update_session_auth_hash
from datetime import timedelta
from .models import State, PasswordResetCode, CustomUser
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
# Contact View, and Password Rest View with Zoho Email Integration
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
            return render(request, 'contact.html')
    
    # GET request - show contact form
    return render(request, 'contact.html')

@require_http_methods(["GET", "POST"])
@csrf_protect
def password_reset_request(request):
    """
    Handle password reset requests - send 6-digit code to email
    """
    if request.method == 'POST':
        form = PasswordResetRequestForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            try:
                user = CustomUser.objects.get(email=email, is_active=True)
                
                # Generate 6-digit code
                code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
                
                # Create reset code (invalidate previous codes)
                PasswordResetCode.objects.filter(user=user, is_used=False).update(is_used=True)
                
                reset_code = PasswordResetCode.objects.create(
                    user=user,
                    code=code
                )
                
                # Send email with code
                if EmailService.send_password_reset_code(user, code):
                    # Store user ID in session for verification step
                    request.session['reset_user_id'] = str(user.id)
                    request.session['reset_email'] = email
                    
                    messages.success(
                        request, 
                        f"A 6-digit verification code has been sent to {email}. The code expires in 15 minutes."
                    )
                    return redirect('password_reset_verify')
                else:
                    messages.error(request, "Failed to send reset code. Please try again.")
                    
            except CustomUser.DoesNotExist:
                # Don't reveal that email doesn't exist for security
                messages.success(
                    request, 
                    "If your email exists in our system, you will receive a reset code shortly."
                )
                return redirect('password_reset_request')
    else:
        form = PasswordResetRequestForm()
    
    return render(request, 'jobs/password_reset_request.html', {'form': form})

@require_http_methods(["GET", "POST"])
@csrf_protect
def password_reset_verify(request):
    """
    Verify the 6-digit code sent to user's email
    """
    # Check if user has initiated reset process
    if 'reset_user_id' not in request.session:
        messages.error(request, "Please request a password reset first.")
        return redirect('password_reset_request')
    
    try:
        user = CustomUser.objects.get(id=request.session['reset_user_id'])
    except CustomUser.DoesNotExist:
        messages.error(request, "Invalid reset session. Please start over.")
        return redirect('password_reset_request')
    
    if request.method == 'POST':
        form = PasswordResetCodeForm(request.POST, user=user)
        if form.is_valid():
            code = form.cleaned_data['code']
            
            try:
                # Get and validate the reset code
                reset_code = PasswordResetCode.objects.get(
                    user=user,
                    code=code,
                    is_used=False
                )
                
                if reset_code.is_valid():
                    # Mark code as used and proceed to password reset
                    reset_code.mark_used()
                    request.session['reset_verified'] = True
                    messages.success(request, "Code verified! You can now set your new password.")
                    return redirect('password_reset_confirm')
                else:
                    messages.error(request, "This code has expired. Please request a new one.")
                    return redirect('password_reset_request')
                    
            except PasswordResetCode.DoesNotExist:
                messages.error(request, "Invalid verification code.")
    else:
        form = PasswordResetCodeForm(user=user)
    
    context = {
        'form': form,
        'email': request.session.get('reset_email', ''),
    }
    return render(request, 'jobs/password_reset_verify.html', context)

@require_http_methods(["GET", "POST"])
@csrf_protect
def password_reset_confirm(request):
    """
    Set new password after code verification
    """
    # Check if user has verified their code
    if 'reset_verified' not in request.session or 'reset_user_id' not in request.session:
        messages.error(request, "Please verify your reset code first.")
        return redirect('password_reset_request')
    
    try:
        user = CustomUser.objects.get(id=request.session['reset_user_id'])
    except CustomUser.DoesNotExist:
        messages.error(request, "Invalid reset session. Please start over.")
        return redirect('password_reset_request')
    
    if request.method == 'POST':
        form = PasswordResetConfirmForm(request.POST)
        if form.is_valid():
            new_password = form.cleaned_data['new_password']
            
            # Update user's password
            user.set_password(new_password)
            user.save()
            
            # Send success email
            EmailService.send_password_reset_success(user)
            
            # Clean up session
            request.session.flush()
            
            messages.success(
                request, 
                "Your password has been reset successfully! You can now log in with your new password."
            )
            return redirect('login')
    else:
        form = PasswordResetConfirmForm()
    
    context = {
        'form': form,
        'email': request.session.get('reset_email', ''),
    }
    return render(request, 'jobs/password_reset_confirm.html', context)

@require_http_methods(["GET", "POST"])
@csrf_protect
def password_reset_resend_code(request):
    """
    Resend verification code
    """
    if 'reset_user_id' not in request.session:
        messages.error(request, "Please request a password reset first.")
        return redirect('password_reset_request')
    
    try:
        user = CustomUser.objects.get(id=request.session['reset_user_id'])
        
        # Generate new 6-digit code
        code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
        
        # Invalidate previous codes and create new one
        PasswordResetCode.objects.filter(user=user, is_used=False).update(is_used=True)
        
        reset_code = PasswordResetCode.objects.create(
            user=user,
            code=code
        )
        
        # Send new code email
        if EmailService.send_password_reset_code(user, code):
            messages.success(request, "A new verification code has been sent to your email.")
        else:
            messages.error(request, "Failed to send new code. Please try again.")
            
    except CustomUser.DoesNotExist:
        messages.error(request, "Invalid reset session. Please start over.")
        return redirect('password_reset_request')
    
    return redirect('password_reset_verify')


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