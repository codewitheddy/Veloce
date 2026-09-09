import logging
from decimal import Decimal
from django.db import transaction
from rest_framework import serializers
from products.models import Product, InventoryAuditLog
from .models import Order, OrderItem

logger = logging.getLogger(__name__)


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_sku', 'quantity', 'unit_price', 'selected_variations']
        extra_kwargs = {
            'product': {'required': False, 'allow_null': True},
            'product_sku': {'required': False, 'allow_blank': True},
            'selected_variations': {'required': False},
        }


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, required=False)

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'customer_name', 'customer_email', 'customer_phone',
            'subtotal', 'discount', 'shipping_fee', 'tax_amount', 'total',
            'status', 'affiliate_code', 'payment_method', 'payment_reference',
            'shipping_address', 'tracking_number', 'notes', 'items', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'id': {'required': False},
            'user': {'required': False, 'allow_null': True},
            'customer_phone': {'required': False, 'allow_blank': True},
            'subtotal': {'required': False},
            'discount': {'required': False},
            'shipping_fee': {'required': False},
            'tax_amount': {'required': False},
            'affiliate_code': {'required': False, 'allow_blank': True},
            'payment_reference': {'required': False, 'allow_blank': True},
            'shipping_address': {'required': False, 'allow_blank': True},
            'tracking_number': {'required': False, 'allow_blank': True},
            'notes': {'required': False, 'allow_blank': True},
        }

    def validate(self, attrs):
        status_val = attrs.get('status')
        if not status_val and self.instance:
            status_val = self.instance.status

        payment_method = str(attrs.get('payment_method') or (self.instance.payment_method if self.instance else '')).lower()
        payment_ref = str(attrs.get('payment_reference') or (self.instance.payment_reference if self.instance else '') or '')

        if status_val and str(status_val).strip().capitalize() in ['Completed', 'Delivered']:
            # Enforcement: An order can never be completed before payment is confirmed
            if payment_method in ['cod', 'cash on delivery', 'pay on delivery'] and not (payment_ref.startswith('COD-PAYMENT-CONFIRMED') or 'PAID' in payment_ref.upper()):
                raise serializers.ValidationError({
                    'status': 'An order cannot be marked as Completed/Delivered before Cash on Delivery payment is confirmed.'
                })
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        # Transactional Atomic block with row-level stock locking
        with transaction.atomic():
            # Automatically find or link customer record
            customer = validated_data.get('customer')
            customer_email = (validated_data.get('customer_email') or '').strip()
            user = validated_data.get('user')

            if not customer and (customer_email or user):
                from apps.customers.models import Customer
                from django.db.models import Q
                cust_q = Q()
                if user:
                    cust_q |= Q(user=user)
                if customer_email:
                    cust_q |= Q(email__iexact=customer_email)
                
                customer = Customer.objects.filter(cust_q).first()
                if not customer and customer_email:
                    full_name = (validated_data.get('customer_name') or '').strip()
                    parts = full_name.split(' ', 1)
                    first_name = parts[0] if parts and parts[0] else 'Customer'
                    last_name = parts[1] if len(parts) > 1 else ''
                    phone = (validated_data.get('customer_phone') or '').strip()
                    shipping_addr = (validated_data.get('shipping_address') or '').strip()
                    
                    customer = Customer.objects.create(
                        user=user if (user and not user.is_staff and not user.is_superuser) else None,
                        first_name=first_name,
                        last_name=last_name,
                        email=customer_email,
                        phone=phone,
                        location=shipping_addr,
                        status='active'
                    )
            
            if customer:
                validated_data['customer'] = customer
                if not customer.location and validated_data.get('shipping_address'):
                    customer.location = validated_data.get('shipping_address')
                    customer.save(update_fields=['location'])

            order = Order.objects.create(**validated_data)
            
            for item_data in items_data:
                product_instance = item_data.get('product')
                qty = item_data.get('quantity', 1)
                
                # Transactionally safe inventory deduction
                if product_instance and product_instance.track_stock:
                    # Acquire row-level lock using select_for_update
                    locked_product = Product.objects.select_for_update().get(id=product_instance.id)
                    old_stock = locked_product.stock
                    new_stock = max(0, old_stock - qty)
                    locked_product.stock = new_stock
                    locked_product.save()

                    # Record audit log
                    InventoryAuditLog.objects.create(
                        product=locked_product,
                        product_sku=locked_product.sku,
                        product_name=locked_product.name,
                        previous_stock=old_stock,
                        new_stock=new_stock,
                        stock_change=-qty,
                        reason='order-placement',
                        details=f"Stock deducted for Order #{order.id[:8]}",
                        timestamp=f"Order {order.id[:8]}",
                        created_by="Checkout Pipeline"
                    )

                OrderItem.objects.create(order=order, **item_data)

            # Note: Order creation & status lifecycle emails are now authoritatively handled
            # by the post_save signal in apps.orders.signals.
            
            # Process affiliate commissions if applicable
            order_id = str(order.id)
            affiliate_code = order.affiliate_code
            total_val = float(order.total)

            if affiliate_code:
                from apps.affiliates.tasks import process_affiliate_commission_task
                transaction.on_commit(
                    lambda: process_affiliate_commission_task.delay(order_id, affiliate_code, total_val)
                )

        return order
