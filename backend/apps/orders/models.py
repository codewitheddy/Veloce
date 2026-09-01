import uuid
from django.db import models
from django.contrib.auth.models import User
from products.models import Product


class Order(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Processing', 'Processing'),
        ('Shipped', 'Shipped'),
        ('Delivered', 'Delivered'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
        ('Pending-Cancellation', 'Pending Cancellation'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    customer = models.ForeignKey('customers.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    reference = models.CharField(max_length=100, blank=True, default='', db_index=True)
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField(db_index=True)
    customer_phone = models.CharField(max_length=30, blank=True, default='')
    
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    shipping_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending', db_index=True)
    affiliate_code = models.CharField(max_length=50, blank=True, default='', db_index=True)
    payment_method = models.CharField(max_length=50, default='M-PESA')
    payment_reference = models.CharField(max_length=100, blank=True, default='')
    shipping_address = models.TextField(blank=True, default='')
    tracking_number = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Order'
        verbose_name_plural = 'Orders'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['customer_email', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['tracking_number']),
            models.Index(fields=['affiliate_code', '-created_at']),
        ]

    def __str__(self):
        return f"Order #{self.id[:8]} - {self.customer_name} (KSh {self.total}) [{self.status}]"


class OrderItem(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True)
    product_name = models.CharField(max_length=255)
    product_sku = models.CharField(max_length=64, blank=True, default='')
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    selected_variations = models.JSONField(default=dict, blank=True, help_text="Chosen variations e.g. {'Size': 'M'}")
    digital_download_key = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        verbose_name = 'Order Item'
        verbose_name_plural = 'Order Items'
        indexes = [
            models.Index(fields=['order', 'product']),
            models.Index(fields=['product_sku']),
        ]

    def __str__(self):
        return f"{self.quantity}x {self.product_name} @ KSh {self.unit_price}"


class ReturnRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved for Return'),
        ('rejected', 'Request Rejected'),
        ('refunded', 'Refunded'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='return_requests')
    order_id_ref = models.CharField(max_length=64, db_index=True, help_text="Original order reference string")
    customer_name = models.CharField(max_length=255)
    customer_email = models.EmailField()
    customer_phone = models.CharField(max_length=30, blank=True, default='')
    item_name = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    return_reason = models.TextField(help_text="Reason provided by customer")
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    admin_note = models.TextField(blank=True, default='')
    admin_notes = models.TextField(blank=True, default='')
    customer_notes = models.TextField(blank=True, default='')
    user_notes = models.TextField(blank=True, default='')
    tracking_number = models.CharField(max_length=100, blank=True, default='')
    evidence_images = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Return Request'
        verbose_name_plural = 'Return Requests'
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['customer_email', '-created_at']),
        ]

    def __str__(self):
        return f"Return #{self.id[:8]} - Order #{self.order_id_ref} ({self.status})"


class ReturnStatusHistoryEntry(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, related_name='status_history')
    previous_status = models.CharField(max_length=30)
    new_status = models.CharField(max_length=30)
    changed_by = models.CharField(max_length=100, default='System Admin')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Return Status History Entry'
        verbose_name_plural = 'Return Status History Entries'

    def __str__(self):
        return f"Return #{self.return_request.id[:8]} status changed to {self.new_status}"
