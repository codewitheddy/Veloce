import uuid
from django.db import models
from apps.core.models import TimeStampedModel


class PaymentTransaction(TimeStampedModel):
    """
    Idempotent audit record for payment transactions across M-Pesa, Card, and Cash.
    """
    PROVIDER_CHOICES = [
        ('MPESA', 'Safaricom M-Pesa Daraja'),
        ('STRIPE', 'Stripe Card Payment'),
        ('PAYSTACK', 'Paystack Multi-Currency'),
        ('COD', 'Cash on Delivery'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending Initiation'),
        ('PROCESSING', 'Processing Gateway Callback'),
        ('COMPLETED', 'Completed & Verified'),
        ('FAILED', 'Failed / Insufficient Funds'),
        ('CANCELLED', 'Cancelled by Customer'),
        ('REFUNDED', 'Refunded'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_id = models.CharField(max_length=120, db_index=True)
    reservation_token = models.CharField(max_length=120, blank=True, db_index=True)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='MPESA', db_index=True)
    provider_reference = models.CharField(max_length=200, unique=True, db_index=True, help_text="CheckoutRequestID or Stripe PaymentIntent ID")
    receipt_number = models.CharField(max_length=100, blank=True, db_index=True, help_text="e.g. M-Pesa Receipt Code (QAB123456)")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='KES')
    phone_number = models.CharField(max_length=32, blank=True)
    customer_email = models.EmailField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    failure_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=["order_id", "status"]),
            models.Index(fields=["provider", "status"]),
        ]

    def __str__(self):
        return f"{self.provider} Payment ({self.currency} {self.amount}) - Order #{self.order_id} [{self.status}]"
