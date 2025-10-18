from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator, MinValueValidator
from .models import CustomUser, Country, State, PasswordResetCode, Transaction, Order
from django.contrib.auth.forms import PasswordResetForm as DjangoPasswordResetForm
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from django.contrib.auth.password_validation import validate_password
import re
from .choices import *

class SignUpForm(forms.ModelForm):
    # Basic information
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your E-mail Address',
            'required': 'required'
        })
    )
    
    username = forms.CharField(
        max_length=150,
        validators=[
            RegexValidator(
                regex='^[A-Za-z0-9_\-]+$',
                message='Username should contain only English letters, numbers, underscores, and hyphens.'
            )
        ],
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your User Name',
            'required': 'required'
        })
    )
    
    first_name = forms.CharField(
        max_length=30,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your First Name',
            'required': 'required'
        })
    )
    
    last_name = forms.CharField(
        max_length=30,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your Last Name',
            'required': 'required'
        })
    )
    
    # Location information
    country = forms.ModelChoiceField(
        queryset=Country.objects.all().order_by('name'),
        empty_label="Select Your Country",
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'country-select',
            'required': 'required'
        })
    )
    
    state = forms.ModelChoiceField(
        queryset=State.objects.none(),  # Will be populated via AJAX
        empty_label="Select Your State",
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'state-select',
            'required': 'required'
        })
    )
    
    # Currency selection
    currency_type = forms.ChoiceField(
        choices=[],  # Will be populated from model choices
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': 'required'
        })
    )
    
    # Contact information
    phone_no = forms.CharField(
        max_length=20,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Phone Number (Optional)'
        })
    )
    
    # Security
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Define Password',
            'required': 'required'
        }),
        validators=[validate_password]
    )
    
    password_confirm = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Retype Password',
            'required': 'required'
        })
    )
    
    # Terms agreement
    agree_terms = forms.BooleanField(
        required=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
            'required': 'required'
        })
    )

    class Meta:
        model = CustomUser
        fields = [
            'email', 'username', 'first_name', 'last_name', 
            'country', 'state', 'currency_type', 'phone_no', 'password'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Populate currency choices from the model
        self.fields['currency_type'].choices = Currency
        
        # If we have a country in the data, update state queryset
        if 'country' in self.data:
            try:
                country_id = int(self.data.get('country')) ## type: ignore
                self.fields['state'].queryset = State.objects.filter(country_id=country_id).order_by('name')  ## type: ignore
            except (ValueError, TypeError):
                pass

    def clean_email(self):
        email = self.cleaned_data.get('email').lower().strip()  ## type: ignore
        if CustomUser.objects.filter(email=email).exists():
            raise ValidationError("A user with this email already exists.")
        return email

    def clean_username(self):
        username = self.cleaned_data.get('username').strip()  ## type: ignore
        if CustomUser.objects.filter(username=username).exists():
            raise ValidationError("A user with this username already exists.")
        return username

    def clean_password(self):
        password = self.cleaned_data.get('password')
        # Django's built-in password validation
        validate_password(password) ## type: ignore
        return password

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')
        
        if password and password_confirm and password != password_confirm:
            raise ValidationError("Passwords do not match.")
        
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        
        if commit:
            user.save()
        return user
    
class ContactForm(forms.Form):
    """
    Contact form for user inquiries
    """
    name = forms.CharField(
        max_length=100,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your Full Name',
            'required': 'required',
        })
    )
    
    email = forms.EmailField(
        max_length=255,
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Your Email Address',
            'required': 'required',
        })
    )
    
    subject = forms.CharField(
        max_length=200,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Subject',
            'required': 'required',
        })
    )
    
    message = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Your message...',
            'rows': 5,
            'required': 'required',
        })
    )
    
    def clean_name(self):
        name = self.cleaned_data.get('name').strip() ## type: ignore
        if len(name) < 2:
            raise ValidationError("Please enter your full name.")
        return name
    
    def clean_message(self):
        message = self.cleaned_data.get('message').strip() ## type: ignore
        if len(message) < 10:
            raise ValidationError("Please provide a more detailed message (at least 10 characters).")
        return message
    
class PasswordResetRequestForm(forms.Form):
    email = forms.EmailField(
        max_length=255,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your email address',
            'required': True,
        })
    )

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if not CustomUser.objects.filter(email=email, is_active=True).exists():
            raise forms.ValidationError("No account found with this email address.")
        return email

