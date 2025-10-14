from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid
from django.core.validators import MinValueValidator


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        """
        Create and return a regular user with an email and password.
        """
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create and return a superuser with an email and password.
        """
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

class CustomUser(AbstractBaseUser, PermissionsMixin):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
        ('N', 'Prefer not to say'),
    ]

    # Basic user fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, max_length=255)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=30)
    last_name = models.CharField(max_length=30)
    
    # Wallet addresses
    btc_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="BTC Wallet Address")
    ethereum_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Ethereum Wallet Address")
    usdt_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="USDT Wallet Address")
    litecoin_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Litecoin Wallet Address")
    tron_wallet = models.CharField(max_length=255, blank=True, null=True, verbose_name="Tron Wallet Address")
    
    # Wallet balances
    btc_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    ethereum_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0) # type: ignore
    usdt_balance = models.DecimalField(max_digits=20, decimal_places=2, default=0.0)# type: ignore
    litecoin_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0)# type: ignore
    tron_balance = models.DecimalField(max_digits=20, decimal_places=8, default=0.0)# type: ignore
    
    # Personal information 
    phone_no = models.CharField(max_length=20, blank=True, null=True)
    profile_pic = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    
    # Status fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_blocked = models.BooleanField(default=False)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(blank=True, null=True)
    
    # KYC Verification fields
    is_verified = models.BooleanField(default=False)
    id_document = models.FileField(upload_to='kyc_documents/', blank=True, null=True)
    verification_date = models.DateTimeField(blank=True, null=True)
    
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

    def get_short_name(self):
        return self.first_name

    def block_user(self):
        """Block the user account"""
        self.is_blocked = True
        self.is_active = False
        self.save()

    def unblock_user(self):
        """Unblock the user account"""
        self.is_blocked = False
        self.is_active = True
        self.save()

class UserActivity(models.Model):
    ACTIVITY_TYPES = [
        ('LOGIN', 'User Login'),
        ('LOGOUT', 'User Logout'),
        ('TRADE', 'Trade Execution'),
        ('DEPOSIT', 'Funds Deposit'),
        ('WITHDRAWAL', 'Funds Withdrawal'),
        ('PROFILE_UPDATE', 'Profile Update'),
    ]

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
        return f"{self.user.email} - {self.activity_type} at {self.timestamp}"

class Cryptocurrency(models.Model):
    """Model to store cryptocurrency market data"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    symbol = models.CharField(max_length=10, unique=True, verbose_name="Symbol")
    name = models.CharField(max_length=100, verbose_name="Cryptocurrency Name")
    current_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Current Price (USD)"
    )
    price_change_24h = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="24h Price Change"
    )
    price_change_percentage_24h = models.DecimalField(
        max_digits=10, 
        decimal_places=4, 
        default=0.0, # type: ignore
        verbose_name="24h Price Change %"
    )
    market_cap = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        default=0.0, # type: ignore
        verbose_name="Market Cap"
    )
    volume_24h = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        default=0.0, # type: ignore
        verbose_name="24h Volume"
    )
    circulating_supply = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        default=0.0, # type: ignore
        verbose_name="Circulating Supply"
    )
    total_supply = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        default=0.0, # type: ignore
        verbose_name="Total Supply"
    )
    max_supply = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        null=True, 
        blank=True,
        verbose_name="Max Supply"
    )
    rank = models.IntegerField(default=0, verbose_name="Market Cap Rank")
    is_active = models.BooleanField(default=True, verbose_name="Active")
    last_updated = models.DateTimeField(auto_now=True, verbose_name="Last Updated")

    class Meta:
        db_table = 'cryptocurrencies'
        verbose_name = 'Cryptocurrency'
        verbose_name_plural = 'Cryptocurrencies'
        ordering = ['rank']

    def __str__(self):
        return f"{self.name} ({self.symbol})"

    def get_price_change_direction(self):
        """Returns 'up', 'down', or 'neutral' based on price change"""
        if self.price_change_24h > 0:
            return 'up'
        elif self.price_change_24h < 0:
            return 'down'
        return 'neutral'

