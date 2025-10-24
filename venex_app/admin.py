from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.http import HttpResponse
from django.utils import timezone
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib import messages
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render, redirect
from django.db.models import Sum, Count, Q
from django.utils.safestring import mark_safe
import csv
import json
from datetime import datetime, timedelta
from .models import (
    CustomUser, UserActivity, Cryptocurrency, PriceHistory, 
    Transaction, Order, Portfolio, Country, State
)


# ================================
# EMAIL SERVICE WITH TEMPLATES
# ================================
class AdminEmailService:
    """Enhanced email service using your template structure"""
    
    @staticmethod
    def send_deposit_notification(user, transaction):
        """Send deposit confirmation email"""
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity or transaction.fiat_amount,
            'crypto': transaction.get_cryptocurrency_display(),
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
        }
        
        subject = f"Deposit Completed - {context['amount']} {context['crypto']}"
        html_message = render_to_string('emails/deposit_notification.html', context)
        plain_message = f"Your deposit of {context['amount']} {context['crypto']} has been completed."
        
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
            print(f"Deposit email failed: {e}")
            return False

    @staticmethod
    def send_withdrawal_notification(user, transaction):
        """Send withdrawal confirmation email"""
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity or transaction.fiat_amount,
            'crypto': transaction.get_cryptocurrency_display(),
            'transaction_id': transaction.id,
            'timestamp': timezone.now(),
        }
        
        subject = f"Withdrawal Completed - {context['amount']} {context['crypto']}"
        html_message = render_to_string('emails/withdrawal_notification.html', context)
        plain_message = f"Your withdrawal of {context['amount']} {context['crypto']} has been processed."
        
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
            print(f"Withdrawal email failed: {e}")
            return False

    @staticmethod
    def send_transaction_notification(user, transaction, notification_type):
        """Generic transaction notification"""
        context = {
            'user': user,
            'transaction': transaction,
            'amount': transaction.quantity or transaction.fiat_amount,
            'crypto': transaction.get_cryptocurrency_display(),
            'transaction_id': transaction.id,
            'notification_type': notification_type,
            'timestamp': timezone.now(),
        }
        
        subject = f"Transaction Update - {context['crypto']}"
        html_message = render_to_string('emails/transaction_notification.html', context) # type: ignore
        plain_message = f"Your {context['crypto']} transaction has been updated."
        
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
            print(f"Transaction email failed: {e}")
            return False

    @staticmethod
    def send_kyc_approved_notification(user):
        """Send KYC approval email"""
        context = {
            'user': user,
            'approval_date': timezone.now(),
        }
        
        subject = "KYC Verification Approved"
        html_message = render_to_string('emails/kyc_approved.html', context)
        plain_message = "Your KYC verification has been approved. You now have full access to our platform."
        
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
            print(f"KYC approval email failed: {e}")
            return False

    @staticmethod
    def send_kyc_update_notification(user, status):
        """Send KYC status update email"""
        context = {
            'user': user,
            'status': status,
            'update_date': timezone.now(),
        }
        
        subject = f"KYC Verification {status}"
        html_message = render_to_string('emails/kyc_update.html', context)
        plain_message = f"Your KYC verification status has been updated to: {status}"
        
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
            print(f"KYC update email failed: {e}")
            return False

    @staticmethod
    def send_welcome_email(user):
        """Send welcome email to new users"""
        context = {
            'user': user,
            'signup_date': user.created_at,
        }
        
        subject = "Welcome to Venex Trading Platform"
        html_message = render_to_string('emails/welcome_email.html', context)
        plain_message = f"Welcome {user.first_name}! Thank you for joining Venex Trading Platform."
        
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
            print(f"Welcome email failed: {e}")
            return False

    @staticmethod
    def send_balance_credit_notification(user, amount, crypto_type):
        """Send balance credit notification"""
        context = {
            'user': user,
            'amount': amount,
            'crypto_type': crypto_type,
            'crypto_name': crypto_type,
            'timestamp': timezone.now(),
        }
        
        subject = f"Balance Credited - {amount} {crypto_type}"
        html_message = render_to_string('emails/transactions_notification.html', context)
        plain_message = f"Your account has been credited with {amount} {crypto_type}."
        
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
            print(f"Balance credit email failed: {e}")
            return False
        
    @staticmethod
    def send_password_reset_code(user, reset_code):
        """Send password reset code email"""
        context = {
            'user': user,
            'reset_code': reset_code,
            'expires_in': 15,  # minutes
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


# ================================
# CUSTOM ADMIN SITE
# ================================
class VenexAdminSite(admin.AdminSite):
    site_header = "Venex Trading Platform Administration"
    site_title = "Venex Admin"
    index_title = "Platform Dashboard"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('admin-dashboard/', self.admin_view(self.admin_dashboard), name='admin-dashboard'),
            path('pending-actions/', self.admin_view(self.pending_actions), name='pending-actions'),
        ]
        return custom_urls + urls
    
    def admin_dashboard(self, request):
        """Custom admin dashboard with analytics"""
        # Platform statistics
        total_users = CustomUser.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        verified_users = CustomUser.objects.filter(is_verified=True).count()
        blocked_users = CustomUser.objects.filter(is_blocked=True).count()
        
        # Transaction statistics
        total_transactions = Transaction.objects.count()
        pending_deposits = Transaction.objects.filter(
            transaction_type='DEPOSIT', 
            status='PENDING'
        ).count()
        pending_withdrawals = Transaction.objects.filter(
            transaction_type='WITHDRAWAL', 
            status='PENDING'
        ).count()
        
        # Order statistics
        total_orders = Order.objects.count()
        open_orders = Order.objects.filter(status='OPEN').count()
        
        # Revenue statistics (platform fees)
        total_revenue = Transaction.objects.aggregate(
            total_fees=Sum('platform_fee')
        )['total_fees'] or 0
        
        # Recent activities
        recent_activities = UserActivity.objects.select_related('user').order_by('-timestamp')[:10]
        recent_transactions = Transaction.objects.select_related('user').order_by('-created_at')[:10]
        
        context = {
            **self.each_context(request),
            'total_users': total_users,
            'active_users': active_users,
            'verified_users': verified_users,
            'blocked_users': blocked_users,
            'total_transactions': total_transactions,
            'pending_deposits': pending_deposits,
            'pending_withdrawals': pending_withdrawals,
            'total_orders': total_orders,
            'open_orders': open_orders,
            'total_revenue': total_revenue,
            'recent_activities': recent_activities,
            'recent_transactions': recent_transactions,
        }
        return render(request, 'admin/venex_dashboard.html', context)
    
    def pending_actions(self, request):
        """View for pending actions requiring admin attention"""
        pending_deposits = Transaction.objects.filter(
            transaction_type='DEPOSIT', 
            status='PENDING'
        ).select_related('user')
        
        pending_withdrawals = Transaction.objects.filter(
            transaction_type='WITHDRAWAL', 
            status='PENDING'
        ).select_related('user')
        
        kyc_pending = CustomUser.objects.filter(
            id_document__isnull=False,
            is_verified=False
        )
        
        context = {
            **self.each_context(request),
            'pending_deposits': pending_deposits,
            'pending_withdrawals': pending_withdrawals,
            'kyc_pending': kyc_pending,
        }
        return render(request, 'admin/pending_actions.html', context)


# ================================
# INLINE ADMIN CLASSES
# ================================
class UserActivityInline(admin.TabularInline):
    model = UserActivity
    extra = 0
    readonly_fields = ('activity_type', 'description', 'ip_address', 'user_agent', 'timestamp')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    readonly_fields = (
        'transaction_type', 'cryptocurrency', 'quantity', 'total_amount', 
        'status', 'created_at', 'get_status_badge'
    )
    can_delete = False
    show_change_link = True
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def get_status_badge(self, obj):
        status_colors = {
            'PENDING': 'orange',
            'COMPLETED': 'green',
            'FAILED': 'red',
            'CANCELLED': 'gray',
            'PROCESSING': 'blue'
        }
        color = status_colors.get(obj.status, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status'


class PortfolioInline(admin.TabularInline):
    model = Portfolio
    extra = 0
    readonly_fields = (
        'cryptocurrency', 'total_quantity', 'average_buy_price', 
        'current_value', 'profit_loss', 'profit_loss_percentage', 'last_updated'
    )
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


class OrderInline(admin.TabularInline):
    model = Order
    extra = 0
    readonly_fields = (
        'order_type', 'side', 'cryptocurrency', 'quantity', 'price', 
        'status', 'created_at', 'get_status_badge'
    )
    can_delete = False
    show_change_link = True
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def get_status_badge(self, obj):
        status_colors = {
            'OPEN': 'blue',
            'FILLED': 'green',
            'CANCELLED': 'red',
            'PARTIALLY_FILLED': 'orange',
            'EXPIRED': 'gray'
        }
        color = status_colors.get(obj.status, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status' # type: ignore


# ================================
# UTILITY FUNCTIONS
# ================================
def export_to_csv(modeladmin, request, queryset, field_names, filename):
    """Generic CSV export function"""
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    
    writer = csv.writer(response)
    writer.writerow(field_names)
    
    for obj in queryset:
        row = []
        for field in field_names:
            if hasattr(obj, f'get_{field}'):
                row.append(getattr(obj, f'get_{field}')())
            else:
                value = getattr(obj, field.lower().replace(' ', '_'), '')
                row.append(str(value))
        writer.writerow(row)
    
    return response


# ================================
# MAIN ADMIN CLASSES
# ================================
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'email', 'username', 'full_name', 'get_verification_status', 
        'get_block_status', 'get_balance_summary', 'is_active', 'created_at'
    )
    list_filter = (
        'is_verified', 'is_blocked', 'is_active', 'is_staff', 
        'gender', 'country', 'created_at'
    )
    search_fields = ('email', 'username', 'first_name', 'last_name', 'phone_no')
    ordering = ('-created_at',)
    readonly_fields = (
        'created_at', 'updated_at', 'last_login', 'verification_date',
        'get_total_portfolio_value', 'get_activity_summary'
    )
    actions = [
        'verify_users', 'unverify_users', 'block_users', 'unblock_users',
        'export_users_csv', 'credit_btc_balance', 'debit_btc_balance',
        'credit_ethereum_balance', 'debit_ethereum_balance',
        'credit_usdt_balance', 'debit_usdt_balance',
        'credit_litecoin_balance', 'debit_litecoin_balance',
        'credit_tron_balance', 'debit_tron_balance',
        'reset_balances', 'send_bulk_notification'
    ]
    
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': (
            'first_name', 'last_name', 'phone_no', 'profile_pic', 
            'gender', 'address', 'country', 'state'
        )}),
        ('Wallet Addresses', {'fields': (
            'btc_wallet', 'ethereum_wallet', 'usdt_wallet', 
            'litecoin_wallet', 'tron_wallet', 'currency_type'
        )}),
        ('Wallet Balances', {'fields': (
            'btc_balance', 'ethereum_balance', 'usdt_balance', 
            'litecoin_balance', 'tron_balance'
        )}),
        ('Permissions', {'fields': (
            'is_active', 'is_staff', 'is_superuser', 'is_blocked', 
            'is_verified', 'groups', 'user_permissions'
        )}),
        ('Important dates', {'fields': (
            'last_login', 'created_at', 'updated_at', 'verification_date'
        )}),
        ('KYC Documents', {'fields': ('id_document',)}),
        ('Analytics', {'fields': (
            'get_total_portfolio_value', 'get_activity_summary'
        ), 'classes': ('collapse',)}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email', 'username', 'first_name', 'last_name', 
                'password1', 'password2', 'is_staff', 'is_active'
            )}
        ),
    )
    
    inlines = [UserActivityInline, TransactionInline, PortfolioInline, OrderInline]

    def full_name(self, obj):
        return obj.full_name
    full_name.short_description = 'Full Name' # type: ignore

    def get_verification_status(self, obj):
        if obj.is_verified:
            return format_html('<span style="color: green;">✓ Verified</span>')
        elif obj.id_document:
            return format_html('<span style="color: orange;">⏳ Pending Review</span>')
        else:
            return format_html('<span style="color: red;">✗ Not Verified</span>')
    get_verification_status.short_description = 'KYC Status' # type: ignore

    def get_block_status(self, obj):
        if obj.is_blocked:
            return format_html('<span style="color: red;">🚫 Blocked</span>')
        return format_html('<span style="color: green;">✅ Active</span>')
    get_block_status.short_description = 'Status' # type: ignore

    def get_balance_summary(self, obj):
        balances = []
        if obj.btc_balance > 0:
            balances.append(f"₿{float(obj.btc_balance):.4f}")
        if obj.ethereum_balance > 0:
            balances.append(f"Ξ{float(obj.ethereum_balance):.4f}")
        if obj.usdt_balance > 0:
            balances.append(f"${float(obj.usdt_balance):.2f}")
        
        if balances:
            return ", ".join(balances)
        return format_html('<span style="color: gray;">No Balance</span>')
    get_balance_summary.short_description = 'Balances' # type: ignore

    def get_total_portfolio_value(self, obj):
        """Calculate total portfolio value for the user"""
        total_value = sum([
            float(obj.btc_balance) * float(getattr(Cryptocurrency.objects.filter(symbol='BTC').first(), 'current_price', 0)),
            float(obj.ethereum_balance) * float(getattr(Cryptocurrency.objects.filter(symbol='ETH').first(), 'current_price', 0)),
            float(obj.usdt_balance),  # USDT is 1:1 with USD
            float(obj.litecoin_balance) * float(getattr(Cryptocurrency.objects.filter(symbol='LTC').first(), 'current_price', 0)),
            float(obj.tron_balance) * float(getattr(Cryptocurrency.objects.filter(symbol='TRX').first(), 'current_price', 0)),
        ])
        return f"${total_value:,.2f}"
    get_total_portfolio_value.short_description = 'Total Portfolio Value' # type: ignore

    def get_activity_summary(self, obj):
        """Show user activity summary"""
        activities = obj.activities.all()[:5]
        if activities:
            summary = []
            for activity in activities:
                summary.append(f"{activity.timestamp.strftime('%Y-%m-%d %H:%M')} - {activity.activity_type}")
            return format_html('<br>'.join(summary))
        return "No recent activity"
    get_activity_summary.short_description = 'Recent Activity' # type: ignore

    # ================================
    # USER MANAGEMENT ACTIONS
    # ================================
    
    def verify_users(self, request, queryset):
        updated_count = 0
        for user in queryset:
            if not user.is_verified:
                user.is_verified = True
                user.verification_date = timezone.now()
                user.save()
                updated_count += 1
                
                # Send KYC approval email
                AdminEmailService.send_kyc_approved_notification(user)
        
        self.message_user(
            request, 
            f"✅ Successfully verified {updated_count} users and sent approval emails.", 
            messages.SUCCESS
        )
    verify_users.short_description = "✅ Verify selected users" # type: ignore

    def unverify_users(self, request, queryset):
        updated_count = 0
        for user in queryset:
            if user.is_verified:
                user.is_verified = False
                user.verification_date = None
                user.save()
                updated_count += 1
                
                # Send KYC update email
                AdminEmailService.send_kyc_update_notification(user, "Revoked")
        
        self.message_user(
            request, 
            f"❌ Successfully unverified {updated_count} users.", 
            messages.WARNING
        )
    unverify_users.short_description = "❌ Unverify selected users" # type: ignore

    def block_users(self, request, queryset):
        for user in queryset:
            user.block_user()
        self.message_user(request, f"🚫 Successfully blocked {queryset.count()} users.", messages.ERROR)
    block_users.short_description = "🚫 Block selected users"

    def unblock_users(self, request, queryset):
        for user in queryset:
            user.unblock_user()
        self.message_user(request, f"✅ Successfully unblocked {queryset.count()} users.", messages.SUCCESS)
    unblock_users.short_description = "✅ Unblock selected users"

    # ================================
    # BALANCE MANAGEMENT ACTIONS
    # ================================
    
    def _credit_balance(self, request, queryset, crypto_type, amount, crypto_name):
        """Generic credit balance function"""
        success_count = 0
        for user in queryset:
            balance_field = f"{crypto_type.lower()}_balance"
            if hasattr(user, balance_field):
                current_balance = getattr(user, balance_field)
                setattr(user, balance_field, current_balance + amount)
                user.save()
                
                # Create transaction record
                transaction = Transaction.objects.create(
                    user=user,
                    transaction_type='DEPOSIT',
                    cryptocurrency=crypto_type,
                    quantity=amount,
                    status='COMPLETED',
                    completed_at=timezone.now(),
                    description=f'Admin credit - {crypto_name}'
                )
                
                # Send balance credit notification
                AdminEmailService.send_balance_credit_notification(user, amount, crypto_type)
                success_count += 1
        
        self.message_user(
            request, 
            f"💰 Successfully credited {amount} {crypto_name} to {success_count} users.", 
            messages.SUCCESS
        )

    def _debit_balance(self, request, queryset, crypto_type, amount, crypto_name):
        """Generic debit balance function"""
        success_count = 0
        for user in queryset:
            balance_field = f"{crypto_type.lower()}_balance"
            if hasattr(user, balance_field):
                current_balance = getattr(user, balance_field)
                if current_balance >= amount:
                    setattr(user, balance_field, current_balance - amount)
                    user.save()
                    
                    # Create transaction record
                    Transaction.objects.create(
                        user=user,
                        transaction_type='WITHDRAWAL',
                        cryptocurrency=crypto_type,
                        quantity=amount,
                        status='COMPLETED',
                        completed_at=timezone.now(),
                        description=f'Admin debit - {crypto_name}'
                    )
                    success_count += 1
                else:
                    self.message_user(
                        request, 
                        f"User {user.email} has insufficient {crypto_name} balance", 
                        messages.WARNING
                    )
        
        self.message_user(
            request, 
            f"💸 Successfully debited {amount} {crypto_name} from {success_count} users.", 
            messages.SUCCESS
        )

    def credit_btc_balance(self, request, queryset):
        self._credit_balance(request, queryset, 'BTC', 0.1, 'BTC')
    credit_btc_balance.short_description = "💰 Credit 0.1 BTC"

    def debit_btc_balance(self, request, queryset):
        self._debit_balance(request, queryset, 'BTC', 0.1, 'BTC')
    debit_btc_balance.short_description = "💸 Debit 0.1 BTC"

    def credit_ethereum_balance(self, request, queryset):
        self._credit_balance(request, queryset, 'ETH', 0.1, 'ETH')
    credit_ethereum_balance.short_description = "💰 Credit 0.1 ETH"

    def debit_ethereum_balance(self, request, queryset):
        self._debit_balance(request, queryset, 'ETH', 0.1, 'ETH')
    debit_ethereum_balance.short_description = "💸 Debit 0.1 ETH"

    def credit_usdt_balance(self, request, queryset):
        self._credit_balance(request, queryset, 'USDT', 100, 'USDT')
    credit_usdt_balance.short_description = "💰 Credit 100 USDT"

    def debit_usdt_balance(self, request, queryset):
        self._debit_balance(request, queryset, 'USDT', 100, 'USDT')
    debit_usdt_balance.short_description = "💸 Debit 100 USDT"

    def credit_litecoin_balance(self, request, queryset):
        self._credit_balance(request, queryset, 'LTC', 1.0, 'LTC')
    credit_litecoin_balance.short_description = "💰 Credit 1.0 LTC"

    def debit_litecoin_balance(self, request, queryset):
        self._debit_balance(request, queryset, 'LTC', 1.0, 'LTC')
    debit_litecoin_balance.short_description = "💸 Debit 1.0 LTC"

    def credit_tron_balance(self, request, queryset):
        self._credit_balance(request, queryset, 'TRX', 100.0, 'TRX')
    credit_tron_balance.short_description = "💰 Credit 100 TRX"

    def debit_tron_balance(self, request, queryset):
        self._debit_balance(request, queryset, 'TRX', 100.0, 'TRX')
    debit_tron_balance.short_description = "💸 Debit 100 TRX"

    def reset_balances(self, request, queryset):
        """Reset all balances to zero"""
        for user in queryset:
            user.btc_balance = 0
            user.ethereum_balance = 0
            user.usdt_balance = 0
            user.litecoin_balance = 0
            user.tron_balance = 0
            user.save()
        
        self.message_user(
            request, 
            f"🔄 Successfully reset balances for {queryset.count()} users.", 
            messages.SUCCESS
        )
    reset_balances.short_description = "🔄 Reset all balances to zero"

    def send_bulk_notification(self, request, queryset):
        """Send bulk notification to selected users"""
        self.message_user(
            request, 
            f"📧 Prepared to send notifications to {queryset.count()} users.", 
            messages.INFO
        )
    send_bulk_notification.short_description = "📧 Send bulk notification"

    def export_users_csv(self, request, queryset):
        field_names = [
            'Email', 'Username', 'Full Name', 'Phone', 'Country', 
            'BTC Balance', 'ETH Balance', 'USDT Balance', 
            'LTC Balance', 'TRX Balance', 'Verified', 'Blocked', 
            'Active', 'Joined Date'
        ]
        return export_to_csv(self, request, queryset, field_names, "users")
    export_users_csv.short_description = "📄 Export selected users to CSV"


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_transaction_type', 'get_cryptocurrency', 
        'get_quantity', 'get_total_amount', 'get_status_badge', 
        'get_created_date', 'get_completed_date'
    )
    list_filter = ('transaction_type', 'status', 'cryptocurrency', 'created_at')
    search_fields = ('user__email', 'user__username', 'transaction_hash', 'wallet_address')
    readonly_fields = ('created_at', 'updated_at', 'completed_at')
    actions = [
        'mark_deposit_completed', 'mark_withdrawal_completed', 
        'mark_processing', 'mark_failed', 'mark_cancelled',
        'export_transactions_csv', 'bulk_complete_deposits', 'bulk_complete_withdrawals'
    ]
    date_hierarchy = 'created_at'
    
    fieldsets = (
        ('Transaction Details', {'fields': (
            'user', 'transaction_type', 'cryptocurrency', 'status'
        )}),
        ('Amount Details', {'fields': (
            'quantity', 'price_per_unit', 'total_amount', 
            'fiat_amount', 'currency'
        )}),
        ('Fees & References', {'fields': (
            'network_fee', 'platform_fee', 'transaction_hash', 'wallet_address'
        )}),
        ('Timestamps', {'fields': (
            'created_at', 'updated_at', 'completed_at'
        )}),
    )

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User'
    get_user_email.admin_order_field = 'user__email'

    def get_transaction_type(self, obj):
        type_icons = {
            'DEPOSIT': '💰',
            'WITHDRAWAL': '💸',
            'BUY': '🟢',
            'SELL': '🔴'
        }
        icon = type_icons.get(obj.transaction_type, '📄')
        return f"{icon} {obj.get_transaction_type_display()}"
    get_transaction_type.short_description = 'Type'
    get_transaction_type.admin_order_field = 'transaction_type'

    def get_cryptocurrency(self, obj):
        crypto_icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'LTC': 'Ł',
            'TRX': '⚡'
        }
        icon = crypto_icons.get(obj.cryptocurrency, '🔷')
        return f"{icon} {obj.get_cryptocurrency_display()}"
    get_cryptocurrency.short_description = 'Crypto'
    get_cryptocurrency.admin_order_field = 'cryptocurrency'

    def get_quantity(self, obj):
        if obj.quantity:
            return f"{obj.quantity:.8f} {obj.cryptocurrency}"
        return f"${obj.fiat_amount:.2f} {obj.currency}"
    get_quantity.short_description = 'Amount'

    def get_total_amount(self, obj):
        if obj.total_amount:
            return f"${obj.total_amount:.2f}"
        return "-"
    get_total_amount.short_description = 'Total'

    def get_status_badge(self, obj):
        status_colors = {
            'PENDING': 'orange',
            'COMPLETED': 'green',
            'FAILED': 'red',
            'CANCELLED': 'gray',
            'PROCESSING': 'blue'
        }
        status_icons = {
            'PENDING': '⏳',
            'COMPLETED': '✅',
            'FAILED': '❌',
            'CANCELLED': '🚫',
            'PROCESSING': '🔄'
        }
        color = status_colors.get(obj.status, 'black')
        icon = status_icons.get(obj.status, '📄')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color,
            icon,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status'
    get_status_badge.admin_order_field = 'status'

    def get_created_date(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    get_created_date.short_description = 'Created'
    get_created_date.admin_order_field = 'created_at'

    def get_completed_date(self, obj):
        if obj.completed_at:
            return obj.completed_at.strftime('%Y-%m-%d %H:%M')
        return "-"
    get_completed_date.short_description = 'Completed'

    # ================================
    # TRANSACTION ACTIONS
    # ================================
    
    def mark_deposit_completed(self, request, queryset):
        """Mark deposits as completed and credit user balances"""
        deposits = queryset.filter(transaction_type='DEPOSIT', status='PENDING')
        completed_count = 0
        
        for transaction in deposits:
            # Update user balance based on cryptocurrency
            user = transaction.user
            crypto_field = f"{transaction.cryptocurrency.lower()}_balance"
            
            if hasattr(user, crypto_field) and transaction.quantity:
                current_balance = getattr(user, crypto_field)
                setattr(user, crypto_field, current_balance + transaction.quantity)
                user.save()
                
                transaction.status = 'COMPLETED'
                transaction.completed_at = timezone.now()
                transaction.save()
                completed_count += 1
                
                # Send deposit notification email using template
                AdminEmailService.send_deposit_notification(user, transaction)
        
        self.message_user(
            request, 
            f"✅ Successfully completed {completed_count} deposits and credited user wallets.", 
            messages.SUCCESS
        )
    mark_deposit_completed.short_description = "✅ Confirm Deposit & Credit Wallet"

    def mark_withdrawal_completed(self, request, queryset):
        """Mark withdrawals as completed and debit user balances"""
        withdrawals = queryset.filter(transaction_type='WITHDRAWAL', status='PENDING')
        completed_count = 0
        
        for transaction in withdrawals:
            # Verify user has sufficient balance before completing withdrawal
            user = transaction.user
            crypto_field = f"{transaction.cryptocurrency.lower()}_balance"
            
            if hasattr(user, crypto_field) and transaction.quantity:
                current_balance = getattr(user, crypto_field)
                if current_balance >= transaction.quantity:
                    setattr(user, crypto_field, current_balance - transaction.quantity)
                    user.save()
                    
                    transaction.status = 'COMPLETED'
                    transaction.completed_at = timezone.now()
                    transaction.save()
                    completed_count += 1
                    
                    # Send withdrawal notification email using template
                    AdminEmailService.send_withdrawal_notification(user, transaction)
                else:
                    self.message_user(
                        request, 
                        f"❌ User {user.email} has insufficient balance for withdrawal", 
                        messages.ERROR
                    )
        
        self.message_user(
            request, 
            f"✅ Successfully completed {completed_count} withdrawals.", 
            messages.SUCCESS
        )
    mark_withdrawal_completed.short_description = "✅ Mark Withdrawal as Completed"

    def bulk_complete_deposits(self, request, queryset):
        """Bulk complete multiple deposits"""
        self.mark_deposit_completed(request, queryset)
    bulk_complete_deposits.short_description = "💰 Bulk Complete Deposits"

    def bulk_complete_withdrawals(self, request, queryset):
        """Bulk complete multiple withdrawals"""
        self.mark_withdrawal_completed(request, queryset)
    bulk_complete_withdrawals.short_description = "💸 Bulk Complete Withdrawals"

    def mark_processing(self, request, queryset):
        updated = queryset.update(status='PROCESSING')
        self.message_user(request, f"🔄 Marked {updated} transactions as processing.", messages.INFO)
    mark_processing.short_description = "🔄 Mark as Processing"

    def mark_failed(self, request, queryset):
        updated = queryset.update(status='FAILED')
        self.message_user(request, f"❌ Marked {updated} transactions as failed.", messages.ERROR)
    mark_failed.short_description = "❌ Mark as Failed"

    def mark_cancelled(self, request, queryset):
        updated = queryset.update(status='CANCELLED')
        self.message_user(request, f"🚫 Marked {updated} transactions as cancelled.", messages.WARNING)
    mark_cancelled.short_description = "🚫 Mark as Cancelled" # type: ignore

    def export_transactions_csv(self, request, queryset):
        field_names = [
            'User Email', 'Type', 'Cryptocurrency', 'Quantity', 'Total Amount',
            'Status', 'Transaction Hash', 'Wallet Address', 'Created At', 'Completed At'
        ]
        return export_to_csv(self, request, queryset, field_names, "transactions")
    export_transactions_csv.short_description = "📄 Export transactions to CSV" # type: ignore



@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_order_type', 'get_side', 'get_cryptocurrency',
        'get_quantity', 'get_price', 'get_filled', 'get_status_badge', 
        'get_created_date'
    )
    list_filter = ('order_type', 'side', 'cryptocurrency', 'status', 'created_at')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'filled_at')
    actions = [
        'cancel_orders', 'export_orders_csv', 'bulk_cancel_orders',
        'mark_orders_filled', 'mark_orders_expired'
    ]
    date_hierarchy = 'created_at'

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User'
    get_user_email.admin_order_field = 'user__email'

    def get_order_type(self, obj):
        type_icons = {
            'MARKET': '⚡',
            'LIMIT': '🎯',
            'STOP_LOSS': '🛑',
            'TAKE_PROFIT': '🎯'
        }
        icon = type_icons.get(obj.order_type, '📄')
        return f"{icon} {obj.get_order_type_display()}"
    get_order_type.short_description = 'Order Type'
    get_order_type.admin_order_field = 'order_type'

    def get_side(self, obj):
        if obj.side == 'BUY':
            return format_html('<span style="color: green;">🟢 BUY</span>')
        else:
            return format_html('<span style="color: red;">🔴 SELL</span>')
    get_side.short_description = 'Side'
    get_side.admin_order_field = 'side'

    def get_cryptocurrency(self, obj):
        crypto_icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'LTC': 'Ł',
            'TRX': '⚡'
        }
        icon = crypto_icons.get(obj.cryptocurrency, '🔷')
        return f"{icon} {obj.get_cryptocurrency_display()}"
    get_cryptocurrency.short_description = 'Crypto'
    get_cryptocurrency.admin_order_field = 'cryptocurrency'

    def get_quantity(self, obj):
        return f"{obj.quantity:.8f}"
    get_quantity.short_description = 'Quantity'

    def get_price(self, obj):
        if obj.price:
            return f"${obj.price:.2f}"
        return "Market"
    get_price.short_description = 'Price'

    def get_filled(self, obj):
        if obj.quantity > 0:
            fill_percentage = (obj.filled_quantity / obj.quantity) * 100
            return f"{obj.filled_quantity:.8f} ({fill_percentage:.1f}%)"
        return "0"
    get_filled.short_description = 'Filled'

    def get_status_badge(self, obj):
        status_colors = {
            'OPEN': 'blue',
            'FILLED': 'green',
            'CANCELLED': 'red',
            'PARTIALLY_FILLED': 'orange',
            'EXPIRED': 'gray'
        }
        status_icons = {
            'OPEN': '📈',
            'FILLED': '✅',
            'CANCELLED': '❌',
            'PARTIALLY_FILLED': '🟡',
            'EXPIRED': '⏰'
        }
        color = status_colors.get(obj.status, 'black')
        icon = status_icons.get(obj.status, '📄')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {}</span>',
            color,
            icon,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status'
    get_status_badge.admin_order_field = 'status'

    def get_created_date(self, obj):
        return obj.created_at.strftime('%Y-%m-%d %H:%M')
    get_created_date.short_description = 'Created'
    get_created_date.admin_order_field = 'created_at'

    def cancel_orders(self, request, queryset):
        cancelled_count = 0
        for order in queryset:
            if order.status in ['OPEN', 'PARTIALLY_FILLED']:
                order.status = 'CANCELLED'
                order.save()
                cancelled_count += 1
        self.message_user(
            request, 
            f"❌ Successfully cancelled {cancelled_count} orders.", 
            messages.SUCCESS
        )
    cancel_orders.short_description = "❌ Cancel selected orders"

    def bulk_cancel_orders(self, request, queryset):
        """Bulk cancel multiple orders"""
        self.cancel_orders(request, queryset)
    bulk_cancel_orders.short_description = "🚫 Bulk Cancel Orders"

    def mark_orders_filled(self, request, queryset):
        """Mark orders as filled"""
        filled_count = 0
        for order in queryset:
            if order.status in ['OPEN', 'PARTIALLY_FILLED']:
                order.status = 'FILLED'
                order.filled_quantity = order.quantity
                order.filled_at = timezone.now()
                order.save()
                filled_count += 1
        self.message_user(
            request, 
            f"✅ Successfully marked {filled_count} orders as filled.", 
            messages.SUCCESS
        )
    mark_orders_filled.short_description = "✅ Mark as Filled"

    def mark_orders_expired(self, request, queryset):
        """Mark orders as expired"""
        expired_count = 0
        for order in queryset:
            if order.status in ['OPEN', 'PARTIALLY_FILLED']:
                order.status = 'EXPIRED'
                order.save()
                expired_count += 1
        self.message_user(
            request, 
            f"⏰ Successfully marked {expired_count} orders as expired.", 
            messages.WARNING
        )
    mark_orders_expired.short_description = "⏰ Mark as Expired"

    def export_orders_csv(self, request, queryset):
        field_names = [
            'User Email', 'Order Type', 'Side', 'Cryptocurrency', 'Quantity',
            'Price', 'Filled Quantity', 'Status', 'Created At', 'Filled At'
        ]
        return export_to_csv(self, request, queryset, field_names, "orders")
    export_orders_csv.short_description = "📄 Export orders to CSV"


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_cryptocurrency', 'get_total_quantity', 
        'get_current_value', 'get_profit_loss', 'get_last_updated'
    )
    list_filter = ('cryptocurrency', 'last_updated')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('last_updated',)
    actions = ['export_portfolio_csv']
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User'
    get_user_email.admin_order_field = 'user__email'

    def get_cryptocurrency(self, obj):
        crypto_icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'LTC': 'Ł',
            'TRX': '⚡'
        }
        icon = crypto_icons.get(obj.cryptocurrency, '🔷')
        return f"{icon} {obj.get_cryptocurrency_display()}"
    get_cryptocurrency.short_description = 'Cryptocurrency'
    get_cryptocurrency.admin_order_field = 'cryptocurrency'

    def get_total_quantity(self, obj):
        return f"{obj.total_quantity:.8f}"
    get_total_quantity.short_description = 'Quantity'

    def get_current_value(self, obj):
        return f"${float(obj.current_value):.2f}"
    get_current_value.short_description = 'Current Value'

    def get_profit_loss(self, obj):
        color = 'green' if obj.profit_loss >= 0 else 'red'
        icon = '📈' if obj.profit_loss >= 0 else '📉'
        profit_loss_value = f"${float(obj.profit_loss):.2f}"
        profit_loss_percentage = f"{float(obj.profit_loss_percentage):.2f}%"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} {} ({})</span>',
            color,
            icon,
            profit_loss_value,
            profit_loss_percentage
        )
    get_profit_loss.short_description = 'Profit/Loss'

    def get_last_updated(self, obj):
        return obj.last_updated.strftime('%Y-%m-%d %H:%M')
    get_last_updated.short_description = 'Last Updated'
    get_last_updated.admin_order_field = 'last_updated'

    def export_portfolio_csv(self, request, queryset):
        field_names = [
            'User Email', 'Cryptocurrency', 'Total Quantity', 'Average Buy Price',
            'Total Invested', 'Current Value', 'Profit Loss', 'Profit Loss Percentage',
            'Last Updated'
        ]
        return export_to_csv(self, request, queryset, field_names, "portfolio")
    export_portfolio_csv.short_description = "📄 Export portfolio to CSV"