class PasswordResetCodeForm(forms.Form):
    code = forms.CharField(
        max_length=6,
        min_length=6,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter 6-digit code',
            'required': True,
            'maxlength': '6',
        }),
        validators=[
            RegexValidator(
                regex=r'^\d{6}$',
                message='Code must be exactly 6 digits.'
            )
        ]
    )

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)

    def clean_code(self):
        code = self.cleaned_data.get('code')
        if self.user:
            try:
                reset_code = PasswordResetCode.objects.get(
                    user=self.user,
                    code=code,
                    is_used=False
                )
                if not reset_code.is_valid():
                    raise forms.ValidationError("This code has expired or is invalid.")
            except PasswordResetCode.DoesNotExist:
                raise forms.ValidationError("Invalid reset code.")
        return code

class PasswordResetConfirmForm(forms.Form):
    new_password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter new password',
            'required': True,
        }),
        help_text="Password must be at least 8 characters long."
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Confirm new password',
            'required': True,
        })
    )

    def clean(self):
        cleaned_data = super().clean()
        new_password = cleaned_data.get('new_password')
        confirm_password = cleaned_data.get('confirm_password')

        if new_password and confirm_password and new_password != confirm_password:
            raise forms.ValidationError("Passwords don't match.")

        return cleaned_data
    
# ================================
# TRADING FORMS
# ================================

class BuyCryptoForm(forms.Form):
    """Form for buying cryptocurrency"""
    cryptocurrency = forms.ChoiceField(
        choices=CRYPTO_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'buy-crypto-select',
            'required': True,
        })
    )
    quantity = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'required': True,
        })
    )
    price_type = forms.ChoiceField(
        choices=[('MARKET', 'Market Price'), ('LIMIT', 'Limit Price')],
        initial='MARKET',
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'buy-price-type',
        })
    )
    limit_price = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        required=False,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'id': 'buy-limit-price',
        })
    )
    total_amount = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'readonly': True,
            'id': 'buy-total-amount',
        })
    )

    def clean(self):
        cleaned_data = super().clean()
        price_type = cleaned_data.get('price_type')
        limit_price = cleaned_data.get('limit_price')
        quantity = cleaned_data.get('quantity')

        if price_type == 'LIMIT' and not limit_price:
            raise forms.ValidationError("Limit price is required for limit orders.")

        if quantity and quantity <= 0:
            raise forms.ValidationError("Quantity must be greater than zero.")

        return cleaned_data

class SellCryptoForm(forms.Form):
    """Form for selling cryptocurrency"""
    cryptocurrency = forms.ChoiceField(
        choices=CRYPTO_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'sell-crypto-select',
            'required': True,
        })
    )
    quantity = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'required': True,
        })
    )
    price_type = forms.ChoiceField(
        choices=[('MARKET', 'Market Price'), ('LIMIT', 'Limit Price')],
        initial='MARKET',
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'sell-price-type',
        })
    )
    limit_price = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        required=False,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'id': 'sell-limit-price',
        })
    )
    total_amount = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        required=False,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'readonly': True,
            'id': 'sell-total-amount',
        })
    )

    def clean(self):
        cleaned_data = super().clean()
        cryptocurrency = cleaned_data.get('cryptocurrency')
        quantity = cleaned_data.get('quantity')
        price_type = cleaned_data.get('price_type')
        limit_price = cleaned_data.get('limit_price')

        if price_type == 'LIMIT' and not limit_price:
            raise forms.ValidationError("Limit price is required for limit orders.")

        if quantity and quantity <= 0:
            raise forms.ValidationError("Quantity must be greater than zero.")

        return cleaned_data

class LimitOrderForm(forms.ModelForm):
    """Form for creating limit orders"""
    class Meta:
        model = Order
        fields = ['cryptocurrency', 'side', 'quantity', 'price', 'time_in_force']
        widgets = {
            'cryptocurrency': forms.Select(attrs={'class': 'form-control'}),
            'side': forms.Select(attrs={'class': 'form-control'}),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '0.00000000',
                'step': '0.00000001',
                'min': '0.00000001',
            }),
            'price': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '0.00000000',
                'step': '0.00000001',
                'min': '0.00000001',
            }),
            'time_in_force': forms.Select(attrs={'class': 'form-control'}),
        }

    def clean_quantity(self):
        quantity = self.cleaned_data.get('quantity')
        if quantity and quantity <= 0:
            raise forms.ValidationError("Quantity must be greater than zero.")
        return quantity

    def clean_price(self):
        price = self.cleaned_data.get('price')
        if price and price <= 0:
            raise forms.ValidationError("Price must be greater than zero.")
        return price

