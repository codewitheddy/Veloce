import uuid
from django.db import models

class ShippingZone(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Zone Name, e.g. Nairobi CBD")
    description = models.TextField(blank=True, default='')
    min_distance_km = models.FloatField(default=0.0)
    max_distance_km = models.FloatField(default=10.0)
    base_fee = models.DecimalField(max_digits=10, decimal_places=2, default=150.00)
    per_km_rate = models.DecimalField(max_digits=10, decimal_places=2, default=20.00)
    is_active = models.BooleanField(default=True)
    regions = models.JSONField(default=list, blank=True, help_text="List of covered sub-regions or towns")
    estimated_delivery_time = models.CharField(max_length=100, default='30-45 mins')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['min_distance_km']

    def __str__(self):
        return f"{self.name} ({self.min_distance_km}-{self.max_distance_km} km) - KSh {self.base_fee}"


class ShippingMethod(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name='shipping_methods')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    flat_rate = models.DecimalField(max_digits=10, decimal_places=2, default=200.00)
    estimated_days = models.IntegerField(default=1)
    is_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ['flat_rate']
        verbose_name = 'Shipping Method'
        verbose_name_plural = 'Shipping Methods'

    def __str__(self):
        return f"{self.name} - KSh {self.flat_rate} ({self.zone.name})"


class HappyHourWindow(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    start_time = models.CharField(max_length=10, default='14:00', help_text="Format HH:MM")
    end_time = models.CharField(max_length=10, default='16:00', help_text="Format HH:MM")
    days_of_week = models.JSONField(default=list, help_text="List of active weekday integers 0=Sun .. 6=Sat")
    discount_percentage = models.IntegerField(default=50, help_text="Percentage discount e.g. 50")
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Happy Hour Window'
        verbose_name_plural = 'Happy Hour Windows'

    def __str__(self):
        return f"{self.name} ({self.start_time}-{self.end_time}): {self.discount_percentage}% OFF"


class TaxRate(models.Model):
    id = models.CharField(max_length=64, primary_key=True, default=uuid.uuid4, editable=False)
    country = models.CharField(max_length=50, default='Kenya')
    tax_name = models.CharField(max_length=100, default='VAT')
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=16.00, help_text="Default 16.00 for Kenya VAT")
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Tax Rate'
        verbose_name_plural = 'Tax Rates'

    def __str__(self):
        return f"{self.country} - {self.tax_name} ({self.percentage}%)"

