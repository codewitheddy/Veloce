from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from .models import CountryTaxRate, ProductPrice


class CountryTaxRatesListView(APIView):
    """
    GET /api/v1/pricing/tax-rates/
    Return active VAT / tax rate lookup table across East Africa.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        rates = CountryTaxRate.objects.filter(is_active=True)
        data = [
            {
                "country_code": r.country_code,
                "country_name": r.country_name,
                "currency_code": r.currency_code,
                "vat_percentage": float(r.vat_percentage),
                "tax_identifier_name": r.tax_identifier_name,
            }
            for r in rates
        ]
        return Response({
            "count": len(data),
            "results": data,
            "default_country": "KE"
        })


class CalculateCheckoutTaxView(APIView):
    """
    POST /api/v1/pricing/calculate-tax/
    Calculate subtotal, VAT amount, and gross total for a given shipping country.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        country_code = request.data.get('country_code', 'KE')
        subtotal = float(request.data.get('subtotal', 0.0))
        shipping_fee = float(request.data.get('shipping_fee', 0.0))
        discount_amount = float(request.data.get('discount_amount', 0.0))

        rate = CountryTaxRate.get_rate(country_code)
        taxable_amount = max(0.0, subtotal - discount_amount)
        # In East Africa retail pricing, VAT is often included in list price or added at checkout
        vat_amount = round(taxable_amount * (float(rate) / 100.0), 2)
        total = round(taxable_amount + vat_amount + shipping_fee, 2)

        return Response({
            "country_code": country_code.upper(),
            "vat_rate_percentage": float(rate),
            "subtotal": round(subtotal, 2),
            "discount_amount": round(discount_amount, 2),
            "taxable_amount": round(taxable_amount, 2),
            "vat_amount": vat_amount,
            "shipping_fee": round(shipping_fee, 2),
            "total_amount": total
        })