class StopOrderForm(forms.ModelForm):
    """Form for creating stop orders"""
    class Meta:
        model = Order
        fields = ['cryptocurrency', 'side', 'quantity', 'stop_price', 'time_in_force']
        widgets = {
            'cryptocurrency': forms.Select(attrs={'class': 'form-control'}),
            'side': forms.Select(attrs={'class': 'form-control'}),
            'quantity': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '0.00000000',
                'step': '0.00000001',
                'min': '0.00000001',
            }),
            'stop_price': forms.NumberInput(attrs={
                'class': 'form-control',
                'placeholder': '0.00000000',
                'step': '0.00000001',
                'min': '0.00000001',
            }),
            'time_in_force': forms.Select(attrs={'class': 'form-control'}),
        }

    def clean_quantity(self):
        quantity = self.cleaned_data.get('quantity')
        if quantity and quantity <= 0:
            raise forms.ValidationError("Quantity must be greater than zero.")
        return quantity

    def clean_stop_price(self):
        stop_price = self.cleaned_data.get('stop_price')
        if stop_price and stop_price <= 0:
            raise forms.ValidationError("Stop price must be greater than zero.")
        return stop_price

# ================================
# WALLET OPERATIONS FORMS
# ================================

class DepositForm(forms.Form):
    """Form for depositing funds"""
    cryptocurrency = forms.ChoiceField(
        choices=CRYPTO_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': True,
        })
    )
    amount = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'required': True,
        })
    )
    currency = forms.ChoiceField(
        choices=CURRENCY_CHOICES,
        initial='USD',
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': True,
        })
    )

    def clean_amount(self):
        amount = self.cleaned_data.get('amount')
        if amount and amount <= 0:
            raise forms.ValidationError("Deposit amount must be greater than zero.")
        return amount

class WithdrawalForm(forms.Form):
    """Form for withdrawing funds"""
    cryptocurrency = forms.ChoiceField(
        choices=CRYPTO_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': True,
        })
    )
    amount = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'required': True,
        })
    )
    wallet_address = forms.CharField(
        max_length=255,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your external wallet address',
            'required': True,
        })
    )
    network = forms.ChoiceField(
        choices=[('MAINNET', 'Main Network'), ('TESTNET', 'Test Network')],
        initial='MAINNET',
        widget=forms.Select(attrs={
            'class': 'form-control',
            'required': True,
        })
    )

    def clean_amount(self):
        amount = self.cleaned_data.get('amount')
        if amount and amount <= 0:
            raise forms.ValidationError("Withdrawal amount must be greater than zero.")
        return amount

    def clean_wallet_address(self):
        wallet_address = self.cleaned_data.get('wallet_address')
        if wallet_address:
            # Basic wallet address validation
            if len(wallet_address) < 10:
                raise forms.ValidationError("Please enter a valid wallet address.")
            
            # Check for common patterns in crypto addresses
            if not re.match(r'^[a-zA-Z0-9]+$', wallet_address):
                raise forms.ValidationError("Wallet address contains invalid characters.")
        
        return wallet_address

class WalletAddressForm(forms.ModelForm):
    """Form for updating wallet addresses"""
    class Meta:
        model = CustomUser
        fields = ['btc_wallet', 'ethereum_wallet', 'usdt_wallet', 'litecoin_wallet', 'tron_wallet']
        widgets = {
            'btc_wallet': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'BTC Wallet Address'
            }),
            'ethereum_wallet': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'ETH Wallet Address'
            }),
            'usdt_wallet': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'USDT Wallet Address'
            }),
            'litecoin_wallet': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'LTC Wallet Address'
            }),
            'tron_wallet': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'TRX Wallet Address'
            }),
        }

    def clean_btc_wallet(self):
        wallet = self.cleaned_data.get('btc_wallet')
        if wallet and not self.is_valid_btc_address(wallet):
            raise forms.ValidationError("Please enter a valid Bitcoin wallet address.")
        return wallet

    def clean_ethereum_wallet(self):
        wallet = self.cleaned_data.get('ethereum_wallet')
        if wallet and not self.is_valid_eth_address(wallet):
            raise forms.ValidationError("Please enter a valid Ethereum wallet address.")
        return wallet

    def is_valid_btc_address(self, address):
        """Basic BTC address validation"""
        if not address:
            return True
        # Basic format check for BTC addresses
        return len(address) >= 26 and len(address) <= 35

    def is_valid_eth_address(self, address):
        """Basic ETH address validation"""
        if not address:
            return True
        # ETH addresses are 42 characters starting with 0x
        return len(address) == 42 and address.startswith('0x')

