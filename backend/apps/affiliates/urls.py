from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AffiliateProfileViewSet, CommissionEntryViewSet, AuthorizePayoutView

router = DefaultRouter()
router.register(r'profiles', AffiliateProfileViewSet, basename='affiliate-profile')
router.register(r'commissions', CommissionEntryViewSet, basename='commission-entry')

urlpatterns = [
    path('authorize-payout/', AuthorizePayoutView.as_view(), name='authorize-payout'),
    path('', include(router.urls)),
]
