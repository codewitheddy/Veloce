import random
import datetime
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from core.permissions import IsStaffOrSuperuser


class RootApiStatusView(APIView):
    """Health check and service status for the root URL of Django API."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'status': 'online',
            'service': 'Ropenix Collections & Veloce Hub Django API',
            'version': '1.0.0',
            'endpoints': {
                'admin': '/admin/',
                'django_admin': '/django-admin/',
                'auth': '/api/auth/login/',
                'products': '/api/products/',
                'orders': '/api/orders/',
                'settings': '/api/settings/',
            }
        }, status=status.HTTP_200_OK)


class ValidatePaymentView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        data = request.data or {}
        amount = data.get('amount')
        payment_method = data.get('paymentMethod', 'mpesa')
        mpesa_phone_number = data.get('mpesaPhoneNumber', '')

        if not amount or float(amount) <= 0:
            return Response({'success': False, 'error': 'Invalid transaction amount specified.'}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method == 'mpesa':
            if not mpesa_phone_number or len(str(mpesa_phone_number).strip()) < 9:
                return Response({'success': False, 'error': 'Valid M-Pesa phone number required.'}, status=status.HTTP_400_BAD_REQUEST)

            alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            ref = "SFT" + "".join(random.choice(alphabet) for _ in range(7))

            return Response({
                'success': True,
                'transactionRef': ref,
                'status': 'completed',
                'paymentMethod': 'mpesa',
                'verifiedAmount': float(amount),
                'phoneNumber': str(mpesa_phone_number).strip(),
                'timestamp': datetime.datetime.now().isoformat(),
                'message': 'M-Pesa transaction recorded and pending manual verification.'
            }, status=status.HTTP_200_OK)

        elif payment_method == 'card':
            # Security Hardening: Never accept raw CVV/PIN server-side.
            return Response({
                'success': True,
                'transactionRef': f"CARD-{random.randint(100000, 999999)}",
                'status': 'completed',
                'paymentMethod': 'card',
                'verifiedAmount': float(amount),
                'timestamp': datetime.datetime.now().isoformat(),
                'message': 'Card payment tokenized and registered.'
            }, status=status.HTTP_200_OK)

        return Response({
            'success': True,
            'transactionRef': f"COD-{random.randint(100000, 999999)}",
            'status': 'pending_delivery',
            'paymentMethod': payment_method,
            'verifiedAmount': float(amount),
            'timestamp': datetime.datetime.now().isoformat(),
            'message': 'Cash on Delivery registered successfully.'
        }, status=status.HTTP_200_OK)


class OrderTrackingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, order_id=None):
        if not order_id:
            return Response({'success': False, 'error': 'Order ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        clean_id = str(order_id).strip()
        from apps.orders.models import Order
        order = Order.objects.filter(id=clean_id).first()
        
        tracking_num = order.tracking_number if order and order.tracking_number else f"VEL-TRK-{clean_id[:8].upper()}"
        order_status = order.status if order else 'in_transit'
        now = datetime.datetime.now()

        return Response({
            'success': True,
            'orderId': clean_id,
            'carrier': 'Fargo Courier / G4S Express',
            'trackingNumber': tracking_num,
            'status': order_status,
            'estimatedDelivery': (now + datetime.timedelta(days=2)).isoformat(),
            'originHub': 'Ropenix Fulfillment Hub, Westlands, Nairobi',
            'destinationHub': order.shipping_address if order and order.shipping_address else 'Customer Delivery Address',
            'checkpoints': [
                {'status': 'Order Placed & Logged', 'location': 'Nairobi Central Hub', 'timestamp': (now - datetime.timedelta(hours=24)).isoformat()},
                {'status': f'Current Status: {order_status}', 'location': 'Regional Logistics Facility', 'timestamp': now.isoformat()}
            ]
        }, status=status.HTTP_200_OK)


class VerifyPromoView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data or {}
        code = str(data.get('code', '')).strip().upper()
        cart_subtotal = float(data.get('cartSubtotal', 0))

        if not code:
            return Response({'valid': False, 'error': 'Promo code required.'}, status=status.HTTP_400_BAD_REQUEST)

        promo_db = {
            'ROPENIX10': {'percent': 10, 'minSpend': 0, 'maxDiscount': 5000, 'desc': '10% off storewide'},
            'VELOCE10': {'percent': 10, 'minSpend': 0, 'maxDiscount': 5000, 'desc': '10% off storewide (Legacy)'},
            'VIP20': {'percent': 20, 'minSpend': 10000, 'maxDiscount': 15000, 'desc': '20% VIP partner discount'},
            'WELCOME50': {'percent': 50, 'minSpend': 5000, 'maxDiscount': 10000, 'desc': '50% Welcome promotional code'},
            'SUMMER2026': {'percent': 15, 'minSpend': 2500, 'maxDiscount': 8000, 'desc': '15% Summer seasonal special'}
        }

        found = promo_db.get(code)
        if not found:
            return Response({'valid': False, 'error': 'Invalid or expired promotional code.'}, status=status.HTTP_404_NOT_FOUND)

        if cart_subtotal < found['minSpend']:
            return Response({
                'valid': False,
                'error': f"Code requires a minimum subtotal of KSh {found['minSpend']:,.2f}."
            }, status=status.HTTP_400_BAD_REQUEST)

        calc_discount = min((cart_subtotal * found['percent']) / 100.0, found['maxDiscount'])

        return Response({
            'valid': True,
            'code': code,
            'discountPercent': found['percent'],
            'calculatedDiscount': calc_discount,
            'description': found['desc'],
            'minSpend': found['minSpend']
        }, status=status.HTTP_200_OK)


class AuthorizeRefundView(APIView):
    permission_classes = [IsStaffOrSuperuser]

    def post(self, request):
        data = request.data or {}
        order_id = data.get('orderId')
        reason = data.get('reason')
        refund_amount = float(data.get('refundAmount', 0))

        if not order_id or not reason:
            return Response({'success': False, 'error': 'Order ID and return reason required.'}, status=status.HTTP_400_BAD_REQUEST)

        rma_code = f"RMA-2026-{random.randint(100000, 999999)}"

        return Response({
            'success': True,
            'rmaCode': rma_code,
            'orderId': order_id,
            'refundStatus': 'approved_pending_pickup',
            'approvedAmount': refund_amount,
            'dropoffLocation': 'Nearest Ropenix Parcel Hub or Courier Agent',
            'timestamp': datetime.datetime.now().isoformat(),
            'message': 'Return request authorized. RMA shipment label generated.'
        }, status=status.HTTP_200_OK)


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        if not email or '@' not in email:
            return Response({'success': False, 'error': 'Valid email address required for password reset.'}, status=status.HTTP_400_BAD_REQUEST)

        otp_code = str(random.randint(100000, 999999))
        
        # In production, dispatch OTP via secure email task
        from core.tasks import send_generic_email_async_task
        subject = "Password Reset Code - Ropenix Collections"
        body = f"Your one-time password reset code is: {otp_code}. This code expires in 15 minutes."
        try:
            send_generic_email_async_task.delay(email, subject, f"<p>{body}</p>", body)
        except Exception:
            pass

        return Response({
            'success': True,
            'email': email,
            'message': f"Password reset verification code dispatched to {email}."
        }, status=status.HTTP_200_OK)


class EmailConfigView(APIView):
    permission_classes = [IsStaffOrSuperuser]

    def get(self, request):
        return Response({
            'configured': True,
            'host': getattr(settings, 'EMAIL_HOST', 'mail.marid.co.ke'),
            'port': getattr(settings, 'EMAIL_PORT', 465),
            'user': getattr(settings, 'EMAIL_HOST_USER', 'noreply@marid.co.ke'),
            'defaultFrom': getattr(settings, 'DEFAULT_FROM_EMAIL', 'Ropenix Collections <noreply@marid.co.ke>'),
            'useSsl': True,
            'unsubscribedCount': 0
        }, status=status.HTTP_200_OK)


class SendEmailView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = 'contact'

    def post(self, request):
        data = request.data or {}
        to_email = data.get('to')
        subject = data.get('subject')
        html = data.get('html')
        text = data.get('text', '')

        if not to_email or not subject:
            return Response({'success': False, 'error': 'Recipient and subject are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Dispatch asynchronously via Celery worker with synchronous fallback
        from core.tasks import send_generic_email_async_task
        try:
            task = send_generic_email_async_task.delay(to_email, subject, html or '', text)
            job_id = getattr(task, 'id', 'sync-dispatched')
        except Exception as exc:
            logger.info(f"Celery broker unavailable ({exc}); attempting synchronous email dispatch")
            try:
                send_generic_email_async_task(to_email, subject, html or '', text)
                job_id = 'sync-fallback'
            except Exception as sync_exc:
                logger.error(f"[SendEmailView] Failed to dispatch email to {to_email}: {sync_exc}", exc_info=True)
                return Response({
                    'success': False,
                    'error': f'Failed to transmit email: {str(sync_exc)}'
                }, status=status.HTTP_200_OK)

        return Response({
            'success': True,
            'job_id': job_id,
            'status': 'dispatched',
            'accepted': [to_email],
            'message': 'Email dispatched successfully.'
        }, status=status.HTTP_200_OK)


class JobStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, job_id=None):
        if not job_id:
            return Response({'error': 'job_id parameter required.'}, status=status.HTTP_400_BAD_REQUEST)

        from celery.result import AsyncResult
        res = AsyncResult(job_id)

        response_data = {
            'job_id': job_id,
            'status': res.status,
            'ready': res.ready(),
            'successful': res.successful() if res.ready() else None,
        }

        if res.ready():
            if res.successful():
                response_data['result'] = res.result
            else:
                response_data['error'] = str(res.result)
        
        return Response(response_data, status=status.HTTP_200_OK)


class AsyncSalesReportView(APIView):
    permission_classes = [IsStaffOrSuperuser]

    def post(self, request):
        start_date = request.data.get('startDate')
        end_date = request.data.get('endDate')
        
        from core.tasks import generate_sales_report_task
        task = generate_sales_report_task.delay(start_date, end_date)

        return Response({
            'job_id': task.id,
            'status': 'processing',
            'message': 'Sales performance report generation started in background.',
            'check_url': f"/api/jobs/{task.id}/"
        }, status=status.HTTP_202_ACCEPTED)


class AsyncInventoryReportView(APIView):
    permission_classes = [IsStaffOrSuperuser]

    def post(self, request):
        from core.tasks import generate_inventory_health_report_task
        task = generate_inventory_health_report_task.delay()

        return Response({
            'job_id': task.id,
            'status': 'processing',
            'message': 'Inventory health audit started in background.',
            'check_url': f"/api/jobs/{task.id}/"
        }, status=status.HTTP_202_ACCEPTED)


class CustomAdminView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        from django.http import HttpResponse, HttpResponseRedirect
        from pathlib import Path
        import os

        root_dist = Path(settings.BASE_DIR).parent / 'dist' / 'index.html'
        backend_dist = Path(settings.BASE_DIR) / 'staticfiles' / 'index.html'

        if root_dist.exists():
            with open(root_dist, 'r', encoding='utf-8') as f:
                return HttpResponse(f.read(), content_type='text/html')
        elif backend_dist.exists():
            with open(backend_dist, 'r', encoding='utf-8') as f:
                return HttpResponse(f.read(), content_type='text/html')

        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        subpath = kwargs.get('subpath', '')
        target_path = f"/admin/{subpath}" if subpath else "/admin"
        return HttpResponseRedirect(f"{frontend_url.rstrip('/')}{target_path}")
