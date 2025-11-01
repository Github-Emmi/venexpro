#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'venexpro.settings')
django.setup()

from venex_app.models import Transaction, CustomUser, Order

# Check total transactions
total_txns = Transaction.objects.count()
print(f'Total Transactions in DB: {total_txns}')

# Check total users
total_users = CustomUser.objects.count()
print(f'Total Users in DB: {total_users}')

# Check total orders
total_orders = Order.objects.count()
print(f'Total Orders in DB: {total_orders}')

# If there are transactions, show samples
if total_txns > 0:
    print(f'\nFirst 5 Transactions:')
    for txn in Transaction.objects.all()[:5]:
        print(f'  - {txn.id} | User: {txn.user.email} | Type: {txn.transaction_type} | Status: {txn.status} | Amount: {txn.total_amount}')
else:
    print('\n⚠️ No transactions found in database!')
    print('\nTo test the transaction history page, you need to:')
    print('1. Create some test transactions')
    print('2. Or use the buy/sell features to create real transactions')
