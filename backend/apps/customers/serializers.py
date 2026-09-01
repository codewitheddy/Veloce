from decimal import Decimal
from rest_framework import serializers
from apps.orders.models import Order
from .models import Customer, Deal, Invoice


class DealSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)

    class Meta:
        model = Deal
        fields = [
            'id', 'customer', 'customer_name', 'title', 'value', 'stage', 'expected_close', 'created_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'expected_close': {'required': False, 'allow_null': True},
        }


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    order_reference = serializers.CharField(source='order.id', read_only=True, default='')

    class Meta:
        model = Invoice
        fields = [
            'id', 'customer', 'customer_name', 'order', 'order_reference',
            'amount', 'status', 'due_date', 'issued_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'order': {'required': False, 'allow_null': True},
            'due_date': {'required': False, 'allow_null': True},
        }


class CustomerOrderSerializer(serializers.ModelSerializer):
    reference = serializers.CharField(required=False, allow_blank=True)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_email = serializers.EmailField(required=False, allow_blank=True)
    placed_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'reference', 'customer', 'customer_name', 'customer_email',
            'total', 'status', 'placed_at', 'created_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'customer': {'required': False, 'allow_null': True},
            'status': {'required': False},
        }

    def validate(self, attrs):
        customer = attrs.get('customer')
        if customer:
            if not attrs.get('customer_name'):
                attrs['customer_name'] = customer.name or customer.email
            if not attrs.get('customer_email'):
                attrs['customer_email'] = customer.email
        if not attrs.get('customer_name'):
            attrs['customer_name'] = 'Customer'
        if not attrs.get('customer_email'):
            attrs['customer_email'] = 'customer@example.com'
        return attrs

    def create(self, validated_data):
        import uuid
        if not validated_data.get('reference'):
            validated_data['reference'] = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        return super().create(validated_data)


class CustomerListSerializer(serializers.ModelSerializer):
    name = serializers.ReadOnlyField()
    is_registered = serializers.BooleanField(read_only=True)
    resolved_location = serializers.ReadOnlyField()
    orders_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    open_deal_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Customer
        fields = [
            'id', 'user', 'is_registered', 'first_name', 'last_name', 'name', 'email', 'phone',
            'company', 'location', 'resolved_location', 'orders_count', 'total_spent',
            'status', 'notes', 'open_deal_value', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'user': {'required': False, 'allow_null': True},
            'last_name': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
            'company': {'required': False, 'allow_blank': True},
            'location': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }


class CustomerDetailSerializer(serializers.ModelSerializer):
    name = serializers.ReadOnlyField()
    is_registered = serializers.BooleanField(read_only=True)
    resolved_location = serializers.ReadOnlyField()
    orders_count = serializers.IntegerField(read_only=True)
    total_spent = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    open_deal_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    deals = DealSerializer(many=True, read_only=True)
    orders = serializers.SerializerMethodField()
    invoices = InvoiceSerializer(many=True, read_only=True)

    def get_orders(self, obj):
        from apps.orders.models import Order
        from django.db.models import Q
        q = Q(customer=obj)
        if obj.email:
            q |= Q(customer_email__iexact=obj.email.strip())
        if obj.user:
            q |= Q(user=obj.user)
        orders_qs = Order.objects.filter(q).distinct().order_by('-created_at')
        return CustomerOrderSerializer(orders_qs, many=True).data

    class Meta:
        model = Customer
        fields = [
            'id', 'user', 'is_registered', 'first_name', 'last_name', 'name', 'email', 'phone',
            'company', 'location', 'resolved_location', 'orders_count', 'total_spent',
            'status', 'notes', 'open_deal_value',
            'deals', 'orders', 'invoices',
            'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'user': {'required': False, 'allow_null': True},
            'last_name': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
            'company': {'required': False, 'allow_blank': True},
            'location': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }
