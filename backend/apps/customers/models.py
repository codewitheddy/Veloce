import uuid
from decimal import Decimal
from django.db import models
from django.conf import settings


class Customer(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('lead', 'Lead'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_profile'
    )
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True, default='')
    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    company = models.CharField(max_length=255, blank=True, default='')
    location = models.CharField(max_length=255, blank=True, default='', help_text="City, Region, or Delivery Location")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='lead', db_index=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'customers'
        ordering = ['-created_at']
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['status']),
            models.Index(fields=['company']),
            models.Index(fields=['location']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        reg_tag = "Registered" if self.is_registered else "Guest"
        return f"{full_name or self.email} ({self.company or 'Individual'}) [{self.status}] [{reg_tag}]"

    @property
    def name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def is_registered(self):
        return self.user is not None

    @property
    def orders_count(self):
        """
        Returns total number of associated orders matching customer FK, email, or user.
        """
        from apps.orders.models import Order
        from django.db.models import Q
        q = Q(customer=self)
        if self.email:
            q |= Q(customer_email__iexact=self.email.strip())
        if self.user:
            q |= Q(user=self.user)
        return Order.objects.filter(q).distinct().count()

    @property
    def total_spent(self):
        """
        Sums total spent across all non-cancelled orders.
        """
        from apps.orders.models import Order
        from django.db.models import Q
        q = Q(customer=self)
        if self.email:
            q |= Q(customer_email__iexact=self.email.strip())
        if self.user:
            q |= Q(user=self.user)
        orders = Order.objects.filter(q).exclude(status__iexact='Cancelled').distinct()
        return sum((ord.total for ord in orders), Decimal('0.00'))

    @property
    def resolved_location(self):
        """
        Returns custom location or derives from recent order shipping address.
        """
        if self.location and self.location.strip():
            return self.location.strip()
        from apps.orders.models import Order
        from django.db.models import Q
        q = Q(customer=self)
        if self.email:
            q |= Q(customer_email__iexact=self.email.strip())
        if self.user:
            q |= Q(user=self.user)
        latest_order = Order.objects.filter(q).exclude(shipping_address='').order_by('-created_at').first()
        if latest_order and latest_order.shipping_address:
            first_line = latest_order.shipping_address.split('\n')[0].strip()
            return first_line or 'Nairobi, Kenya'
        return 'Nairobi, Kenya'

    @property
    def open_deal_value(self):
        """
        Sums non-closed deal values (stages: 'prospecting', 'negotiation').
        Excludes closed deals ('won', 'lost').
        """
        open_deals = self.deals.filter(stage__in=['prospecting', 'negotiation'])
        total_val = sum((deal.value for deal in open_deals), Decimal('0.00'))
        return total_val


class Deal(models.Model):
    STAGE_CHOICES = [
        ('prospecting', 'Prospecting'),
        ('negotiation', 'Negotiation'),
        ('won', 'Won'),
        ('lost', 'Lost'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='deals')
    title = models.CharField(max_length=255)
    value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    stage = models.CharField(max_length=30, choices=STAGE_CHOICES, default='prospecting', db_index=True)
    expected_close = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'customers'
        ordering = ['-created_at']
        verbose_name = 'Deal'
        verbose_name_plural = 'Deals'
        indexes = [
            models.Index(fields=['customer', 'stage']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.title} - KSh {self.value} ({self.stage})"


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
    ]

    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='invoices')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    due_date = models.DateField(null=True, blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'customers'
        ordering = ['-issued_at']
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['order']),
            models.Index(fields=['-issued_at']),
        ]

    def __str__(self):
        return f"Invoice #{self.id[:8]} - KSh {self.amount} [{self.status}]"
