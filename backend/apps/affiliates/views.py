import random
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from core.permissions import IsStaffOrSuperuser
from .models import AffiliateProfile, CommissionEntry
from .serializers import AffiliateProfileSerializer, CommissionEntrySerializer


class AffiliateProfileViewSet(viewsets.ModelViewSet):
    serializer_class = AffiliateProfileSerializer

    def get_permissions(self):
        if self.action == 'by_code':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return AffiliateProfile.objects.none()
        if user.is_staff or user.is_superuser:
            return AffiliateProfile.objects.all()
        return AffiliateProfile.objects.filter(user=user)

    @action(detail=False, methods=['get'], url_path='by-code/(?P<code>[^/.]+)')
    def by_code(self, request, code=None):
        profile = AffiliateProfile.objects.filter(affiliate_code__iexact=code, status='active').first()
        if not profile:
            return Response({'error': 'Affiliate code not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(profile)
        return Response(serializer.data)


class CommissionEntryViewSet(viewsets.ModelViewSet):
    serializer_class = CommissionEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return CommissionEntry.objects.none()
        if user.is_staff or user.is_superuser:
            return CommissionEntry.objects.all()
        return CommissionEntry.objects.filter(affiliate__user=user)


class AuthorizePayoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data or {}
        affiliate_id = data.get('affiliateId')
        amount = float(data.get('amount', 0))
        payout_method = data.get('payoutMethod', 'M-Pesa Express B2C')

        if not affiliate_id or amount <= 0:
            return Response({'success': False, 'error': 'Valid affiliate ID and payout amount required.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount < 1000:
            return Response({'success': False, 'error': 'Minimum payout request threshold is KSh 1,000.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = AffiliateProfile.objects.filter(id=affiliate_id).first()
        if not profile:
            return Response({'success': False, 'error': 'Affiliate profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Anti-IDOR Authorization Check: User must own the affiliate profile unless staff
        if not (request.user.is_staff or request.user.is_superuser or profile.user == request.user):
            return Response({'success': False, 'error': 'Permission denied: You do not own this affiliate account.'}, status=status.HTTP_403_FORBIDDEN)

        if float(profile.pending_balance) < amount:
            return Response({'success': False, 'error': 'Insufficient pending commission balance.'}, status=status.HTTP_400_BAD_REQUEST)

        payout_token = f"PAYOUT-AUTH-{random.randint(100000, 999999)}"
        profile.pending_balance = max(0.0, float(profile.pending_balance) - amount)
        profile.paid_out = float(profile.paid_out) + amount
        profile.save()

        return Response({
            'success': True,
            'payoutToken': payout_token,
            'affiliateId': affiliate_id,
            'authorizedAmount': amount,
            'payoutMethod': payout_method,
            'status': 'approved_queued',
            'estimatedPayoutTime': 'Within 2 business hours',
            'message': 'Affiliate payout request authorized and scheduled for B2C transfer.'
        }, status=status.HTTP_200_OK)
