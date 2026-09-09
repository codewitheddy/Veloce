from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BlogPostViewSet,
    HeroBannerViewSet,
    EmailCampaignViewSet,
    CustomServiceRequestViewSet,
    SupportTicketViewSet,
    TicketMessageViewSet
)

router = DefaultRouter()
router.register('blog', BlogPostViewSet, basename='blog')
router.register('hero-banners', HeroBannerViewSet, basename='hero-banners')
router.register('email-campaigns', EmailCampaignViewSet, basename='email-campaigns')
router.register('custom-service-requests', CustomServiceRequestViewSet, basename='custom-service-requests')
router.register('support-tickets', SupportTicketViewSet, basename='support-tickets')
router.register('ticket-messages', TicketMessageViewSet, basename='ticket-messages')

urlpatterns = [
    path('', include(router.urls)),
]
