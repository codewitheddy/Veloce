from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet,
    SupplierProductViewSet,
    SupplierIntakeBatchViewSet,
    SupplierPaymentViewSet,
    SupplierAnalyticsDashboardView,
    SupplierReportsView
)

router = DefaultRouter()
router.register(r'directory', SupplierViewSet, basename='supplier_directory')
router.register(r'products', SupplierProductViewSet, basename='supplier_products')
router.register(r'intakes', SupplierIntakeBatchViewSet, basename='supplier_intakes')
router.register(r'payments', SupplierPaymentViewSet, basename='supplier_payments')

urlpatterns = [
    path('analytics/dashboard/', SupplierAnalyticsDashboardView.as_view(), name='supplier_analytics_dashboard'),
    path('reports/', SupplierReportsView.as_view(), name='supplier_reports'),
    path('', include(router.urls)),
]
