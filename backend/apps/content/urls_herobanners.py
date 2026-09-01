from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HeroBannerViewSet

router = DefaultRouter()
router.register('', HeroBannerViewSet, basename='hero-banners-direct')

urlpatterns = [
    path('', include(router.urls)),
]
