import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from django.core.cache import cache
from apps.core.models import TimeStampedModel


class CountryTaxRate(TimeStampedModel):
    """
    Flat VAT rate lookup table per country across East Africa.
    """
    country_code = models.CharField(max_length=2, unique=True, help_text="ISO 2-letter code: KE, UG, TZ, RW")
    country_name = models.CharField(max_length=64)
    currency_code = models.CharField(max_length=3, default="KES", help_text="Default currency e.g. KES, UGX, TZS, RWF")
    vat_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('16.00'), help_text="e.g. 16.00 for Kenya 16% VAT")
    tax_identifier_name = models.CharField(max_length=32, default="VAT", help_text="e.g. VAT, PIN / TIN")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        verbose_name = "Country Tax Rate"
        verbose_name_plural = "Country Tax Rates"
        ordering = ["country_name"]

    def __str__(self):
        return f"{self.country_name} ({self.country_code}) - {self.vat_percentage}% {self.tax_identifier_name}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(f"tax_rate:{self.country_code.upper()}")

    @classmethod
    def get_rate(cls, country_code: str) -> Decimal:
        if not country_code:
            return Decimal('16.00')  # Default Kenya VAT
        key = f"tax_rate:{country_code.upper()}"
        rate = cache.get(key)
        if rate is None:
            obj = cls.objects.filter(country_code=country_code.upper(), is_active=True).first()
            rate = obj.vat_percentage if obj else Decimal('16.00')
            cache.set(key, rate, timeout=86400)
        return Decimal(str(rate))


class ProductPrice(TimeStampedModel):
    """
    Multi-currency price entry with support for scheduled flash sales.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        'products.Product',
        on_delete=models.CASCADE,
        related_name='prices'
    )
    currency = models.CharField(max_length=3, default="KES", db_index=True, help_text="KES, UGX, TZS, RWF, USD")
    regular_price = models.DecimalField(max_digits=12, decimal_places=2)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    sale_start_at = models.DateTimeField(null=True, blank=True)
    sale_end_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        unique_together = ("product", "currency")
        indexes = [
            models.Index(fields=["product", "currency", "is_active"]),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.currency} {self.effective_price}"

    @property
    def effective_price(self) -> Decimal:
        now = timezone.now()
        if (
            self.sale_price is not None
            and (self.sale_start_at is None or self.sale_start_at <= now)
            and (self.sale_end_at is None or self.sale_end_at >= now)
        ):
            return self.sale_price
        return self.regular_price

    @property
    def is_on_sale(self) -> bool:
        return self.effective_price < self.regular_price
