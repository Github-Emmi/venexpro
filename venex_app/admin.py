from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.http import HttpResponse
import csv
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib import messages
from django.utils.html import format_html
from .models import (
    CustomUser, UserActivity, Cryptocurrency, PriceHistory, 
    Transaction, Order, Portfolio
)


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
    readonly_fields = ('transaction_type', 'cryptocurrency', 'quantity', 'total_amount', 'status', 'created_at')
    can_delete = False
    show_change_link = True
    
    def has_add_permission(self, request, obj=None):
        return False


class PortfolioInline(admin.TabularInline):
    model = Portfolio
    extra = 0
    readonly_fields = ('cryptocurrency', 'total_quantity', 'current_value', 'profit_loss', 'last_updated')
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


class OrderInline(admin.TabularInline):
    model = Order
    extra = 0
    readonly_fields = ('order_type', 'side', 'cryptocurrency', 'quantity', 'status', 'created_at')
    can_delete = False
    show_change_link = True
    
    def has_add_permission(self, request, obj=None):
        return False


def send_transaction_email(user, transaction, subject_template, message_template):
    """Send email notification for transaction updates"""
    try:
        subject = subject_template.format(
            type=transaction.get_transaction_type_display(),
            crypto=transaction.get_cryptocurrency_display(),
            amount=transaction.quantity or transaction.fiat_amount
        )
        
        message = message_template.format(
            user=user.get_full_name(),
            type=transaction.get_transaction_type_display(),
            crypto=transaction.get_cryptocurrency_display(),
            amount=transaction.quantity or transaction.fiat_amount,
            status=transaction.get_status_display(),
            transaction_id=transaction.id
        )
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Email sending failed: {e}")
        return False


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'email', 'username', 'full_name', 'is_verified', 'is_blocked', 
        'btc_balance', 'ethereum_balance', 'usdt_balance', 'is_active', 'created_at'
    )
    list_filter = (
        'is_verified', 'is_blocked', 'is_active', 'is_staff', 
        'gender', 'created_at'
    )
    search_fields = ('email', 'username', 'first_name', 'last_name', 'phone_no')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'last_login', 'verification_date')
    actions = [
        'verify_users', 'unverify_users', 'block_users', 'unblock_users',
        'export_users_csv', 'credit_btc_balance', 'debit_btc_balance',
        'credit_ethereum_balance', 'debit_ethereum_balance',
        'credit_usdt_balance', 'debit_usdt_balance'
    ]
    
    fieldsets = (
        (None, {'fields': ('email', 'username', 'password')}),
        ('Personal Info', {'fields': (
            'first_name', 'last_name', 'phone_no', 'profile_pic', 
            'gender', 'address'
        )}),
        ('Wallet Addresses', {'fields': (
            'btc_wallet', 'ethereum_wallet', 'usdt_wallet', 
            'litecoin_wallet', 'tron_wallet'
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

    # User Management Actions
    def verify_users(self, request, queryset):
        updated = queryset.update(is_verified=True, verification_date=timezone.now())
        self.message_user(request, f"Successfully verified {updated} users.")
    verify_users.short_description = "✅ Verify selected users" # type: ignore

    def unverify_users(self, request, queryset):
        updated = queryset.update(is_verified=False, verification_date=None)
        self.message_user(request, f"Successfully unverified {updated} users.")
    unverify_users.short_description = "❌ Unverify selected users" # type: ignore

    def block_users(self, request, queryset):
        for user in queryset:
            user.block_user()
        self.message_user(request, f"Successfully blocked {queryset.count()} users.")
    block_users.short_description = "🚫 Block selected users" # type: ignore

    def unblock_users(self, request, queryset):
        for user in queryset:
            user.unblock_user()
        self.message_user(request, f"Successfully unblocked {queryset.count()} users.")
    unblock_users.short_description = "✅ Unblock selected users" # type: ignore

    # Balance Management Actions
    def credit_btc_balance(self, request, queryset):
        for user in queryset:
            user.btc_balance += 0.1
            user.save()
            
            # Create deposit transaction
            transaction = Transaction.objects.create(
                user=user,
                transaction_type='DEPOSIT',
                cryptocurrency='BTC',
                quantity=0.1,
                status='COMPLETED',
                description='Admin credit'
            )
            
            # Send email notification
            send_transaction_email(
                user, transaction,
                "BTC Deposit Credited - {amount} BTC",
                "Hello {user},\n\nYour BTC wallet has been credited with {amount} BTC.\n\nTransaction ID: {transaction_id}\n\nThank you for using our service!"
            )
            
        self.message_user(request, f"Successfully credited 0.1 BTC to {queryset.count()} users.")
    credit_btc_balance.short_description = "💰 Credit 0.1 BTC to selected users" # type: ignore

    def debit_btc_balance(self, request, queryset):
        for user in queryset:
            if user.btc_balance >= 0.1:
                user.btc_balance -= 0.1
                user.save()
        self.message_user(request, f"Successfully debited 0.1 BTC from {queryset.count()} users.")
    debit_btc_balance.short_description = "💸 Debit 0.1 BTC from selected users" # type: ignore

    def credit_ethereum_balance(self, request, queryset):
        for user in queryset:
            user.ethereum_balance += 0.1
            user.save()
        self.message_user(request, f"Successfully credited 0.1 ETH to {queryset.count()} users.")
    credit_ethereum_balance.short_description = "💰 Credit 0.1 ETH to selected users" # type: ignore

    def debit_ethereum_balance(self, request, queryset):
        for user in queryset:
            if user.ethereum_balance >= 0.1:
                user.ethereum_balance -= 0.1
                user.save()
        self.message_user(request, f"Successfully debited 0.1 ETH from {queryset.count()} users.")
    debit_ethereum_balance.short_description = "💸 Debit 0.1 ETH from selected users" # type: ignore

    def credit_usdt_balance(self, request, queryset):
        for user in queryset:
            user.usdt_balance += 100
            user.save()
        self.message_user(request, f"Successfully credited 100 USDT to {queryset.count()} users.")
    credit_usdt_balance.short_description = "💰 Credit 100 USDT to selected users" # type: ignore

    def debit_usdt_balance(self, request, queryset):
        for user in queryset:
            if user.usdt_balance >= 100:
                user.usdt_balance -= 100
                user.save()
        self.message_user(request, f"Successfully debited 100 USDT from {queryset.count()} users.")
    debit_usdt_balance.short_description = "💸 Debit 100 USDT from selected users" # type: ignore

    def export_users_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="users.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'Email', 'Username', 'Full Name', 'Phone', 'BTC Balance', 
            'ETH Balance', 'USDT Balance', 'Verified', 'Blocked', 'Joined Date'
        ])
        
        for user in queryset:
            writer.writerow([
                user.email, user.username, user.full_name, user.phone_no,
                user.btc_balance, user.ethereum_balance, user.usdt_balance,
                user.is_verified, user.is_blocked, user.created_at
            ])
        
        return response
    export_users_csv.short_description = "📄 Export selected users to CSV" # type: ignore


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_transaction_type', 'get_cryptocurrency', 
        'get_quantity', 'get_total_amount', 'get_status_badge', 'created_at'
    )
    list_filter = ('transaction_type', 'status', 'cryptocurrency', 'created_at')
    search_fields = ('user__email', 'user__username', 'transaction_hash', 'wallet_address')
    readonly_fields = ('created_at', 'updated_at', 'completed_at')
    actions = [
        'mark_deposit_completed', 'mark_withdrawal_completed', 
        'mark_processing', 'mark_failed', 'export_transactions_csv'
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
    get_user_email.short_description = 'User' # type: ignore
    get_user_email.admin_order_field = 'user__email' # type: ignore

    def get_transaction_type(self, obj):
        return obj.get_transaction_type_display()
    get_transaction_type.short_description = 'Type' # type: ignore
    get_transaction_type.admin_order_field = 'transaction_type' # type: ignore

    def get_cryptocurrency(self, obj):
        return obj.get_cryptocurrency_display()
    get_cryptocurrency.short_description = 'Crypto' # type: ignore
    get_cryptocurrency.admin_order_field = 'cryptocurrency' # type: ignore

    def get_quantity(self, obj):
        if obj.quantity:
            return f"{obj.quantity} {obj.cryptocurrency}"
        return f"{obj.fiat_amount} {obj.currency}"
    get_quantity.short_description = 'Amount' # type: ignore

    def get_total_amount(self, obj):
        if obj.total_amount:
            return f"${obj.total_amount:.2f}"
        return "-"
    get_total_amount.short_description = 'Total' # type: ignore

    def get_status_badge(self, obj):
        status_colors = {
            'PENDING': 'orange',
            'COMPLETED': 'green',
            'FAILED': 'red',
            'CANCELLED': 'gray',
            'PROCESSING': 'blue'
        }
        color = status_colors.get(obj.status, 'black')
        return format_html( # type: ignore
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status' # type: ignore
    get_status_badge.admin_order_field = 'status' # type: ignore

    # Transaction Actions
    def mark_deposit_completed(self, request, queryset):
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
                transaction.save()
                completed_count += 1
                
                # Send email notification
                send_transaction_email(
                    user, transaction,
                    "Deposit Completed - {amount} {crypto}",
                    "Hello {user},\n\nYour deposit of {amount} {crypto} has been completed and credited to your wallet.\n\nTransaction ID: {transaction_id}\n\nThank you for using our service!"
                )
        
        self.message_user(request, f"Successfully completed {completed_count} deposits.")
    mark_deposit_completed.short_description = "✅ Confirm Deposit & Credit Wallet" # type: ignore

    def mark_withdrawal_completed(self, request, queryset):
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
                    transaction.save()
                    completed_count += 1
                    
                    # Send email notification
                    send_transaction_email(
                        user, transaction,
                        "Withdrawal Completed - {amount} {crypto}",
                        "Hello {user},\n\nYour withdrawal of {amount} {crypto} has been processed and sent to your wallet.\n\nTransaction ID: {transaction_id}\n\nThank you for using our service!"
                    )
                else:
                    self.message_user(
                        request, 
                        f"User {user.email} has insufficient balance for withdrawal", 
                        messages.ERROR
                    )
        
        self.message_user(request, f"Successfully completed {completed_count} withdrawals.")
    mark_withdrawal_completed.short_description = "✅ Mark Withdrawal as Completed" # type: ignore

    def mark_processing(self, request, queryset):
        updated = queryset.update(status='PROCESSING')
        self.message_user(request, f"Marked {updated} transactions as processing.")
    mark_processing.short_description = "🔄 Mark as Processing" # type: ignore

    def mark_failed(self, request, queryset):
        updated = queryset.update(status='FAILED')
        self.message_user(request, f"Marked {updated} transactions as failed.")
    mark_failed.short_description = "❌ Mark as Failed" # type: ignore

    def export_transactions_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="transactions.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'User Email', 'Type', 'Cryptocurrency', 'Quantity', 'Total Amount',
            'Status', 'Transaction Hash', 'Created At', 'Completed At'
        ])
        
        for transaction in queryset:
            writer.writerow([
                transaction.user.email,
                transaction.get_transaction_type_display(),
                transaction.get_cryptocurrency_display(),
                transaction.quantity,
                transaction.total_amount,
                transaction.get_status_display(),
                transaction.transaction_hash,
                transaction.created_at,
                transaction.completed_at
            ])
        
        return response
    export_transactions_csv.short_description = "📄 Export transactions to CSV" # type: ignore


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_order_type', 'get_side', 'get_cryptocurrency',
        'quantity', 'price', 'get_status_badge', 'created_at'
    )
    list_filter = ('order_type', 'side', 'cryptocurrency', 'status', 'created_at')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('created_at', 'updated_at', 'filled_at')
    actions = ['cancel_orders', 'export_orders_csv']
    date_hierarchy = 'created_at'

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User' # type: ignore
    get_user_email.admin_order_field = 'user__email' # type: ignore

    def get_order_type(self, obj):
        return obj.get_order_type_display()
    get_order_type.short_description = 'Order Type' # type: ignore
    get_order_type.admin_order_field = 'order_type' # type: ignore

    def get_side(self, obj):
        return obj.get_side_display()
    get_side.short_description = 'Side' # type: ignore
    get_side.admin_order_field = 'side' # type: ignore

    def get_cryptocurrency(self, obj):
        return obj.get_cryptocurrency_display()
    get_cryptocurrency.short_description = 'Crypto' # type: ignore
    get_cryptocurrency.admin_order_field = 'cryptocurrency' # type: ignore

    def get_status_badge(self, obj):
        status_colors = {
            'OPEN': 'blue',
            'FILLED': 'green',
            'CANCELLED': 'red',
            'PARTIALLY_FILLED': 'orange',
            'EXPIRED': 'gray'
        }
        color = status_colors.get(obj.status, 'black')
        return format_html( # type: ignore
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )
    get_status_badge.short_description = 'Status' # type: ignore
    get_status_badge.admin_order_field = 'status' # type: ignore

    def cancel_orders(self, request, queryset):
        cancelled_count = 0
        for order in queryset:
            if order.is_active:
                order.cancel_order()
                cancelled_count += 1
        self.message_user(request, f"Successfully cancelled {cancelled_count} orders.")
    cancel_orders.short_description = "❌ Cancel selected orders" # type: ignore

    def export_orders_csv(self, request, queryset):
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="orders.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'User Email', 'Order Type', 'Side', 'Cryptocurrency', 'Quantity',
            'Price', 'Filled Quantity', 'Status', 'Created At'
        ])
        
        for order in queryset:
            writer.writerow([
                order.user.email,
                order.get_order_type_display(),
                order.get_side_display(),
                order.get_cryptocurrency_display(),
                order.quantity,
                order.price,
                order.filled_quantity,
                order.get_status_display(),
                order.created_at
            ])
        
        return response
    export_orders_csv.short_description = "📄 Export orders to CSV" # type: ignore


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'get_cryptocurrency', 'total_quantity', 
        'current_value', 'get_profit_loss', 'last_updated'
    )
    list_filter = ('cryptocurrency', 'last_updated')
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('last_updated',)
    
    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User' # type: ignore
    get_user_email.admin_order_field = 'user__email' # type: ignore

    def get_cryptocurrency(self, obj):
        return obj.get_cryptocurrency_display()
    get_cryptocurrency.short_description = 'Cryptocurrency' # type: ignore
    get_cryptocurrency.admin_order_field = 'cryptocurrency' # type: ignore

    def get_profit_loss(self, obj):
        color = 'green' if obj.profit_loss >= 0 else 'red'
        profit_loss_value = f"${float(obj.profit_loss):.2f}"
        profit_loss_percentage = f"{float(obj.profit_loss_percentage):.2f}%"
        return format_html( # type: ignore
            '<span style="color: {}; font-weight: bold;">{} ({})</span>',
            color,
            profit_loss_value,
            profit_loss_percentage
        )
    get_profit_loss.short_description = 'Profit/Loss' # type: ignore


