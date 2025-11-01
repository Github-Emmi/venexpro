#!/usr/bin/env python
"""
Create test transactions for transaction history page testing
"""
import os
import django
from decimal import Decimal
from datetime import datetime, timedelta
import random

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'venexpro.settings')
django.setup()

from venex_app.models import Transaction, CustomUser, Cryptocurrency
from django.utils import timezone

def create_test_transactions():
    """Create sample transactions for testing"""
    
    # Get or create a test user
    users = CustomUser.objects.all()
    if not users.exists():
        print("❌ No users found! Please create a user first.")
        print("Run: python manage.py createsuperuser")
        return
    
    user = users.first()
    print(f"✅ Using user: {user.email}")
    
    # Get or create cryptocurrencies
    cryptos = []
    crypto_data = [
        {'symbol': 'BTC', 'name': 'Bitcoin', 'price': 45000},
        {'symbol': 'ETH', 'name': 'Ethereum', 'price': 3000},
        {'symbol': 'USDT', 'name': 'Tether', 'price': 1},
        {'symbol': 'LTC', 'name': 'Litecoin', 'price': 150},
        {'symbol': 'TRX', 'name': 'Tron', 'price': 0.10},
    ]
    
    for data in crypto_data:
        crypto, created = Cryptocurrency.objects.get_or_create(
            symbol=data['symbol'],
            defaults={
                'name': data['name'],
                'current_price': Decimal(str(data['price'])),
                'is_active': True,
                'rank': len(cryptos) + 1
            }
        )
        cryptos.append(crypto)
        if created:
            print(f"✅ Created cryptocurrency: {crypto.symbol}")
    
    # Create test transactions
    transaction_types = ['BUY', 'SELL', 'DEPOSIT', 'WITHDRAWAL']
    statuses = ['COMPLETED', 'PENDING', 'FAILED']
    
    created_count = 0
    for i in range(50):  # Create 50 test transactions
        crypto = random.choice(cryptos)
        txn_type = random.choice(transaction_types)
        status = random.choice(statuses)
        
        # Random quantity
        if crypto.symbol == 'BTC':
            quantity = Decimal(str(random.uniform(0.001, 0.5)))
        elif crypto.symbol == 'ETH':
            quantity = Decimal(str(random.uniform(0.01, 5.0)))
        else:
            quantity = Decimal(str(random.uniform(1, 1000)))
        
        price_per_unit = crypto.current_price
        total_amount = quantity * price_per_unit
        
        # Random date within last 90 days
        days_ago = random.randint(0, 90)
        created_at = timezone.now() - timedelta(days=days_ago)
        
        # Create transaction
        txn = Transaction.objects.create(
            user=user,
            transaction_type=txn_type,
            cryptocurrency=crypto,
            quantity=quantity,
            price_per_unit=price_per_unit,
            total_amount=total_amount,
            fiat_amount=total_amount,
            currency='USD',
            status=status,
            network_fee=Decimal('0.0001') if txn_type in ['BUY', 'SELL'] else Decimal('0'),
            platform_fee=total_amount * Decimal('0.001'),  # 0.1% fee
            created_at=created_at,
        )
        
        if status == 'COMPLETED':
            txn.completed_at = created_at + timedelta(minutes=random.randint(1, 30))
            txn.save()
        
        created_count += 1
    
    print(f"\n✅ Created {created_count} test transactions!")
    
    # Show summary
    total = Transaction.objects.filter(user=user).count()
    completed = Transaction.objects.filter(user=user, status='COMPLETED').count()
    pending = Transaction.objects.filter(user=user, status='PENDING').count()
    failed = Transaction.objects.filter(user=user, status='FAILED').count()
    
    print(f"\n📊 Transaction Summary for {user.email}:")
    print(f"   Total: {total}")
    print(f"   Completed: {completed}")
    print(f"   Pending: {pending}")
    print(f"   Failed: {failed}")
    
    print(f"\n🎉 Test data created successfully!")
    print(f"🌐 Visit: http://localhost:8000/history/")

if __name__ == '__main__':
    create_test_transactions()
