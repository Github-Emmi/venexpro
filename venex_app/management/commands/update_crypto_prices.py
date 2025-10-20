# venex_app/management/commands/update_crypto_prices.py
from django.core.management.base import BaseCommand
from venex_app.services.crypto_api_service import crypto_service

class Command(BaseCommand):
    help = 'Update cryptocurrency prices from external APIs'
    
    def handle(self, *args, **options):
        self.stdout.write('Updating cryptocurrency prices...')
        success = crypto_service.update_cryptocurrency_data()
        
        if success:
            self.stdout.write(
                self.style.SUCCESS('Successfully updated cryptocurrency prices')
            )
        else:
            self.stdout.write(
                self.style.ERROR('Failed to update cryptocurrency prices')
            )