@admin.register(Cryptocurrency)
class CryptocurrencyAdmin(admin.ModelAdmin):
    list_display = (
        'symbol', 'name', 'current_price', 'price_change_percentage_24h', 
        'market_cap', 'rank', 'is_active', 'last_updated'
    )
    list_filter = ('is_active', 'last_updated')
    search_fields = ('symbol', 'name')
    readonly_fields = ('last_updated',)
    ordering = ('rank',)
    
    def get_price_change(self, obj):
        color = 'green' if obj.price_change_24h >= 0 else 'red'
        arrow = '↗' if obj.price_change_24h >= 0 else '↘'
        return format_html( # type: ignore
            '<span style="color: {};">{} ${:.2f} ({:.2f}%)</span>',
            color,
            arrow,
            float(obj.price_change_24h),
            float(obj.price_change_percentage_24h)
        )
    get_price_change.short_description = '24h Change' # type: ignore


@admin.register(PriceHistory)
class PriceHistoryAdmin(admin.ModelAdmin):
    list_display = (
        'get_cryptocurrency', 'price', 'volume', 'market_cap', 'timestamp'
    )
    list_filter = ('cryptocurrency', 'timestamp')
    search_fields = ('cryptocurrency__symbol', 'cryptocurrency__name')
    readonly_fields = ('created_at',)
    date_hierarchy = 'timestamp'

    def get_cryptocurrency(self, obj):
        return obj.cryptocurrency.symbol
    get_cryptocurrency.short_description = 'Cryptocurrency' # type: ignore
    get_cryptocurrency.admin_order_field = 'cryptocurrency__symbol' # type: ignore


@admin.register(UserActivity)
class UserActivityAdmin(admin.ModelAdmin):
    list_display = (
        'get_user_email', 'activity_type', 'get_description', 
        'ip_address', 'timestamp'
    )
    list_filter = ('activity_type', 'timestamp')
    search_fields = ('user__email', 'user__username', 'ip_address', 'description')
    readonly_fields = ('user', 'activity_type', 'description', 'ip_address', 'user_agent', 'timestamp')
    date_hierarchy = 'timestamp'

    def get_user_email(self, obj):
        return obj.user.email
    get_user_email.short_description = 'User' # type: ignore
    get_user_email.admin_order_field = 'user__email' # type: ignore

    def get_description(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    get_description.short_description = 'Description' # type: ignore

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False