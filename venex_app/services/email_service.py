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
    Enhanced with anti-spam headers and better deliverability
    """
    
    @staticmethod
    def _send_email(subject, template_name, context, to_emails, reply_to=None, category='transactional'):
        """
        Generic method to send emails with template
        Includes anti-spam headers for better deliverability
        """
        try:
            html_content = render_to_string(template_name, context)
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=f"Venex Support <{settings.DEFAULT_FROM_EMAIL}>",
                to=to_emails,
                reply_to=reply_to or [settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            
            # Add anti-spam headers
            email.extra_headers = {
                'X-Mailer': 'Venex Trading Platform',
                'X-Priority': '1' if category == 'urgent' else '3',
                'X-Entity-Ref-ID': f"venex-{category}",
                'Precedence': 'bulk' if category == 'marketing' else 'first-class',
                'List-Unsubscribe': f'<mailto:{settings.SUPPORT_EMAIL}?subject=Unsubscribe>',
                'X-Campaign-Type': category,
            }
            
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
    def send_verification_notification(user, verification_code):
        """
        Send verification code email for buy transaction
        """
        try:
            context = {
                'user': user,
                'verification_code': verification_code,
                'site_url': settings.SITE_URL,
                'support_email': settings.SUPPORT_EMAIL,
                'timestamp': timezone.now(),
            }
            subject = "Your Venex Trading Verification Code"
            html_content = render_to_string('emails/verification_code.html', context)
            text_content = strip_tags(html_content)
            
            logger.info(f"Attempting to send verification email to {user.email}")
            logger.info(f"Using SMTP: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}")
            logger.info(f"From: {settings.DEFAULT_FROM_EMAIL}")
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            
            logger.info(f"Verification code email sent successfully to {user.email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send verification code email: {str(e)}", exc_info=True)
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

    @staticmethod
    def send_deposit_pending_email(user, transaction, admin_wallet_address):
        """Send crypto deposit pending notification with enhanced deliverability"""
        import logging
        logger = logging.getLogger(__name__)
        
        crypto_symbol = transaction.cryptocurrency.symbol if transaction.cryptocurrency else 'CRYPTO'
        
        context = {
            'user': user,
            'transaction': transaction,
            'admin_wallet_address': admin_wallet_address,
            'amount': transaction.quantity,
            'crypto': crypto_symbol,
            'fiat_amount': transaction.fiat_amount,
            'currency': transaction.currency,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
            'support_email': settings.SUPPORT_EMAIL,
        }
        
        subject = f"Crypto Deposit Processing - {context['amount']} {crypto_symbol}"
        html_message = render_to_string('emails/crypto_deposit_pending.html', context)
        plain_message = f"Your deposit of {context['amount']} {context['crypto']} is being processed. Please send the cryptocurrency to: {admin_wallet_address}\n\nFor support, reply to this email or contact {settings.SUPPORT_EMAIL}"
        
        try:
            logger.info(f"Sending deposit pending email to {user.email} for {context['amount']} {crypto_symbol}")
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=f"Venex Support <{settings.DEFAULT_FROM_EMAIL}>",
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_message, "text/html")
            
            # Add anti-spam headers
            email.extra_headers = {
                'X-Mailer': 'Venex Trading Platform',
                'X-Priority': '3',
                'X-Entity-Ref-ID': f"venex-deposit-{transaction.id}",
                'X-Transaction-Type': 'crypto-deposit',
                'Message-ID': f"<deposit-{transaction.id}@venexbtc.com>",
                'List-Unsubscribe': f'<mailto:{settings.SUPPORT_EMAIL}?subject=Unsubscribe>',
            }
            
            email.send(fail_silently=False)
            
            logger.info(f"Deposit pending email sent successfully to {user.email}")
            return True
        except Exception as e:
            logger.error(f"Deposit pending email failed for {user.email}: {e}", exc_info=True)
            print(f"Deposit pending email failed: {e}")
            return False

    @staticmethod
    def send_bank_deposit_pending_email(user, transaction, admin_bank, amount_in_bank_currency):
        """Send bank deposit pending notification"""
        context = {
            'user': user,
            'transaction': transaction,
            'admin_bank': admin_bank,
            'amount': transaction.fiat_amount,
            'currency': transaction.currency,
            'amount_in_bank_currency': amount_in_bank_currency,
            'bank_currency': admin_bank.currency_type,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
        }
        
        subject = f"Bank Deposit Processing - {context['amount']} {context['currency']}"
        html_message = render_to_string('emails/bank_deposit_pending.html', context)
        plain_message = f"Your deposit of {context['amount']} {context['currency']} is being processed. Please transfer funds to the bank account provided."
        
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
            print(f"Bank deposit pending email failed: {e}")
            return False

    @staticmethod
    def send_crypto_deposit_completed_email(user, transaction):
        """Send crypto deposit completed notification"""
        crypto_symbol = transaction.cryptocurrency.symbol if transaction.cryptocurrency else 'CRYPTO'
        # Get the balance field name (e.g., 'btc_balance' for BTC)
        balance_field = f"{crypto_symbol.lower()}_balance"
        new_balance = getattr(user, balance_field, 0)
        
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity,
            'crypto': crypto_symbol,
            'new_balance': new_balance,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
        }
        
        subject = f"Deposit Complete - {context['amount']} {crypto_symbol} Credited"
        html_message = render_to_string('emails/crypto_deposit_completed.html', context)
        plain_message = f"Your deposit of {context['amount']} {context['crypto']} has been completed. Your new balance is {context['new_balance']} {context['crypto']}."
        
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
            print(f"Deposit completed email failed: {e}")
            return False

    @staticmethod
    def send_bank_deposit_completed_email(user, transaction):
        """Send bank deposit completed notification"""
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.fiat_amount,
            'currency': transaction.currency,
            'new_balance': user.currency_balance,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
        }
        
        subject = f"Deposit Complete - {context['amount']} {context['currency']} Credited"
        html_message = render_to_string('emails/bank_deposit_completed.html', context)
        plain_message = f"Your deposit of {context['amount']} {context['currency']} has been completed. Your new balance is {context['new_balance']} {context['currency']}."
        
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
            print(f"Bank deposit completed email failed: {e}")
            return False

    @staticmethod
    def send_withdrawal_pending_email(user, transaction):
        """Send crypto withdrawal pending notification with enhanced deliverability"""
        import logging
        logger = logging.getLogger(__name__)
        
        crypto_symbol = transaction.cryptocurrency.symbol if transaction.cryptocurrency else 'CRYPTO'
        
        # Map crypto symbols to correct balance field names
        balance_field_map = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance'
        }
        
        balance_field = balance_field_map.get(crypto_symbol, f"{crypto_symbol.lower()}_balance")
        new_balance = getattr(user, balance_field, 0)
        
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity,
            'crypto': crypto_symbol,
            'wallet_address': transaction.wallet_address,
            'new_balance': new_balance,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
            'support_email': settings.SUPPORT_EMAIL,
        }
        
        subject = f"Withdrawal Request Received - {context['amount']} {crypto_symbol}"
        html_message = render_to_string('emails/crypto_withdrawal_pending.html', context)
        plain_message = f"Your withdrawal request for {context['amount']} {crypto_symbol} to {transaction.wallet_address} is being processed.\n\nFor support, reply to this email or contact {settings.SUPPORT_EMAIL}"
        
        try:
            logger.info(f"Sending withdrawal pending email to {user.email} for {context['amount']} {crypto_symbol}")
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=f"Venex Support <{settings.DEFAULT_FROM_EMAIL}>",
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_message, "text/html")
            
            # Add anti-spam headers
            email.extra_headers = {
                'X-Mailer': 'Venex Trading Platform',
                'X-Priority': '3',
                'X-Entity-Ref-ID': f"venex-withdrawal-{transaction.id}",
                'X-Transaction-Type': 'crypto-withdrawal',
                'Message-ID': f"<withdrawal-{transaction.id}@venexbtc.com>",
                'List-Unsubscribe': f'<mailto:{settings.SUPPORT_EMAIL}?subject=Unsubscribe>',
            }
            
            email.send(fail_silently=False)
            
            logger.info(f"Withdrawal pending email sent successfully to {user.email}")
            return True
        except Exception as e:
            logger.error(f"Withdrawal pending email failed for {user.email}: {e}", exc_info=True)
            print(f"Withdrawal pending email failed: {e}")
            return False

    @staticmethod
    def send_withdrawal_completed_email(user, transaction):
        """Send crypto withdrawal completed notification"""
        crypto_symbol = transaction.cryptocurrency.symbol if transaction.cryptocurrency else 'CRYPTO'
        
        # Map crypto symbols to correct balance field names
        balance_field_map = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance'
        }
        
        balance_field = balance_field_map.get(crypto_symbol, f"{crypto_symbol.lower()}_balance")
        new_balance = getattr(user, balance_field, 0)
        
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity,
            'crypto': crypto_symbol,
            'wallet_address': transaction.wallet_address,
            'transaction_hash': transaction.transaction_hash or 'Pending blockchain confirmation',
            'new_balance': new_balance,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
            'support_email': settings.SUPPORT_EMAIL,
        }
        
        subject = f"Withdrawal Complete - {context['amount']} {crypto_symbol} Sent"
        html_message = render_to_string('emails/crypto_withdrawal_completed.html', context)
        plain_message = f"Your withdrawal of {context['amount']} {crypto_symbol} has been completed and sent to {transaction.wallet_address}.\n\nTransaction Hash: {context['transaction_hash']}\nYour new balance is {context['new_balance']} {crypto_symbol}."
        
        try:
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=f"Venex Support <{settings.DEFAULT_FROM_EMAIL}>",
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_message, "text/html")
            
            # Add anti-spam headers
            email.extra_headers = {
                'X-Mailer': 'Venex Trading Platform',
                'X-Priority': '3',
                'X-Entity-Ref-ID': f"venex-withdrawal-{transaction.id}",
                'X-Transaction-Type': 'crypto-withdrawal-completed',
                'Message-ID': f"<withdrawal-complete-{transaction.id}@venexbtc.com>",
                'List-Unsubscribe': f'<mailto:{settings.SUPPORT_EMAIL}?subject=Unsubscribe>',
            }
            
            email.send(fail_silently=False)
            return True
        except Exception as e:
            print(f"Withdrawal completed email failed: {e}")
            return False

    @staticmethod
    def send_withdrawal_failed_email(user, transaction, reason):
        """Send crypto withdrawal failed notification"""
        crypto_symbol = transaction.cryptocurrency.symbol if transaction.cryptocurrency else 'CRYPTO'
        
        # Map crypto symbols to correct balance field names
        balance_field_map = {
            'BTC': 'btc_balance',
            'ETH': 'ethereum_balance',
            'USDT': 'usdt_balance',
            'LTC': 'litecoin_balance',
            'TRX': 'tron_balance'
        }
        
        balance_field = balance_field_map.get(crypto_symbol, f"{crypto_symbol.lower()}_balance")
        refunded_balance = getattr(user, balance_field, 0)
        
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity,
            'crypto': crypto_symbol,
            'wallet_address': transaction.wallet_address,
            'reason': reason,
            'refunded_balance': refunded_balance,
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
            'current_year': timezone.now().year,
            'site_url': 'http://127.0.0.1:8000',  # Update with your domain
            'support_email': settings.SUPPORT_EMAIL,
        }
        
        subject = f"Withdrawal Failed - {context['amount']} {crypto_symbol} Refunded"
        html_message = render_to_string('emails/crypto_withdrawal_failed.html', context)
        plain_message = f"Your withdrawal request for {context['amount']} {crypto_symbol} has failed.\n\nReason: {reason}\n\nThe amount has been refunded to your account. Current balance: {refunded_balance} {crypto_symbol}.\n\nFor support, contact {settings.SUPPORT_EMAIL}"
        
        try:
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=f"Venex Support <{settings.DEFAULT_FROM_EMAIL}>",
                to=[user.email],
                reply_to=[settings.SUPPORT_EMAIL],
            )
            email.attach_alternative(html_message, "text/html")
            
            # Add anti-spam headers
            email.extra_headers = {
                'X-Mailer': 'Venex Trading Platform',
                'X-Priority': '1',  # High priority for failed transactions
                'X-Entity-Ref-ID': f"venex-withdrawal-{transaction.id}",
                'X-Transaction-Type': 'crypto-withdrawal-failed',
                'Message-ID': f"<withdrawal-failed-{transaction.id}@venexbtc.com>",
                'List-Unsubscribe': f'<mailto:{settings.SUPPORT_EMAIL}?subject=Unsubscribe>',
            }
            
            email.send(fail_silently=False)
            return True
        except Exception as e:
            print(f"Withdrawal failed email notification failed: {e}")
            return False