from rest_framework import serializers
from django.contrib.auth import authenticate
from django.core.validators import RegexValidator
from .models import *

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, style={'input_type': 'password'})
    
    # Phone number validator
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone_no = serializers.CharField(validators=[phone_regex], required=False)

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone_no', 'gender', 'address'
        ]
        extra_kwargs = {
            'email': {'required': True},
            'username': {'required': True},
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, attrs):
        # Check if passwords match
        if attrs.get('password') != attrs.get('password_confirm'):
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        # Check if email already exists
        if CustomUser.objects.filter(email=attrs.get('email')).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})
        
        # Check if username already exists
        if CustomUser.objects.filter(username=attrs.get('username')).exists():
            raise serializers.ValidationError({"username": "A user with this username already exists."})
        
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        user = CustomUser.objects.create_user(**validated_data) # type: ignore
        user.set_password(password)
        user.save()
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(request=self.context.get('request'), email=email, password=password)
            
            if not user:
                raise serializers.ValidationError('Unable to log in with provided credentials.')
            
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled.')
            
            if user.is_blocked: # type: ignore
                raise serializers.ValidationError('User account is blocked. Please contact support.')
            
            attrs['user'] = user
            return attrs
        else:
            raise serializers.ValidationError('Must include "email" and "password".')

class UserProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name',
            'phone_no', 'profile_pic', 'gender', 'address',
            'btc_wallet', 'ethereum_wallet', 'usdt_wallet', 'litecoin_wallet', 'tron_wallet',
            'btc_balance', 'ethereum_balance', 'usdt_balance', 'litecoin_balance', 'tron_balance',
            'is_verified', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'created_at', 'updated_at', 'is_verified']

class UserUpdateSerializer(serializers.ModelSerializer):
    phone_regex = RegexValidator(
        regex=r'^\+?1?\d{9,15}$',
        message="Phone number must be entered in the format: '+999999999'. Up to 15 digits allowed."
    )
    phone_no = serializers.CharField(validators=[phone_regex], required=False)

    class Meta:
        model = CustomUser
        fields = [
            'first_name', 'last_name', 'phone_no', 'profile_pic', 
            'gender', 'address'
        ]

class WalletUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'btc_wallet', 'ethereum_wallet', 'usdt_wallet', 
            'litecoin_wallet', 'tron_wallet'
        ]

class BalanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            'btc_balance', 'ethereum_balance', 'usdt_balance',
            'litecoin_balance', 'tron_balance'
        ]
        read_only_fields = fields

class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, min_length=8, style={'input_type': 'password'})
    confirm_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        user = self.context['request'].user
        
        # Check current password
        if not user.check_password(attrs.get('current_password')):
            raise serializers.ValidationError({"current_password": "Current password is incorrect."})
        
        # Check if new passwords match
        if attrs.get('new_password') != attrs.get('confirm_password'):
            raise serializers.ValidationError({"new_password": "New password fields didn't match."})
        
        # Check if new password is same as current
        if attrs.get('current_password') == attrs.get('new_password'):
            raise serializers.ValidationError({"new_password": "New password must be different from current password."})
        
        return attrs

    def save(self, **kwargs):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password']) # type: ignore
        user.save()
        return user

class UserActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserActivity
        fields = ['id', 'activity_type', 'description', 'ip_address', 'timestamp']
        read_only_fields = fields

class AdminUserSerializer(serializers.ModelSerializer):
    activities = UserActivitySerializer(many=True, read_only=True)
    
    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name',
            'phone_no', 'gender', 'address', 'is_active', 'is_staff', 'is_blocked',
            'is_verified', 'is_superuser', 'last_login', 'created_at', 'updated_at',
            'btc_balance', 'ethereum_balance', 'usdt_balance', 'litecoin_balance', 'tron_balance',
            'activities'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_login']

class KYCVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id_document', 'is_verified']
        read_only_fields = ['is_verified']

    def update(self, instance, validated_data):
        instance.id_document = validated_data.get('id_document', instance.id_document)
        # Admin will manually set is_verified after reviewing the document
        instance.save()
        return instance
    
# Add these serializers after the existing ones

class CryptocurrencySerializer(serializers.ModelSerializer):
    price_change_direction = serializers.ReadOnlyField()
    
    class Meta:
        model = Cryptocurrency  # type: ignore
        fields = [
            'id', 'symbol', 'name', 'current_price', 'price_change_24h',
            'price_change_percentage_24h', 'market_cap', 'volume_24h',
            'circulating_supply', 'total_supply', 'max_supply', 'rank',
            'is_active', 'last_updated', 'price_change_direction'
        ]
        read_only_fields = fields

class PriceHistorySerializer(serializers.ModelSerializer):
    cryptocurrency_symbol = serializers.CharField(source='cryptocurrency.symbol', read_only=True)
    
    class Meta:
        model = PriceHistory  # type: ignore
        fields = [
            'id', 'cryptocurrency', 'cryptocurrency_symbol', 'price', 'volume',
            'market_cap', 'timestamp', 'created_at'
        ]
        read_only_fields = fields

class TransactionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    cryptocurrency_name = serializers.CharField(source='get_cryptocurrency_display', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Transaction  # type: ignore
        fields = [
            'id', 'user', 'user_email', 'transaction_type', 'transaction_type_display',
            'cryptocurrency', 'cryptocurrency_name', 'quantity', 'price_per_unit',
            'total_amount', 'fiat_amount', 'currency', 'status', 'status_display',
            'transaction_hash', 'wallet_address', 'network_fee', 'platform_fee',
            'created_at', 'updated_at', 'completed_at'
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at', 'completed_at']

class TransactionCreateSerializer(serializers.ModelSerializer):
    cryptocurrency = serializers.CharField()  # Accept symbol as string
    
    class Meta:
        model = Transaction  # type: ignore
        fields = [
            'transaction_type', 'cryptocurrency', 'quantity', 'price_per_unit',
            'fiat_amount', 'currency', 'wallet_address'
        ]
    
    def validate_cryptocurrency(self, value):
        """Convert cryptocurrency symbol to Cryptocurrency instance"""
        try:
            crypto = Cryptocurrency.objects.get(symbol=value.upper())
            return crypto
        except Cryptocurrency.DoesNotExist:
            raise serializers.ValidationError(f"Cryptocurrency '{value}' not found.")
    
    def validate(self, attrs):
        transaction_type = attrs.get('transaction_type')
        cryptocurrency = attrs.get('cryptocurrency')
        quantity = attrs.get('quantity')
        fiat_amount = attrs.get('fiat_amount')
        
        # Validate BUY/SELL transactions
        if transaction_type in ['BUY', 'SELL']:
            if not quantity or quantity <= 0:
                raise serializers.ValidationError({
                    "quantity": "Quantity must be positive for BUY/SELL transactions."
                })
        
        # Validate DEPOSIT/WITHDRAWAL transactions
        if transaction_type in ['DEPOSIT', 'WITHDRAWAL']:
            if not fiat_amount or fiat_amount <= 0:
                raise serializers.ValidationError({
                    "fiat_amount": "Fiat amount must be positive for DEPOSIT/WITHDRAWAL transactions."
                })
        
        return attrs

class OrderSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    cryptocurrency_name = serializers.CharField(source='get_cryptocurrency_display', read_only=True)
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    side_display = serializers.CharField(source='get_side_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    remaining_quantity = serializers.ReadOnlyField()
    is_completed = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    
    class Meta:
        model = Order  # type: ignore
        fields = [
            'id', 'user', 'user_email', 'order_type', 'order_type_display', 'side', 'side_display',
            'cryptocurrency', 'cryptocurrency_name', 'quantity', 'price', 'stop_price',
            'filled_quantity', 'average_filled_price', 'status', 'status_display',
            'time_in_force', 'remaining_quantity', 'is_completed', 'is_active',
            'created_at', 'updated_at', 'expires_at', 'filled_at'
        ]
        read_only_fields = [
            'id', 'user', 'filled_quantity', 'average_filled_price', 'status',
            'created_at', 'updated_at', 'filled_at'
        ]

class OrderCreateSerializer(serializers.ModelSerializer):
    cryptocurrency = serializers.CharField()  # Accept symbol as string
    
    class Meta:
        model = Order  # type: ignore
        fields = [
            'order_type', 'side', 'cryptocurrency', 'quantity', 'price',
            'stop_price', 'time_in_force', 'expires_at'
        ]
        extra_kwargs = {
            'side': {'required': True},
        }

    def validate_cryptocurrency(self, value):
        """Convert cryptocurrency symbol to Cryptocurrency instance"""
        try:
            crypto = Cryptocurrency.objects.get(symbol=value.upper())
            return crypto
        except Cryptocurrency.DoesNotExist:
            raise serializers.ValidationError(f"Cryptocurrency '{value}' not found.")

    def validate(self, attrs):
        order_type = attrs.get('order_type')
        price = attrs.get('price')
        stop_price = attrs.get('stop_price')
        side = attrs.get('side')

        if not side:
            raise serializers.ValidationError({
                "side": "Side (BUY/SELL) is required."
            })

        # Validate LIMIT orders require price
        if order_type == 'LIMIT' and (not price or price <= 0):
            raise serializers.ValidationError({
                "price": "Price is required for LIMIT orders and must be positive."
            })

        # Validate STOP_LOSS/TAKE_PROFIT orders require stop_price
        if order_type in ['STOP_LOSS', 'TAKE_PROFIT'] and (not stop_price or stop_price <= 0):
            raise serializers.ValidationError({
                "stop_price": "Stop price is required for STOP_LOSS/TAKE_PROFIT orders and must be positive."
            })

        return attrs

class PortfolioSerializer(serializers.ModelSerializer):
    cryptocurrency_name = serializers.CharField(source='get_cryptocurrency_display', read_only=True)
    current_price = serializers.DecimalField(max_digits=20, decimal_places=8, read_only=True)
    
    class Meta:
        model = Portfolio  # type: ignore
        fields = [
            'id', 'user', 'cryptocurrency', 'cryptocurrency_name', 'total_quantity',
            'average_buy_price', 'total_invested', 'current_value', 'profit_loss',
            'profit_loss_percentage', 'current_price', 'last_updated'
        ]
        read_only_fields = fields

class MarketOverviewSerializer(serializers.Serializer):
    total_cryptocurrencies = serializers.IntegerField()
    total_market_cap = serializers.DecimalField(max_digits=30, decimal_places=2)
    total_volume_24h = serializers.DecimalField(max_digits=30, decimal_places=2)
    btc_dominance = serializers.DecimalField(max_digits=10, decimal_places=4)
    market_cap_change_24h = serializers.DecimalField(max_digits=10, decimal_places=4)
    
    class Meta:
        fields = [
            'total_cryptocurrencies', 'total_market_cap', 'total_volume_24h',
            'btc_dominance', 'market_cap_change_24h'
        ]