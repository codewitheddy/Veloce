import uuid
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel


class Inventory(TimeStampedModel):
    """
    Authoritative stock level entity tracking physical and available inventory.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.OneToOneField(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='inventory_record'
    )
    sku = models.CharField(max_length=64, db_index=True)
    stock_quantity = models.IntegerField(default=0, help_text="Total physical stock in warehouse")
    reserved_quantity = models.IntegerField(default=0, help_text="Stock currently on hold during active checkouts")
    low_stock_threshold = models.IntegerField(default=5)
    allow_backorders = models.BooleanField(default=False)
    warehouse_location = models.CharField(max_length=120, blank=True, default="Main Nairobi Hub")

    class Meta:
        verbose_name_plural = "Inventories"
        indexes = [
            models.Index(fields=["sku"]),
            models.Index(fields=["stock_quantity"]),
        ]

    def __str__(self):
        return f"Inventory for {self.sku} (Available: {self.available_quantity})"

    @property
    def available_quantity(self) -> int:
        available = self.stock_quantity - self.reserved_quantity
        return max(0, available) if not self.allow_backorders else available


class InventoryReservation(TimeStampedModel):
    """
    Persistent audit trail of Redis inventory holds and their eventual disposition.
    """
    STATUS_CHOICES = [
        ('ACTIVE', 'Active Hold'),
        ('COMMITTED', 'Committed to Order'),
        ('EXPIRED', 'Expired / Released'),
        ('CANCELLED', 'Cancelled by User'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart_id = models.CharField(max_length=120, db_index=True)
    reservation_token = models.CharField(max_length=120, unique=True, db_index=True)
    items_payload = models.JSONField(default=list, help_text="Snapshot of reserved SKU items and quantities")
    expires_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["cart_id", "status"]),
            models.Index(fields=["expires_at", "status"]),
        ]

    def is_valid(self) -> bool:
        return self.status == 'ACTIVE' and timezone.now() < self.expires_at
