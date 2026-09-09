from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomerViewSet,
    DealViewSet,
    InvoiceViewSet,
    CustomerOrderViewSet,
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'deals', DealViewSet, basename='deal')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'customer-orders', CustomerOrderViewSet, basename='customer-order')

urlpatterns = [
    path('', include(router.urls)),
]
