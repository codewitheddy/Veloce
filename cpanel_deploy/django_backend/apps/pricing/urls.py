from django.urls import path
from .views import CountryTaxRatesListView, CalculateCheckoutTaxView

urlpatterns = [
    path('tax-rates/', CountryTaxRatesListView.as_view(), name='pricing_tax_rates'),
    path('calculate-tax/', CalculateCheckoutTaxView.as_view(), name='pricing_calculate_tax'),
]
