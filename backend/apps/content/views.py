from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    BlogPost,
    HeroBanner,
    EmailCampaign,
    CustomServiceRequest,
    SupportTicket,
    TicketMessage
)
from .serializers import (
    BlogPostSerializer,
    HeroBannerSerializer,
    EmailCampaignSerializer,
    CustomServiceRequestSerializer,
    SupportTicketSerializer,
    TicketMessageSerializer
)

class BlogPostViewSet(viewsets.ModelViewSet):
    queryset = BlogPost.objects.all()
    serializer_class = BlogPostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'slug'

class HeroBannerViewSet(viewsets.ModelViewSet):
    serializer_class = HeroBannerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        # Allow staff or request with query param all=true to see all banners
        show_all = self.request.query_params.get('all', 'false').lower() == 'true'
        if show_all or (self.request.user and self.request.user.is_staff):
            return HeroBanner.objects.all().order_by('display_order', '-created_at')

        now = timezone.now()
        # Active banners within scheduling window (or with no schedule bounds)
        return HeroBanner.objects.filter(
            is_active=True
        ).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=now)
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=now)
        ).order_by('display_order', '-created_at')

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def reorder(self, request):
        """Update display orders in batch: payload { order: [id1, id2, id3] }"""
        order_list = request.data.get('order', [])
        if not isinstance(order_list, list):
            return Response({'error': 'Order must be a list of IDs'}, status=status.HTTP_400_BAD_REQUEST)

        for idx, banner_id in enumerate(order_list):
            HeroBanner.objects.filter(id=banner_id).update(display_order=idx + 1)

        return Response({'status': 'reordered', 'total': len(order_list)})

class EmailCampaignViewSet(viewsets.ModelViewSet):
    queryset = EmailCampaign.objects.all()
    serializer_class = EmailCampaignSerializer
    permission_classes = [permissions.IsAdminUser]

class CustomServiceRequestViewSet(viewsets.ModelViewSet):
    queryset = CustomServiceRequest.objects.all()
    serializer_class = CustomServiceRequestSerializer
    permission_classes = [permissions.AllowAny]

class SupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.all()
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.AllowAny]

class TicketMessageViewSet(viewsets.ModelViewSet):
    queryset = TicketMessage.objects.all()
    serializer_class = TicketMessageSerializer
    permission_classes = [permissions.AllowAny]
