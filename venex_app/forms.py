from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from .models import CustomUser, Country, State


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
                regex='^[A-Za-z0-9_\-]+$', # type: ignore
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
        })
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
        from .choices import Currency
        self.fields['currency_type'].choices = Currency
        
        # If we have a country in the data, update state queryset
        if 'country' in self.data:
            try:
                country_id = int(self.data.get('country')) # type: ignore
                self.fields['state'].queryset = State.objects.filter(country_id=country_id).order_by('name') # type: ignore
            except (ValueError, TypeError):
                pass

    def clean_email(self):
        email = self.cleaned_data.get('email')
        if CustomUser.objects.filter(email=email).exists():
            raise ValidationError("A user with this email already exists.")
        return email

    def clean_username(self):
        username = self.cleaned_data.get('username')
        if CustomUser.objects.filter(username=username).exists():
            raise ValidationError("A user with this username already exists.")
        return username

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