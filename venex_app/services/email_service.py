from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)

class EmailService:
    """
    Professional email service for sending HTML emails with templates
    """
    
    @staticmethod
    def send_welcome_email(user):
        """
        Send welcome email to new users
        """
        try:
            context = {
                'user': user,
                'site_url': settings.SITE_URL,
                'dashboard_url': f"{settings.SITE_URL}/dashboard",
                'user_email': user.email,
            }
            
            subject = "Welcome to Venex Brokerage - Your Account is Ready!"
            html_content = render_to_string('emails/welcome_email.html', context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            
            logger.info(f"Welcome email sent successfully to {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")
            return False
    
    @staticmethod
    def send_contact_notification(contact_data):
        """
        Send notification to admin about new contact form submission
        """
        try:
            from django.utils import timezone
            
            context = {
                'contact_data': contact_data,
                'site_url': settings.SITE_URL,
                'submitted_at': timezone.now(),
                'user_email': settings.CONTACT_EMAIL,
            }
            
            subject = f"New Contact Form: {contact_data['name']}"
            html_content = render_to_string('emails/contact_notification.html', context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[settings.CONTACT_EMAIL],
                reply_to=[contact_data['email']],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            
            logger.info(f"Contact notification sent for {contact_data['email']}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send contact notification: {str(e)}")
            return False
    
    @staticmethod
    def send_transaction_notification(transaction):
        """
        Send transaction status update to user
        """
        try:
            user = transaction.user
            context = {
                'user': user,
                'transaction': transaction,
                'site_url': settings.SITE_URL,
                'transaction_details_url': f"{settings.SITE_URL}/dashboard/transactions/{transaction.id}",
                'user_email': user.email,
            }
            
            status_display = transaction.get_status_display()
            subject = f"Transaction {status_display} - {transaction.get_cryptocurrency_display()}"
            
            html_content = render_to_string('emails/transaction_notification.html', context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            
            logger.info(f"Transaction notification sent to {user.email} for transaction {transaction.id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send transaction notification: {str(e)}")
            return False
    
    @staticmethod
    def send_password_reset_email(user, reset_url):
        """
        Send password reset email
        """
        try:
            context = {
                'user': user,
                'reset_url': reset_url,
                'site_url': settings.SITE_URL,
                'user_email': user.email,
            }
            
            subject = "Password Reset Request - Venex Brokerage"
            html_content = render_to_string('emails/password_reset.html', context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            
            logger.info(f"Password reset email sent to {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
            return False
    
    @staticmethod
    def send_kyc_status_email(user, status):
        """
        Send KYC verification status update
        """
        try:
            context = {
                'user': user,
                'status': status,
                'site_url': settings.SITE_URL,
                'user_email': user.email,
            }
            
            if status == 'approved':
                subject = "KYC Verification Approved - Venex Brokerage"
                template = 'emails/kyc_approved.html'
            else:
                subject = "KYC Verification Update - Venex Brokerage"
                template = 'emails/kyc_update.html'
            
            html_content = render_to_string(template, context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send()
            
            logger.info(f"KYC status email sent to {user.email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send KYC status email: {str(e)}")
            return False