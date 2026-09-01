from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['referral_code', 'partner_tier', 'loyalty_points', 'commission_balance', 'is_affiliate', 'phone_number', 'avatar_url']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'profile']

class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'first_name', 'last_name']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        UserProfile.objects.get_or_create(user=user)

        # Dedupe-on-registration: Link to existing guest Customer record or create a registered Customer
        try:
            from apps.customers.models import Customer
            customer = Customer.objects.filter(email__iexact=user.email).first()
            if customer:
                customer.user = user
                if not customer.first_name and user.first_name:
                    customer.first_name = user.first_name
                if not customer.last_name and user.last_name:
                    customer.last_name = user.last_name
                if customer.status == 'lead':
                    customer.status = 'active'
                customer.save()
            else:
                Customer.objects.create(
                    user=user,
                    first_name=user.first_name or user.username,
                    last_name=user.last_name or '',
                    email=user.email,
                    status='active'
                )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"[Registration Dedupe] Error linking customer profile: {exc}")

        return user

