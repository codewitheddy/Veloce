from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ShippingZoneViewSet, HappyHourWindowViewSet, CalculateDeliveryFeeView

router = DefaultRouter()
router.register(r'zones', ShippingZoneViewSet, basename='shipping-zone')
router.register(r'happy-hours', HappyHourWindowViewSet, basename='happy-hour')

urlpatterns = [
    path('calculate-fee/', CalculateDeliveryFeeView.as_view(), name='calculate-delivery-fee'),
    path('', include(router.urls)),
]
