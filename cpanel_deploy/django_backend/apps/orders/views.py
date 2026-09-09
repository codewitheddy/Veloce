from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from core.permissions import IsStaffOrSuperuser
from .models import Order
from .serializers import OrderSerializer
from .tasks import dispatch_order_status_email


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    throttle_scope = 'checkout'

    def get_permissions(self):
        """
        Custom permission matrix:
        - create (checkout): AllowAny (supports authenticated & guest checkout)
        - list, retrieve: IsAuthenticated (or Staff)
        - update, partial_update, destroy: IsStaffOrSuperuser
        """
        if self.action == 'create':
            return [permissions.AllowAny()]
        elif self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return [IsStaffOrSuperuser()]

    def get_queryset(self):
        """
        Anti-IDOR Protection:
        - Staff can view all orders.
        - Authenticated customers can strictly view their own orders (linked by user account or email).
        - Anonymous users cannot list all orders.
        """
        user = self.request.user
        if not user or not user.is_authenticated:
            return Order.objects.none()

        if user.is_staff or user.is_superuser:
            return Order.objects.all().select_related('user').prefetch_related('items__product').order_by('-created_at')

        return Order.objects.filter(
            Q(user=user) | Q(customer_email__iexact=user.email)
        ).select_related('user').prefetch_related('items__product').order_by('-created_at')

    def perform_create(self, serializer):
        """
        Automatically links order to authenticated user if logged in,
        ensuring admin/staff tokens do not attach admin identity to customer orders.
        """
        user = self.request.user
        if user and user.is_authenticated:
            customer_email = serializer.validated_data.get('customer_email', '').strip().lower()
            if user.is_staff or user.is_superuser:
                if customer_email and user.email and customer_email == user.email.strip().lower():
                    serializer.save(user=user)
                else:
                    serializer.save()
            else:
                serializer.save(user=user)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='resend-confirmation', permission_classes=[IsStaffOrSuperuser])
    def resend_confirmation(self, request, pk=None):
        """
        Manually triggers a fresh order notification dispatch (Staff only).
        """
        order = self.get_object()
        dispatch_order_status_email(str(order.id), None, str(order.status), str(order.tracking_number or ''))
        return Response({
            'success': True,
            'message': f"Order notification email dispatched for Order #{order.id[:8]}",
        }, status=status.HTTP_200_OK)