class PriceHistory(models.Model):
    """Model to store historical price data for cryptocurrencies"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cryptocurrency = models.ForeignKey(
        Cryptocurrency, 
        on_delete=models.CASCADE, 
        related_name='price_history'
    )
    price = models.DecimalField(max_digits=20, decimal_places=8, verbose_name="Price")
    volume = models.DecimalField(max_digits=30, decimal_places=2, verbose_name="Volume")
    market_cap = models.DecimalField(
        max_digits=30, 
        decimal_places=2, 
        default=0.0, # type: ignore
        verbose_name="Market Cap"
    )
    timestamp = models.DateTimeField(verbose_name="Timestamp")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    class Meta:
        db_table = 'price_history'
        verbose_name = 'Price History'
        verbose_name_plural = 'Price Histories'
        indexes = [
            models.Index(fields=['cryptocurrency', 'timestamp']),
            models.Index(fields=['timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.cryptocurrency.symbol} - ${self.price} at {self.timestamp}"

class Transaction(models.Model):
    """Model to represent user trading transactions"""
    TRANSACTION_TYPES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
        ('DEPOSIT', 'Deposit'),
        ('WITHDRAWAL', 'Withdrawal'),
        ('TRANSFER', 'Transfer'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
        ('PROCESSING', 'Processing'),
    ]

    CRYPTO_CHOICES = [
        ('BTC', 'Bitcoin'),
        ('ETH', 'Ethereum'),
        ('USDT', 'Tether'),
        ('LTC', 'Litecoin'),
        ('TRX', 'Tron'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20, 
        choices=TRANSACTION_TYPES,
        verbose_name="Transaction Type"
    )
    cryptocurrency = models.CharField(
        max_length=10, 
        choices=CRYPTO_CHOICES,
        verbose_name="Cryptocurrency"
    )
    
    # For BUY/SELL transactions
    quantity = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0)],
        null=True, 
        blank=True,
        verbose_name="Quantity"
    )
    price_per_unit = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0)],
        null=True, 
        blank=True,
        verbose_name="Price Per Unit"
    )
    total_amount = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0)],
        default=0.0, # type: ignore
        verbose_name="Total Amount"
    )
    
    # For DEPOSIT/WITHDRAWAL transactions
    fiat_amount = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        validators=[MinValueValidator(0)], 
        null=True, 
        blank=True,
        verbose_name="Fiat Amount"
    )
    currency = models.CharField(max_length=10, default='USD', verbose_name="Currency")
    
    # Transaction details
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='PENDING',
        verbose_name="Status"
    )
    transaction_hash = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name="Transaction Hash"
    )
    wallet_address = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name="Wallet Address"
    )
    network_fee = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Network Fee"
    )
    platform_fee = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Platform Fee"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="Completed At")

    class Meta:
        db_table = 'transactions'
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['transaction_type', 'status']),
            models.Index(fields=['cryptocurrency', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.transaction_type} {self.cryptocurrency}"

    def save(self, *args, **kwargs):
        # Calculate total amount for buy/sell transactions
        if self.transaction_type in ['BUY', 'SELL'] and self.quantity and self.price_per_unit:
            self.total_amount = self.quantity * self.price_per_unit
        
        # Set completed_at timestamp when status changes to COMPLETED
        if self.status == 'COMPLETED' and not self.completed_at:
            from django.utils import timezone
            self.completed_at = timezone.now()
        
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('transaction-detail', kwargs={'pk': self.pk})

class Order(models.Model):
    """Model to represent trading orders (for advanced trading features)"""
    ORDER_TYPES = [
        ('MARKET', 'Market Order'),
        ('LIMIT', 'Limit Order'),
        ('STOP_LOSS', 'Stop Loss'),
        ('TAKE_PROFIT', 'Take Profit'),
    ]

    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('FILLED', 'Filled'),
        ('CANCELLED', 'Cancelled'),
        ('PARTIALLY_FILLED', 'Partially Filled'),
        ('EXPIRED', 'Expired'),
    ]

    SIDE_CHOICES = [
        ('BUY', 'Buy'),
        ('SELL', 'Sell'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name='orders'
    )
    order_type = models.CharField(max_length=20, choices=ORDER_TYPES, verbose_name="Order Type")
    side = models.CharField(max_length=10, choices=SIDE_CHOICES, verbose_name="Side")
    cryptocurrency = models.CharField(
        max_length=10, 
        choices=Transaction.CRYPTO_CHOICES,
        verbose_name="Cryptocurrency"
    )
    
    quantity = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0.00000001)],
        verbose_name="Quantity"
    )
    price = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0)],
        null=True, 
        blank=True,
        verbose_name="Price"
    )
    stop_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        validators=[MinValueValidator(0)],
        null=True, 
        blank=True,
        verbose_name="Stop Price"
    )
    filled_quantity = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Filled Quantity"
    )
    average_filled_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Average Filled Price"
    )
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='OPEN',
        verbose_name="Status"
    )
    
    # Time in force
    time_in_force = models.CharField(
        max_length=20, 
        default='GTC',  # Good Till Cancelled
        choices=[
            ('GTC', 'Good Till Cancelled'),
            ('IOC', 'Immediate or Cancel'),
            ('FOK', 'Fill or Kill'),
        ],
        verbose_name="Time in Force"
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="Expires At")
    filled_at = models.DateTimeField(null=True, blank=True, verbose_name="Filled At")

    class Meta:
        db_table = 'orders'
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['cryptocurrency', 'order_type']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.side} {self.order_type} {self.cryptocurrency}"

    @property
    def remaining_quantity(self):
        return self.quantity - self.filled_quantity

    @property
    def is_completed(self):
        return self.status == 'FILLED'

    @property
    def is_active(self):
        return self.status in ['OPEN', 'PARTIALLY_FILLED']

    def cancel_order(self):
        """Cancel the order if it's still active"""
        if self.is_active:
            self.status = 'CANCELLED'
            self.save()

