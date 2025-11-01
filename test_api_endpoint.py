#!/usr/bin/env python
"""
Test the transaction history API endpoint
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'venexpro.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from venex_app.api_views import api_transaction_history
from rest_framework.test import force_authenticate

User = get_user_model()
factory = RequestFactory()

# Get the user
user = User.objects.get(email='emmidevcodes@gmail.com')
print(f"Testing API for user: {user.email}\n")

# Create a fake request
request = factory.get('/api/transactions/history/?page=1&per_page=25')
force_authenticate(request, user=user)

# Call the API
try:
    response = api_transaction_history(request)
    print("API Response Status:", response.status_code)
    print("\nAPI Response Data:")
    
    if response.status_code == 200:
        data = response.data
        print(f"  Success: {data.get('success')}")
        print(f"  Total Transactions: {len(data.get('transactions', []))}")
        print(f"  Total Count: {data.get('pagination', {}).get('total_count')}")
        print(f"  Statistics: {data.get('statistics')}")
        
        if data.get('transactions'):
            print("\n  First Transaction:")
            first_txn = data['transactions'][0]
            for key, value in first_txn.items():
                print(f"    {key}: {value}")
    else:
        print(f"  Error: {response.data}")
        
except Exception as e:
    print(f"ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