@admin.register(Cryptocurrency)
class CryptocurrencyAdmin(admin.ModelAdmin):
    list_display = (
        'get_symbol', 'name', 'get_current_price', 'get_price_change', 
        'get_market_cap', 'rank', 'get_active_status', 'last_updated'
    )
    list_filter = ('is_active', 'last_updated')
    search_fields = ('symbol', 'name')
    readonly_fields = ('last_updated',)
    ordering = ('rank',)
    actions = ['export_cryptocurrencies_csv', 'update_prices', 'toggle_active_status']
    
    def get_symbol(self, obj):
        crypto_icons = {
            'BTC': '₿',
            'ETH': 'Ξ',
            'USDT': '💵',
            'LTC': 'Ł',
            'TRX': '⚡'
        }
        icon = crypto_icons.get(obj.symbol, '🔷')
        return f"{icon} {obj.symbol}"
    get_symbol.short_description = 'Symbol'
    get_symbol.admin_order_field = 'symbol'

    def get_current_price(self, obj):
        return f"${float(obj.current_price):.2f}"
    get_current_price.short_description = 'Current Price'
    get_current_price.admin_order_field = 'current_price'

    def get_price_change(self, obj):
        color = 'green' if obj.price_change_24h >= 0 else 'red'
        arrow = '↗' if obj.price_change_24h >= 0 else '↘'
        return format_html(
            '<span style="color: {};">{} ${:.2f} ({:.2f}%)</span>',
            color,
            arrow,
            float(obj.price_change_24h),
            float(obj.price_change_percentage_24h)
        )
    get_price_change.short_description = '24h Change'

    def get_market_cap(self, obj):
        if obj.market_cap >= 10**9:  # Billions
            return f"${float(obj.market_cap)/10**9:.2f}B"
        elif obj.market_cap >= 10**6:  # Millions
            return f"${float(obj.market_cap)/10**6:.2f}M"
        else:
            return f"${float(obj.market_cap):.2f}"
    get_market_cap.short_description = 'Market Cap'
    get_market_cap.admin_order_field = 'market_cap'

    def get_active_status(self, obj):
        if obj.is_active:
            return format_html('<span style="color: green;">✅ Active</span>')
        return format_html('<span style="color: red;">❌ Inactive</span>')
    get_active_status.short_description = 'Status'

    def update_prices(self, request, queryset):
        """Simulate price updates (would integrate with real API in production)"""
        for crypto in queryset:
            # This is a placeholder - integrate with real API like CoinGecko
            # crypto.update_price_from_api()
            self.message_user(
                request, 
                f"Price update functionality ready for {crypto.symbol}. Integrate with API.", 
                messages.INFO
            )
    update_prices.short_description = "🔄 Update Prices from API"

    def toggle_active_status(self, request, queryset):
        """Toggle active status of cryptocurrencies"""
        for crypto in queryset:
            crypto.is_active = not crypto.is_active
            crypto.save()
        
        active_count = queryset.filter(is_active=True).count()
        inactive_count = queryset.count() - active_count
        
        self.message_user(
            request, 
            f"✅ Toggled status: {active_count} active, {inactive_count} inactive.", 
            messages.SUCCESS
        )
    toggle_active_status.short_description = "🔄 Toggle Active Status"

    def export_cryptocurrencies_csv(self, request, queryset):
        field_names = [
            'Symbol', 'Name', 'Current Price', 'Price Change 24h', 
            'Price Change Percentage 24h', 'Market Cap', 'Volume 24h',
            'Circulating Supply', 'Total Supply', 'Max Supply', 'Rank', 'Active'
        ]
        return export_to_csv(self, request, queryset, field_names, "cryptocurrencies")
    export_cryptocurrencies_csv.short_description = "📄 Export cryptocurrencies to CSV"


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'get_cryptocurrency', 'get_price', 'get_volume', 'get_market_cap', 
        'get_timestamp'
    )
    list_filter = ('cryptocurrency', 'timestamp')
    search_fields = ('cryptocurrency__symbol', 'cryptocurrency__name')
    readonly_fields = ('created_at',)
    date_hierarchy = 'timestamp'
    actions = ['export_price_history_csv']

    def get_cryptocurrency(self, obj):
        return obj.cryptocurrency.symbol
    get_cryptocurrency.short_description = 'Cryptocurrency'
    get_cryptocurrency.admin_order_field = 'cryptocurrency__symbol'

    def get_price(self, obj):
        return f"${float(obj.price):.2f}"
    get_price.short_description = 'Price'
    get_price.admin_order_field = 'price'

    def get_volume(self, obj):
        if obj.volume >= 10**9:  # Billions
            return f"${float(obj.volume)/10**9:.2f}B"
        elif obj.volume >= 10**6:  # Millions
            return f"${float(obj.volume)/10**6:.2f}M"
        else:
            return f"${float(obj.volume):.2f}"
    get_volume.short_description = 'Volume'

    def get_market_cap(self, obj):
        if obj.market_cap >= 10**9:  # Billions
            return f"${float(obj.market_cap)/10**9:.2f}B"
        elif obj.market_cap >= 10**6:  # Millions
            return f"${float(obj.market_cap)/10**6:.2f}M"
        else:
            return f"${float(obj.market_cap):.2f}"
    get_market_cap.short_description = 'Market Cap'

    def get_timestamp(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M')
    get_timestamp.short_description = 'Timestamp'
    get_timestamp.admin_order_field = 'timestamp'

    def export_price_history_csv(self, request, queryset):
        field_names = [
            'Cryptocurrency', 'Price', 'Volume', 'Market Cap', 'Timestamp'
        ]
        return export_to_csv(self, request, queryset, field_names, "price_history")
    export_price_history_csv.short_description = "📄 Export price history to CSV"


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_activity_type', 'get_description', 
        'get_ip_address', 'get_timestamp'
    )
    list_filter = ('activity_type', 'timestamp')
    search_fields = ('user__email', 'user__username', 'ip_address', 'description')
    readonly_fields = ('user', 'activity_type', 'description', 'ip_address', 'user_agent', 'timestamp')
    date_hierarchy = 'timestamp'
    actions = ['export_activities_csv']

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User'
    get_user_email.admin_order_field = 'user__email'

    def get_activity_type(self, obj):
        activity_icons = {
            'LOGIN': '🔐',
            'LOGOUT': '🚪',
            'TRADE': '💱',
            'DEPOSIT': '💰',
            'WITHDRAWAL': '💸',
            'PROFILE_UPDATE': '👤',
            'PASSWORD_CHANGE': '🔑'
        }
        icon = activity_icons.get(obj.activity_type, '📄')
        return f"{icon} {obj.get_activity_type_display()}"
    get_activity_type.short_description = 'Activity Type'
    get_activity_type.admin_order_field = 'activity_type'

    def get_description(self, obj):
        return obj.description[:80] + '...' if len(obj.description) > 80 else obj.description
    get_description.short_description = 'Description'

    def get_ip_address(self, obj):
        return obj.ip_address or 'N/A'
    get_ip_address.short_description = 'IP Address'

    def get_timestamp(self, obj):
        return obj.timestamp.strftime('%Y-%m-%d %H:%M')
    get_timestamp.short_description = 'Timestamp'
    get_timestamp.admin_order_field = 'timestamp'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def export_activities_csv(self, request, queryset):
        field_names = [
            'User Email', 'Activity Type', 'Description', 'IP Address', 'Timestamp'
        ]
        return export_to_csv(self, request, queryset, field_names, "user_activities")
    export_activities_csv.short_description = "📄 Export activities to CSV" # type: ignore


# ================================
# SIMPLE MODELS ADMIN
# ================================
@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)

@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('name', 'country')
    list_filter = ('country',)
    search_fields = ('name', 'country__name')