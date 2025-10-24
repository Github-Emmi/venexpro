from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid
from django.core.validators import MinValueValidator
from .choices import *
from datetime import timedelta
from django.db.models import Sum
from decimal import Decimal


# ------------------------
# Custom User Manager
# ------------------------
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


# ------------------------
# Country and State Models
# ------------------------
class Country(models.Model):
    # remove the manual id definition
    name = models.CharField('country name', max_length=55, unique=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Countries"


class State(models.Model):
    name = models.CharField('state name', max_length=55)
    country = models.ForeignKey(Country, on_delete=models.CASCADE)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "States"

# ------------------------
# Custom User Model
# ------------------------
class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True,verbose_name="Country")
    state = models.ForeignKey('State', on_delete=models.SET_NULL, null=True, blank=True,verbose_name="State/Province")

    # Wallet Addresses and currency type
    btc_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="BTC Wallet Address")
    ethereum_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Ethereum Wallet Address")
    usdt_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="USDT Wallet Address")
    litecoin_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Litecoin Wallet Address")
    tron_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Tron Wallet Address")
    currency_type = models.CharField(max_length=97, choices=Currency, default='USD')

    # Wallet Balances
    btc_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    ethereum_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    usdt_balance = models.DecimalField(max_digits=20, decimal_places=2, default=0.0) # type: ignore
    litecoin_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    tron_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore

    # Personal Information
    phone_no = models.CharField(max_length=20, blank=True, null=True)
    profile_pic = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True)
    address = models.TextField(blank=True, null=True)

    # Account Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)

    # KYC Verification
    is_verified = models.BooleanField(default=False)
    id_document = models.FileField(upload_to='kyc_documents/', blank=True, null=True)
    verification_date = models.DateTimeField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(blank=True, null=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    class Meta:
        db_table = 'custom_users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def block_user(self):
        self.is_blocked = True
        self.is_active = False
        self.save()

    def unblock_user(self):
        self.is_blocked = False
        self.is_active = True
        self.save()

    def get_total_portfolio_value(self):
        """Calculate total portfolio value across all cryptocurrencies"""
        portfolio_items = Portfolio.objects.filter(user=self)
        return sum(float(item.current_value) for item in portfolio_items)

    def get_portfolio_distribution(self):
        """Get portfolio distribution for dashboard"""
        portfolio = Portfolio.objects.filter(user=self)
        distribution = []
        for item in portfolio:
            distribution.append({
                'symbol': item.cryptocurrency,
                'quantity': item.total_quantity,
                'value': item.current_value,
                'profit_loss_percentage': item.profit_loss_percentage
            })
        return distribution

    def get_crypto_balance(self, crypto_symbol):
        """Get balance for specific cryptocurrency"""
        balances = {
            'BTC': self.btc_balance,
            'ETH': self.ethereum_balance,
            'USDT': self.usdt_balance,
            'LTC': self.litecoin_balance,
            'TRX': self.tron_balance
        }
        return balances.get(crypto_symbol, Decimal('0.0'))



# ------------------------
# User Activity
# ------------------------
class UserActivity(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_activities'
        verbose_name = 'User Activity'
        verbose_name_plural = 'User Activities'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.email} - {self.activity_type}"


# ------------------------
# Cryptocurrency Data
# ------------------------
class Cryptocurrency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    symbol = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    get_cryptocurrency_display = models.CharField(max_length=10, choices=TRANSACTION_TYPES, default='')
    current_price = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore # type: ignore
    price_change_24h = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    price_change_percentage_24h = models.DecimalField(max_digits=10, decimal_places=4, default=0.0) # type: ignore
    market_cap = models.DecimalField(max_digits=30, decimal_places=2, default=0.0) # type: ignore
    volume_24h = models.DecimalField(max_digits=30, decimal_places=2, default=0.0) # type: ignore
    circulating_supply = models.DecimalField(max_digits=30, decimal_places=2, default=0.0) # type: ignore
    total_supply = models.DecimalField(max_digits=30, decimal_places=2, default=0.0) # type: ignore
    max_supply = models.DecimalField(max_digits=30, decimal_places=2, null=True, blank=True)
    rank = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cryptocurrencies'
        verbose_name_plural = 'Cryptocurrencies'
        ordering = ['rank']

    def __str__(self):
        return f"{self.name} ({self.symbol})"


# ------------------------
# Price History
# ------------------------
class PriceHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cryptocurrency = models.ForeignKey(Cryptocurrency, on_delete=models.CASCADE, related_name='price_history')
    price = models.DecimalField(max_digits=20, decimal_places=8)
    volume = models.DecimalField(max_digits=30, decimal_places=2)
    market_cap = models.DecimalField(max_digits=30, decimal_places=2, default=0.0) # type: ignore
    timestamp = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'price_history'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.cryptocurrency.symbol} - ${self.price} at {self.timestamp}"


