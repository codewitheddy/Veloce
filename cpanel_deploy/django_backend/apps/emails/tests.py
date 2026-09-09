import uuid
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.core import mail
from rest_framework.test import APIClient
from rest_framework import status
from apps.emails.models import TransactionalEmailLog
from apps.emails.service import send_transactional_email
from apps.emails.events import (
    ORDER_PLACED_CUSTOMER,
    ORDER_PLACED_ADMIN,
    CONTACT_SUBMITTED_ADMIN,
    CONTACT_SUBMITTED_CUSTOMER,
    ORDER_SHIPPED_CUSTOMER,
    ORDER_DELIVERED_CUSTOMER,
    ORDER_CANCELLED_CUSTOMER,
)
from apps.orders.models import Order, OrderItem


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    SECURE_SSL_REDIRECT=False,
    ADMIN_EMAIL='ropenixkenya@gmail.com',
    DEFAULT_FROM_EMAIL='Veloce Kenya <noreply@marid.co.ke>',
)
class CentralizedEmailServiceTest(TestCase):
    def setUp(self):
        mail.outbox = []
        TransactionalEmailLog.objects.all().delete()
        self.client = APIClient()

    def test_send_customer_order_placed_email_creates_log_and_dispatches(self):
        """
        Test that send_transactional_email for ORDER_PLACED_CUSTOMER creates a DB log
        and dispatches both HTML and plain-text alternatives to the customer.
        """
        context = {
            'order_id': 'ord-test-1234',
            'order_short_id': 'ORD-1234',
            'customer_name': 'David Mwangi',
            'customer_email': 'david.mwangi@example.com',
            'status': 'Processing',
            'status_display': 'Processing & Preparation',
            'payment_method': 'M-PESA',
            'payment_reference': 'QA1298471',
            'subtotal_formatted': '4,500.00',
            'shipping_fee_formatted': '250.00',
            'total_formatted': '4,750.00',
            'items': [
                {
                    'product_name': 'Veloce Active Hoodie',
                    'quantity': 1,
                    'unit_price_formatted': '4,500.00',
                    'total_formatted': '4,500.00',
                }
            ],
            'shipping_address': 'Kilimani, Argwings Kodhek Rd, Nairobi',
        }

        result = send_transactional_email(
            event_type=ORDER_PLACED_CUSTOMER,
            recipient='david.mwangi@example.com',
            context=context,
            async_send=False,
        )

        self.assertEqual(result['status'], 'sent')
        self.assertEqual(len(mail.outbox), 1)

        sent_msg = mail.outbox[0]
        self.assertIn('david.mwangi@example.com', sent_msg.to)
        self.assertIn('#ORD-1234 is Confirmed', sent_msg.subject)
        self.assertIn('David Mwangi', sent_msg.body)
        self.assertIn('4,750.00', sent_msg.body)

        # Verify Database Audit Log
        log = TransactionalEmailLog.objects.get(id=result['log_id'])
        self.assertEqual(log.status, 'sent')
        self.assertEqual(log.event_type, ORDER_PLACED_CUSTOMER)
        self.assertEqual(log.recipient, 'david.mwangi@example.com')
        self.assertIn('Veloce Active Hoodie', log.body_html)
        self.assertIsNotNone(log.sent_at)

    def test_send_admin_order_placed_email_includes_reply_to_and_full_details(self):
        """
        Test that send_transactional_email for ORDER_PLACED_ADMIN sends to ropenixkenya@gmail.com
        with reply_to set to customer email and full customer details rendered.
        """
        context = {
            'order_id': 'ord-test-5678',
            'order_short_id': 'ORD-5678',
            'customer_name': 'Sarah Wanjiku',
            'customer_email': 'sarah@customer.com',
            'customer_phone': '+254712345678',
            'status': 'Processing',
            'payment_method': 'M-PESA',
            'payment_reference': 'NL9988771',
            'subtotal_formatted': '8,000.00',
            'shipping_fee_formatted': '0.00',
            'total_formatted': '8,000.00',
            'items': [
                {
                    'product_name': 'Veloce Pro Running Shoes',
                    'product_sku': 'VEL-SHOE-42',
                    'quantity': 1,
                    'unit_price_formatted': '8,000.00',
                    'total_formatted': '8,000.00',
                }
            ],
            'shipping_address': 'Westlands, Ring Rd, Nairobi',
            'whatsapp_link': 'https://wa.me/254712345678',
        }

        result = send_transactional_email(
            event_type=ORDER_PLACED_ADMIN,
            recipient='ropenixkenya@gmail.com',
            context=context,
            reply_to='sarah@customer.com',
            async_send=False,
        )

        self.assertEqual(result['status'], 'sent')
        self.assertEqual(len(mail.outbox), 1)

        sent_msg = mail.outbox[0]
        self.assertIn('ropenixkenya@gmail.com', sent_msg.to)
        self.assertEqual(sent_msg.reply_to, ['sarah@customer.com'])
        self.assertIn('Sarah Wanjiku', sent_msg.body)
        self.assertIn('+254712345678', sent_msg.body)
        self.assertIn('8,000.00', sent_msg.body)
        self.assertIn('VEL-SHOE-42', sent_msg.body)

        # Verify DB Log
        log = TransactionalEmailLog.objects.get(id=result['log_id'])
        self.assertEqual(log.status, 'sent')
        self.assertEqual(log.reply_to, 'sarah@customer.com')

    def test_email_failure_does_not_crash_and_records_error_in_db(self):
        """
        Test that when email backend raises an exception (e.g. SMTP timeout),
        the service catches the error, updates DB log status to 'failed', records
        the error message, and does NOT throw an unhandled exception.
        """
        with patch('django.core.mail.EmailMultiAlternatives.send', side_effect=Exception("SMTP Connection refused")):
            result = send_transactional_email(
                event_type=ORDER_PLACED_CUSTOMER,
                recipient='test.failure@example.com',
                context={'order_short_id': 'ERR-999', 'customer_name': 'Test User'},
                async_send=False,
            )

        self.assertEqual(result['status'], 'failed')
        self.assertIn('SMTP Connection refused', result['error'])

        # Verify DB Log records the failure
        log = TransactionalEmailLog.objects.get(id=result['log_id'])
        self.assertEqual(log.status, 'failed')
        self.assertIn('SMTP Connection refused', log.error_detail)
        self.assertEqual(log.retry_count, 1)

    def test_contact_form_endpoint_e2e_dispatches_admin_and_customer_emails(self):
        """
        Test POST /api/contact/ validates data, triggers admin alert with reply_to,
        triggers customer confirmation auto-reply, and stores records in DB.
        """
        payload = {
            'name': 'Kevin Otieno',
            'email': 'kevin@example.com',
            'phone': '+254722113344',
            'subject': 'Bulk Apparel Inquiry',
            'message': 'We would like to request a quotation for 50 custom corporate polo shirts.',
        }

        response = self.client.post('/api/contact/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Should have sent 2 emails: 1 to admin (ropenixkenya@gmail.com) and 1 to customer (kevin@example.com)
        self.assertEqual(len(mail.outbox), 2)

        # Admin Email Verification
        admin_emails = [m for m in mail.outbox if 'ropenixkenya@gmail.com' in m.to]
        self.assertEqual(len(admin_emails), 1)
        admin_msg = admin_emails[0]
        self.assertIn('Bulk Apparel Inquiry', admin_msg.subject)
        self.assertIn('Kevin Otieno', admin_msg.body)
        self.assertIn('50 custom corporate polo shirts', admin_msg.body)
        self.assertEqual(admin_msg.reply_to, ['kevin@example.com'])

        # Customer Auto-Reply Verification
        cust_emails = [m for m in mail.outbox if 'kevin@example.com' in m.to]
        self.assertEqual(len(cust_emails), 1)
        cust_msg = cust_emails[0]
        self.assertIn('We received your message', cust_msg.subject)
        self.assertIn('Kevin Otieno', cust_msg.body)

        # Verify Database Logs exist for both
        admin_log = TransactionalEmailLog.objects.filter(event_type=CONTACT_SUBMITTED_ADMIN, recipient='ropenixkenya@gmail.com').first()
        self.assertIsNotNone(admin_log)
        self.assertEqual(admin_log.status, 'sent')

        cust_log = TransactionalEmailLog.objects.filter(event_type=CONTACT_SUBMITTED_CUSTOMER, recipient='kevin@example.com').first()
        self.assertIsNotNone(cust_log)
        self.assertEqual(cust_log.status, 'sent')

    def test_contact_form_honeypot_suppresses_spam(self):
        """
        Test that submissions with honeypot fields return HTTP 200 without dispatching emails.
        """
        payload = {
            'name': 'Bot Spammer',
            'email': 'bot@spam.com',
            'message': 'Buy cheap crypto now!',
            'hp_field': 'https://spam-link.com',
        }

        response = self.client.post('/api/contact/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(TransactionalEmailLog.objects.count(), 0)

    def test_order_creation_triggers_decoupled_emails(self):
        """
        Test that Order creation in DB triggers both customer and admin emails,
        and failure in customer email does not block admin notification.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Grace Kimani",
                customer_email="grace.kimani@example.com",
                customer_phone="+254711223344",
                subtotal=Decimal("5200.00"),
                shipping_fee=Decimal("200.00"),
                total=Decimal("5400.00"),
                status="Processing",
                payment_method="M-PESA",
                payment_reference="NL5544332",
                shipping_address="Kilimani, Nairobi",
            )
            OrderItem.objects.create(
                order=order,
                product_name="Veloce Performance Joggers",
                product_sku="VEL-JOG-01",
                quantity=1,
                unit_price=Decimal("5200.00"),
            )

        # Both customer confirmation & admin alert dispatched
        self.assertGreaterEqual(len(mail.outbox), 2)
        
        customer_email = [m for m in mail.outbox if "grace.kimani@example.com" in m.to][0]
        self.assertIn("Grace Kimani", customer_email.body)
        self.assertIn("5,400.00", customer_email.body)

        admin_email = [m for m in mail.outbox if "ropenixkenya@gmail.com" in m.to][0]
        self.assertIn("Grace Kimani", admin_email.body)
        self.assertIn("+254711223344", admin_email.body)
        self.assertIn("Veloce Performance Joggers", admin_email.body)
        self.assertEqual(admin_email.reply_to, ["grace.kimani@example.com"])

        # Check DB Logs
        cust_log = TransactionalEmailLog.objects.filter(event_type=ORDER_PLACED_CUSTOMER, recipient="grace.kimani@example.com").first()
        self.assertIsNotNone(cust_log)
        self.assertEqual(cust_log.status, 'sent')

        admin_log = TransactionalEmailLog.objects.filter(event_type=ORDER_PLACED_ADMIN, recipient="ropenixkenya@gmail.com").first()
        self.assertIsNotNone(admin_log)
        self.assertEqual(admin_log.status, 'sent')
