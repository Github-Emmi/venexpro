"""
Quick email test script
Run with: python test_email.py
"""
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'venexpro.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 60)
print("SMTP Configuration:")
print(f"Backend: {settings.EMAIL_BACKEND}")
print(f"Host: {settings.EMAIL_HOST}")
print(f"Port: {settings.EMAIL_PORT}")
print(f"Use TLS: {settings.EMAIL_USE_TLS}")
print(f"Use SSL: {settings.EMAIL_USE_SSL}")
print(f"From: {settings.DEFAULT_FROM_EMAIL}")
print("=" * 60)

# Test email
recipient = input("\nEnter recipient email address (or press Enter for emmidevcodes@gmail.com): ").strip()
if not recipient:
    recipient = 'emmidevcodes@gmail.com'

print(f"\nSending test email to: {recipient}")
print("Please wait...")

try:
    result = send_mail(
        subject='Test Email from Venex - SMTP Configuration Test',
        message='This is a test email to verify SMTP configuration is working correctly.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=False,
    )
    print(f"\n✅ Email sent successfully! Result: {result}")
    print(f"Check {recipient} inbox (and spam folder) for the test email.")
except Exception as e:
    print(f"\n❌ Email failed: {e}")
    import traceback
    traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("TROUBLESHOOTING:")
    print("- Check if port 587 is not blocked by firewall")
    print("- Verify Zoho email credentials are correct")
    print("- Ensure the Zoho account has SMTP enabled")
    print("- Try generating an app-specific password in Zoho")
    print("=" * 60)