# ------------------------
# Transactions
# ------------------------
class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='transactions')
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    cryptocurrency = models.ForeignKey(Cryptocurrency, on_delete=models.SET_NULL, null=True,blank=True,related_name='transactions')
    quantity = models.DecimalField(max_digits=20, decimal_places=8, validators=[MinValueValidator(0)], null=True, blank=True)
    price_per_unit = models.DecimalField(max_digits=20, decimal_places=8, validators=[MinValueValidator(0)], null=True, blank=True)
    total_amount = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    fiat_amount = models.DecimalField(max_digits=15, decimal_places=2, validators=[MinValueValidator(0)], null=True, blank=True)
    currency = models.CharField(max_length=10, choices=Currency)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    transaction_hash = models.CharField(max_length=255, blank=True, null=True)
    wallet_address = models.CharField(max_length=255, blank=True, null=True)
    network_fee = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    platform_fee = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.transaction_type} {self.cryptocurrency}"

    def save(self, *args, **kwargs):
        if self.transaction_type in ['BUY', 'SELL'] and self.quantity and self.price_per_unit:
            self.total_amount = self.quantity * self.price_per_unit
        if self.status == 'COMPLETED' and not self.completed_at:
            self.completed_at = timezone.now()
        super().save(*args, **kwargs)


# ------------------------
# Orders
# ------------------------
class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='orders')
    order_type = models.CharField(max_length=20, choices=ORDER_TYPES)
    side = models.CharField(max_length=10, choices=SIDE_CHOICES)
    cryptocurrency = models.CharField(max_length=10, choices=CRYPTO_CHOICES)
    quantity = models.DecimalField(max_digits=20, decimal_places=8, validators=[MinValueValidator(0.00000001)])
    price = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    stop_price = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    filled_quantity = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    average_filled_price = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    status = models.CharField(max_length=20, choices=ORDER_STATUS_CHOICES, default='OPEN')
    time_in_force = models.CharField(max_length=20, choices=TIME_IN_FORCE_CHOICES, default='GTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    filled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.side} {self.order_type} {self.cryptocurrency}"


# ------------------------
# Portfolio
# ------------------------
class Portfolio(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='portfolios')
    cryptocurrency = models.CharField(max_length=10, choices=CRYPTO_CHOICES)
    currency_type = models.CharField(max_length=97, choices=Currency, default='USD')  # Fixed field name
    total_quantity = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    average_buy_price = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    total_invested = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    current_value = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    profit_loss = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    profit_loss_percentage = models.DecimalField(max_digits=10, decimal_places=4, default=0.0) # type: ignore
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'portfolio'
        unique_together = ['user', 'cryptocurrency']
        ordering = ['user']

    def __str__(self):
        return f"{self.user.email} - {self.cryptocurrency} Portfolio"

    def update_portfolio_value(self, current_price=None):
        """Update portfolio values based on current market price"""
        if current_price is None:
            # Try to get current price from Cryptocurrency model
            try:
                crypto = Cryptocurrency.objects.get(symbol=self.cryptocurrency)
                current_price = crypto.current_price
            except Cryptocurrency.DoesNotExist:
                current_price = self.average_buy_price

        self.current_value = self.total_quantity * current_price
        self.profit_loss = self.current_value - self.total_invested
        if self.total_invested > 0:
            self.profit_loss_percentage = (self.profit_loss / self.total_invested) * 100
        else:
            self.profit_loss_percentage = Decimal('0.0')
        self.save()


class PortfolioHolding(models.Model):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='holdings')
    cryptocurrency = models.ForeignKey(Cryptocurrency, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    average_buy_price = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    total_cost = models.DecimalField(max_digits=20, decimal_places=2, default=0.0) # type: ignore
    current_value = models.DecimalField(max_digits=20, decimal_places=2, default=0.0) # type: ignore
    unrealized_pl = models.DecimalField(max_digits=20, decimal_places=2, default=0.0) # type: ignore
    unrealized_pl_percentage = models.DecimalField(max_digits=10, decimal_places=4, default=0.0) # type: ignore
    allocation_percentage = models.DecimalField(max_digits=10, decimal_places=4, default=0.0) # type: ignore
    
    class Meta:
        db_table = 'portfolio_holdings'
        unique_together = ['portfolio', 'cryptocurrency']

class PortfolioHistory(models.Model):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='history')
    total_value = models.DecimalField(max_digits=20, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'portfolio_history'
        verbose_name_plural = 'Portfolio History'
        ordering = ['-timestamp']


# ------------------------
# Password Reset Code Model
# ------------------------
class PasswordResetCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='reset_codes')
    code = models.CharField(max_length=6)  # 6-digit code
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        db_table = 'password_reset_codes'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.code}"

    def is_valid(self):
        """Check if the code is still valid"""
        return not self.is_used and timezone.now() < self.expires_at

    def mark_used(self):
        """Mark the code as used"""
        self.is_used = True
        self.save()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            # Set expiration to 15 minutes from creation
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)