# ================================
# TRANSACTION PROCESSING FORMS
# ================================

class QuickTradeForm(forms.Form):
    """Quick trade form for instant buy/sell"""
    action = forms.ChoiceField(
        choices=[('BUY', 'Buy'), ('SELL', 'Sell')],
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'quick-trade-action',
        })
    )
    cryptocurrency = forms.ChoiceField(
        choices=CRYPTO_CHOICES,
        widget=forms.Select(attrs={
            'class': 'form-control',
            'id': 'quick-trade-crypto',
        })
    )
    amount = forms.DecimalField(
        max_digits=20,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0.00000001'))],
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0.00000000',
            'step': '0.00000001',
            'min': '0.00000001',
            'id': 'quick-trade-amount',
        })
    )
    use_percentage = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input',
            'id': 'use-percentage',
        })
    )
    percentage = forms.IntegerField(
        required=False,
        min_value=1,
        max_value=100,
        widget=forms.NumberInput(attrs={
            'class': 'form-control',
            'placeholder': '0-100',
            'min': '1',
            'max': '100',
            'id': 'trade-percentage',
        })
    )

    def clean(self):
        cleaned_data = super().clean()
        action = cleaned_data.get('action')
        amount = cleaned_data.get('amount')
        use_percentage = cleaned_data.get('use_percentage')
        percentage = cleaned_data.get('percentage')

        if use_percentage and not percentage:
            raise forms.ValidationError("Please specify percentage when using percentage-based trading.")

        if not use_percentage and not amount:
            raise forms.ValidationError("Please specify amount for trading.")

        return cleaned_data

class BulkTradeForm(forms.Form):
    """Form for bulk trading operations"""
    trades = forms.CharField(
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'placeholder': 'Format: CRYPTO,ACTION,QUANTITY,PRICE\nExample: BTC,BUY,0.1,45000',
            'rows': 5,
        }),
        help_text="Enter one trade per line. Format: CRYPTO,ACTION,QUANTITY,PRICE"
    )

    def clean_trades(self):
        trades_text = self.cleaned_data.get('trades')
        if trades_text:
            lines = trades_text.strip().split('\n')
            validated_trades = []
            
            for i, line in enumerate(lines, 1):
                parts = line.strip().split(',')
                if len(parts) != 4:
                    raise forms.ValidationError(f"Line {i}: Invalid format. Expected: CRYPTO,ACTION,QUANTITY,PRICE")
                
                crypto, action, quantity, price = parts
                
                # Validate cryptocurrency
                if crypto.upper() not in dict(CRYPTO_CHOICES):
                    raise forms.ValidationError(f"Line {i}: Invalid cryptocurrency '{crypto}'")
                
                # Validate action
                if action.upper() not in ['BUY', 'SELL']:
                    raise forms.ValidationError(f"Line {i}: Action must be 'BUY' or 'SELL'")
                
                # Validate quantity
                try:
                    quantity = Decimal(quantity)
                    if quantity <= 0:
                        raise ValueError
                except (ValueError, InvalidOperation):
                    raise forms.ValidationError(f"Line {i}: Quantity must be a positive number")
                
                # Validate price
                try:
                    price = Decimal(price)
                    if price <= 0:
                        raise ValueError
                except (ValueError, InvalidOperation):
                    raise forms.ValidationError(f"Line {i}: Price must be a positive number")
                
                validated_trades.append({
                    'cryptocurrency': crypto.upper(),
                    'action': action.upper(),
                    'quantity': quantity,
                    'price': price
                })
            
            return validated_trades
        
        return []