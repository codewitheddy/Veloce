from django.urls import path
from .views import InventoryCheckView, ReserveCheckoutInventoryView, ReleaseReservationView

urlpatterns = [
    path('check/', InventoryCheckView.as_view(), name='inventory_check'),
    path('reserve/', ReserveCheckoutInventoryView.as_view(), name='inventory_reserve'),
    path('release/', ReleaseReservationView.as_view(), name='inventory_release'),
]
