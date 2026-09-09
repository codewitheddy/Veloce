from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from apps.pricing.models import CountryTaxRate


class PricingAndTaxTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        CountryTaxRate.objects.create(
            country_code="KE",
            country_name="Kenya",
            currency_code="KES",
            vat_percentage=Decimal("16.00")
        )
        CountryTaxRate.objects.create(
            country_code="UG",
            country_name="Uganda",
            currency_code="UGX",
            vat_percentage=Decimal("18.00")
        )

    def test_country_tax_rate_lookup(self):
        ke_rate = CountryTaxRate.get_rate("KE")
        ug_rate = CountryTaxRate.get_rate("UG")
        self.assertEqual(ke_rate, Decimal("16.00"))
        self.assertEqual(ug_rate, Decimal("18.00"))

    def test_calculate_tax_api_kenya(self):
        response = self.client.post('/api/v1/pricing/calculate-tax/', {
            "country_code": "KE",
            "subtotal": 10000.0,
            "discount_amount": 1000.0,
            "shipping_fee": 500.0
        }, format='json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["taxable_amount"], 9000.0)
        self.assertEqual(data["vat_amount"], 1440.0)  # 16% of 9000
        self.assertEqual(data["total_amount"], 10940.0)  # 9000 + 1440 + 500
