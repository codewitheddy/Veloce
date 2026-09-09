import datetime
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import ShippingZone, HappyHourWindow
from .serializers import ShippingZoneSerializer, HappyHourWindowSerializer

class ShippingZoneViewSet(viewsets.ModelViewSet):
    queryset = ShippingZone.objects.all()
    serializer_class = ShippingZoneSerializer
    permission_classes = [permissions.AllowAny]


class HappyHourWindowViewSet(viewsets.ModelViewSet):
    queryset = HappyHourWindow.objects.all()
    serializer_class = HappyHourWindowSerializer
    permission_classes = [permissions.AllowAny]


class CalculateDeliveryFeeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data or {}
        order_subtotal = float(data.get('orderSubtotal', 0))
        distance_km = float(data.get('distanceKm', 5.0))
        is_express = bool(data.get('isExpress', False))
        is_happy_hour = data.get('isHappyHour', None) # True/False or None for auto
        free_delivery_threshold = float(data.get('freeDeliveryThreshold', 5000))

        # Check max distance
        if distance_km > 60:
            return Response({
                'fee': 0,
                'originalFee': 0,
                'discount': 0,
                'isFree': False,
                'reason': 'Distance exceeds maximum deliverable radius (60 KM).',
                'reasonCode': 'out_of_range',
                'estimatedTimeframe': 'Contact Support for Freight',
                'breakdown': {
                    'baseFee': 0,
                    'distanceFee': 0,
                    'expressSurcharge': 0,
                    'discountAmount': 0
                }
            }, status=status.HTTP_200_OK)

        # Free threshold check
        if order_subtotal >= free_delivery_threshold:
            return Response({
                'fee': 0,
                'originalFee': 250,
                'discount': 250,
                'isFree': True,
                'reason': f'FREE Delivery unlocked for orders over KSh {free_delivery_threshold:,.2f}!',
                'reasonCode': 'free_threshold',
                'estimatedTimeframe': '20-40 mins',
                'breakdown': {
                    'baseFee': 250,
                    'distanceFee': 0,
                    'expressSurcharge': 0,
                    'discountAmount': 250
                }
            }, status=status.HTTP_200_OK)

        # Find matching zone
        zone = ShippingZone.objects.filter(
            is_active=True,
            min_distance_km__lte=distance_km,
            max_distance_km__gte=distance_km
        ).first()

        if zone:
            base_fee = float(zone.base_fee)
            per_km_rate = float(zone.per_km_rate)
            extra_dist = max(0.0, distance_km - zone.min_distance_km)
            dist_fee = extra_dist * per_km_rate
            timeframe = zone.estimated_delivery_time
        else:
            base_fee = 200.0
            per_km_rate = 30.0
            extra_dist = max(0.0, distance_km - 5.0)
            dist_fee = extra_dist * per_km_rate
            timeframe = '35-50 mins'

        express_surcharge = 150.0 if is_express else 0.0
        gross_fee = base_fee + dist_fee + express_surcharge

        # Check Happy Hour
        hh_discount_pct = 0
        if is_happy_hour is True:
            hh_discount_pct = 50
        elif is_happy_hour is None:
            # Auto evaluate active happy hour
            now = datetime.datetime.now()
            current_time = now.strftime('%H:%M')
            current_dow = now.weekday()  # Mon=0, Sun=6 in python, JS Sun=0. Normalize:
            js_dow = (current_dow + 1) % 7
            active_hh = HappyHourWindow.objects.filter(is_active=True).first()
            if active_hh and js_dow in active_hh.days_of_week and active_hh.start_time <= current_time <= active_hh.end_time:
                hh_discount_pct = active_hh.discount_percentage

        discount_amount = (gross_fee * hh_discount_pct) / 100.0 if hh_discount_pct > 0 else 0.0
        final_fee = max(0.0, gross_fee - discount_amount)

        reason_code = 'happy_hour' if hh_discount_pct > 0 else 'standard'
        reason = f"Happy Hour Special ({hh_discount_pct}% OFF delivery fee) applied!" if hh_discount_pct > 0 else "Standard distance-based shipping rate applied."

        return Response({
            'fee': round(final_fee, 2),
            'originalFee': round(gross_fee, 2),
            'discount': round(discount_amount, 2),
            'isFree': final_fee == 0,
            'reason': reason,
            'reasonCode': reason_code,
            'estimatedTimeframe': timeframe,
            'breakdown': {
                'baseFee': round(base_fee, 2),
                'distanceFee': round(dist_fee, 2),
                'expressSurcharge': round(express_surcharge, 2),
                'discountAmount': round(discount_amount, 2)
            }
        }, status=status.HTTP_200_OK)
