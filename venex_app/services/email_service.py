from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging
from django.utils import timezone
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

class EmailService:
    """
    Professional email service for sending HTML emails with Zoho integration
    """
    
    @staticmethod
    def _send_email(subject, template_name, context, to_emails, reply_to=None):
        """
        Generic method to send emails with template
        """
        try:
            html_content = render_to_string(template_name, context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=to_emails,
                reply_to=reply_to or [settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            
            logger.info(f"Email sent successfully to {to_emails} - Subject: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_emails}: {str(e)}", exc_info=True)
            return False
    
    @staticmethod
    def send_welcome_email(user):
        """
        Send professional welcome email to new users
        """
        context = {
            'user': user,
            'site_url': settings.SITE_URL,
            'dashboard_url': f"{settings.SITE_URL}/dashboard",
            'login_url': f"{settings.SITE_URL}/login",
            'support_email': settings.SUPPORT_EMAIL,
            'current_year': timezone.now().year,
            'timestamp': timezone.now(),
        }
        
        subject = "Welcome to Venex Brokerage - Your Account is Ready!"
        return EmailService._send_email(
            subject=subject,
            template_name='emails/welcome_email.html',
            context=context,
            to_emails=[user.email]
        )
    
    
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
        
    @staticmethod
    def send_password_reset_code(user, reset_code):
        """Send password reset code email"""
        context = {
            'user': user,
            'reset_code': reset_code,
            'expires_in': 15,
            'timestamp': timezone.now(),
        }
        
        subject = "Password Reset Code - Venex Trading"
        html_message = render_to_string('emails/password_reset_code.html', context)
        plain_message = f"Your password reset code is: {reset_code}. This code expires in 15 minutes."
        
        try:
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            print(f"Password reset email failed: {e}")
            return False

    @staticmethod
    def send_password_reset_success(user):
        """Send password reset success notification"""
        context = {
            'user': user,
            'timestamp': timezone.now(),
        }
        
        subject = "Password Reset Successful - Venex Trading"
        html_message = render_to_string('emails/password_reset_success.html', context)
        plain_message = "Your password has been successfully reset. If you didn't make this change, please contact support immediately."
        
        try:
            send_mail(
                subject=subject,
                message=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                html_message=html_message,
                fail_silently=False,
            )
            return True
        except Exception as e:
            print(f"Password reset success email failed: {e}")
            return False