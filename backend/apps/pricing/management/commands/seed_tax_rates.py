from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.pricing.models import CountryTaxRate


class Command(BaseCommand):
    help = "Seed East Africa flat VAT rates (Kenya, Uganda, Tanzania, Rwanda)"

    def handle(self, *args, **options):
        rates = [
            {"country_code": "KE", "country_name": "Kenya", "currency_code": "KES", "vat_percentage": Decimal("16.00"), "tax_identifier_name": "VAT / KRA PIN"},
            {"country_code": "UG", "country_name": "Uganda", "currency_code": "UGX", "vat_percentage": Decimal("18.00"), "tax_identifier_name": "VAT / URA TIN"},
            {"country_code": "TZ", "country_name": "Tanzania", "currency_code": "TZS", "vat_percentage": Decimal("18.00"), "tax_identifier_name": "VAT / TRA TIN"},
            {"country_code": "RW", "country_name": "Rwanda", "currency_code": "RWF", "vat_percentage": Decimal("18.00"), "tax_identifier_name": "VAT / RRA TIN"},
        ]

        for r in rates:
            obj, created = CountryTaxRate.objects.update_or_create(
                country_code=r["country_code"],
                defaults=r
            )
            status_text = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{status_text} tax rate for {obj.country_name}: {obj.vat_percentage}%"))
