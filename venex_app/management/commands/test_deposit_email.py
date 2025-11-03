from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from venex_app.models import Transaction, Cryptocurrency
from venex_app.services.email_service import EmailService
from decimal import Decimal

User = get_user_model()


class Command(BaseCommand):
    help = 'Test sending crypto deposit pending email'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email address to send test to',
            default=None
        )

    def handle(self, *args, **options):
        email = options['email']
        
        # Get a user
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User with email {email} not found'))
                return
        else:
            user = User.objects.filter(is_superuser=False).first()
            if not user:
                self.stdout.write(self.style.ERROR('No users found in database'))
                return
        
        self.stdout.write(f'Testing email for user: {user.email}')
        
        # Get or create a test cryptocurrency
        try:
            crypto = Cryptocurrency.objects.get(symbol='BTC')
        except Cryptocurrency.DoesNotExist:
            self.stdout.write(self.style.ERROR('BTC cryptocurrency not found in database'))
            return
        
        # Create a test transaction
        try:
            transaction = Transaction.objects.create(
                user=user,
                transaction_type='DEPOSIT',
                cryptocurrency=crypto,
                quantity=Decimal('0.001'),
                price_per_unit=crypto.current_price,
                total_amount=Decimal('0.001'),
                fiat_amount=Decimal('0.001') * crypto.current_price,
                currency=user.currency_type,
                status='PENDING',
                wallet_address='1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
            )
            
            self.stdout.write(self.style.SUCCESS(f'Test transaction created: {transaction.id}'))
            
            # Send email
            admin_wallet_address = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
            result = EmailService.send_deposit_pending_email(
                user=user,
                transaction=transaction,
                admin_wallet_address=admin_wallet_address
            )
            
            if result:
                self.stdout.write(self.style.SUCCESS(f'✅ Email sent successfully to {user.email}'))
            else:
                self.stdout.write(self.style.ERROR(f'❌ Email failed to send to {user.email}'))
            
            # Delete test transaction
            transaction.delete()
            self.stdout.write('Test transaction deleted')
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))
            import traceback
            traceback.print_exc()
