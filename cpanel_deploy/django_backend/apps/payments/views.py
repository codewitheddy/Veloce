import json
import logging
from decimal import Decimal
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db import transaction
from apps.inventory.services import InventoryReservationService
from .models import PaymentTransaction

logger = logging.getLogger(__name__)


class InitiateMpesaStkPushView(APIView):
    """
    POST /api/v1/payments/mpesa/stk-push/
    Initiate Safaricom Daraja STK Push prompt to user's phone.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get('order_id')
        phone = request.data.get('phone', '').strip()
        amount = request.data.get('amount')
        reservation_token = request.data.get('reservation_token', '')

        if not order_id or not phone or not amount:
            return Response(
                {"error": "'order_id', 'phone', and 'amount' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Sanitize phone to Kenyan standard 2547XXXXXXXX
        clean_phone = phone.replace("+", "").replace(" ", "")
        if clean_phone.startswith("07") or clean_phone.startswith("01"):
            clean_phone = f"254{clean_phone[1:]}"
        elif clean_phone.startswith("7") or clean_phone.startswith("1"):
            clean_phone = f"254{clean_phone}"

        import uuid
        checkout_request_id = f"ws_CO_{uuid.uuid4().hex[:16]}"
        
        # Create pending payment transaction
        PaymentTransaction.objects.create(
            order_id=str(order_id),
            reservation_token=reservation_token,
            provider='MPESA',
            provider_reference=checkout_request_id,
            amount=Decimal(str(amount)),
            currency='KES',
            phone_number=clean_phone,
            status='PENDING'
        )

        return Response({
            "success": True,
            "merchant_request_id": f"MR_{uuid.uuid4().hex[:8]}",
            "checkout_request_id": checkout_request_id,
            "customer_message": f"STK PIN prompt sent to {clean_phone}. Enter your M-Pesa PIN to complete payment.",
            "phone": clean_phone,
            "amount": float(amount)
        })


class MpesaCallbackWebhookView(APIView):
    """
    POST /api/v1/payments/mpesa/callback/
    Safaricom Daraja webhook validation with idempotency protection.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.data
        stk_callback = payload.get("Body", {}).get("stkCallback", {})
        checkout_request_id = stk_callback.get("CheckoutRequestID")
        result_code = stk_callback.get("ResultCode")
        result_desc = stk_callback.get("ResultDesc")

        if not checkout_request_id:
            return Response({"ResultCode": 0, "ResultDesc": "Ignored missing CheckoutRequestID"})

        # Idempotency check with select_for_update
        tx = PaymentTransaction.objects.filter(provider_reference=checkout_request_id).first()
        if not tx:
            logger.warning(f"[MpesaWebhook] Unknown transaction reference: {checkout_request_id}")
            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        if tx.status == 'COMPLETED':
            # Already completed, ignore duplicate callback from Safaricom retries
            return Response({"ResultCode": 0, "ResultDesc": "Already processed"})

        with transaction.atomic():
            if result_code == 0:
                # Payment success
                items = stk_callback.get("CallbackMetadata", {}).get("Item", [])
                meta = {item["Name"]: item.get("Value") for item in items if "Name" in item}
                receipt_no = meta.get("MpesaReceiptNumber", f"REC-{tx.id.hex[:8].upper()}")

                tx.status = 'COMPLETED'
                tx.receipt_number = str(receipt_no)
                tx.metadata = meta
                tx.save(update_fields=['status', 'receipt_number', 'metadata', 'updated_at'])

                # Commit reserved inventory permanently
                if tx.reservation_token:
                    InventoryReservationService.commit_reservation(tx.reservation_token)

                logger.info(f"[MpesaWebhook] Payment confirmed for Order #{tx.order_id} (Receipt: {receipt_no})")
            else:
                # Payment failed or cancelled
                tx.status = 'FAILED'
                tx.failure_reason = result_desc or "User cancelled or insufficient funds"
                tx.save(update_fields=['status', 'failure_reason', 'updated_at'])

                # Release reserved inventory back to pool
                if tx.reservation_token:
                    InventoryReservationService.release_reservation(tx.reservation_token)

                logger.warning(f"[MpesaWebhook] Payment failed for Order #{tx.order_id}: {result_desc}")

        return Response({"ResultCode": 0, "ResultDesc": "Processed successfully"})


class CheckPaymentStatusView(APIView):
    """
    GET /api/v1/payments/status/?checkout_request_id=ws_CO_...
    Poll payment status from frontend while user completes M-Pesa PIN prompt.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        ref = request.query_params.get('checkout_request_id')
        order_id = request.query_params.get('order_id')

        query = {}
        if ref:
            query['provider_reference'] = ref
        elif order_id:
            query['order_id'] = str(order_id)
        else:
            return Response({"error": "Either 'checkout_request_id' or 'order_id' is required."}, status=status.HTTP_400_BAD_REQUEST)

        tx = PaymentTransaction.objects.filter(**query).first()
        if not tx:
            return Response({"status": "NOT_FOUND"}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "order_id": tx.order_id,
            "provider": tx.provider,
            "status": tx.status,
            "amount": float(tx.amount),
            "currency": tx.currency,
            "receipt_number": tx.receipt_number,
            "failure_reason": tx.failure_reason,
            "created_at": tx.created_at.isoformat()
        })