class Portfolio(models.Model):
    """Model to track user's cryptocurrency portfolio"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        CustomUser, 
        on_delete=models.CASCADE, 
        related_name='portfolio'
    )
    cryptocurrency = models.CharField(
        max_length=10, 
        choices=Transaction.CRYPTO_CHOICES,
        verbose_name="Cryptocurrency"
    )
    total_quantity = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Total Quantity"
    )
    average_buy_price = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Average Buy Price"
    )
    total_invested = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Total Invested"
    )
    current_value = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Current Value"
    )
    profit_loss = models.DecimalField(
        max_digits=20, 
        decimal_places=8, 
        default=0.0, # type: ignore
        verbose_name="Profit/Loss"
    )
    profit_loss_percentage = models.DecimalField(
        max_digits=10, 
        decimal_places=4, 
        default=0.0, # type: ignore
        verbose_name="Profit/Loss %"
    )
    last_updated = models.DateTimeField(auto_now=True, verbose_name="Last Updated")

    class Meta:
        db_table = 'portfolio'
        verbose_name = 'Portfolio'
        verbose_name_plural = 'Portfolios'
        unique_together = ['user', 'cryptocurrency']
        indexes = [
            models.Index(fields=['user', 'cryptocurrency']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.cryptocurrency} Portfolio"

    def update_portfolio_value(self, current_price):
        """Update portfolio value based on current market price"""
        self.current_value = self.total_quantity * current_price
        self.profit_loss = self.current_value - self.total_invested
        if self.total_invested > 0:
            self.profit_loss_percentage = (self.profit_loss / self.total_invested) * 100
        else:
            self.profit_loss_percentage = 0.0
        self.save()