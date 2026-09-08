from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from apps.payments.models import PaymentTransaction


class PaymentWebhookTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_stk_push_initiation(self):
        response = self.client.post('/api/v1/payments/mpesa/stk-push/', {
            "order_id": "ORD-TEST-101",
            "phone": "0712345678",
            "amount": 2500.0,
            "reservation_token": "RES-TEST1234"
        }, format='json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["phone"], "254712345678")

        # Verify transaction in DB
        tx = PaymentTransaction.objects.filter(order_id="ORD-TEST-101").first()
        self.assertIsNotNone(tx)
        self.assertEqual(tx.amount, Decimal("2500.00"))
        self.assertEqual(tx.status, "PENDING")

    def test_mpesa_webhook_idempotency_success(self):
        tx = PaymentTransaction.objects.create(
            order_id="ORD-TEST-202",
            provider="MPESA",
            provider_reference="ws_CO_TEST_REF_999",
            amount=Decimal("3500.00"),
            currency="KES",
            phone_number="254712345678",
            status="PENDING"
        )

        callback_payload = {
            "Body": {
                "stkCallback": {
                    "MerchantRequestID": "MR_123",
                    "CheckoutRequestID": "ws_CO_TEST_REF_999",
                    "ResultCode": 0,
                    "ResultDesc": "The service request is processed successfully.",
                    "CallbackMetadata": {
                        "Item": [
                            {"Name": "Amount", "Value": 3500.0},
                            {"Name": "MpesaReceiptNumber", "Value": "QAB99887766"},
                            {"Name": "PhoneNumber", "Value": 254712345678}
                        ]
                    }
                }
            }
        }

        # 1. First webhook delivery
        res1 = self.client.post('/api/v1/payments/mpesa/callback/', callback_payload, format='json')
        self.assertEqual(res1.status_code, 200)

        tx.refresh_from_db()
        self.assertEqual(tx.status, "COMPLETED")
        self.assertEqual(tx.receipt_number, "QAB99887766")

        # 2. Duplicate retry from Safaricom
        res2 = self.client.post('/api/v1/payments/mpesa/callback/', callback_payload, format='json')
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.json()["ResultDesc"], "Already processed")
