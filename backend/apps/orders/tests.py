import uuid
from decimal import Decimal
from django.test import TestCase, override_settings
from django.core import mail
from apps.orders.models import Order, OrderItem
from apps.orders.tasks import send_order_transition_email_task


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class OrderStatusSignalsTest(TestCase):
    def setUp(self):
        mail.outbox = []

    def test_new_order_creation_triggers_order_received_email(self):
        """
        Test that creating a new order in 'Pending' status fires the Order Received email.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Alice Smith",
                customer_email="alice@example.com",
                customer_phone="+254712345678",
                subtotal=Decimal("3500.00"),
                shipping_fee=Decimal("250.00"),
                total=Decimal("3750.00"),
                status="Pending",
                payment_method="M-PESA",
                payment_reference="NL8472910"
            )
            OrderItem.objects.create(
                order=order,
                product_name="Veloce Wireless Headphones",
                quantity=1,
                unit_price=Decimal("3500.00")
            )

        # Check outbox: Customer Order Received email + Admin alert
        self.assertGreaterEqual(len(mail.outbox), 2)
        customer_email = [m for m in mail.outbox if "alice@example.com" in m.to][0]
        self.assertIn("Confirmed", customer_email.subject)
        self.assertIn("Alice Smith", customer_email.body)

        # Check Admin Alert dispatched to ropenixkenya@gmail.com
        admin_emails = [m for m in mail.outbox if "ropenixkenya@gmail.com" in m.to]
        self.assertTrue(len(admin_emails) >= 1)
        admin_email = admin_emails[0]
        self.assertIn("[NEW ORDER]", admin_email.subject)
        self.assertIn("Alice Smith", admin_email.body)
        self.assertIn("3,750.00", admin_email.body)
        self.assertIn("Veloce Wireless Headphones", admin_email.body)

    def test_unrelated_order_edits_do_not_retrigger_status_emails(self):
        """
        Test that editing notes or shipping address without changing status does NOT send emails.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Bob Jones",
                customer_email="bob@example.com",
                total=Decimal("1200.00"),
                status="Pending",
            )

        mail.outbox = []  # Clear outbox after creation

        # Perform unrelated edit
        with self.captureOnCommitCallbacks(execute=True):
            order.shipping_address = "Apartment 4B, Kilimani, Nairobi"
            order.notes = "Please call upon arrival at the gate"
            order.save()

        # Outbox must remain empty because status did not change
        self.assertEqual(len(mail.outbox), 0)

    def test_pending_to_processing_triggers_payment_confirmed_email(self):
        """
        Test that admin marking order as 'Processing' (payment verified) triggers Payment Received email.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Charlie Brown",
                customer_email="charlie@example.com",
                total=Decimal("5400.00"),
                status="Pending",
                payment_method="M-PESA",
                payment_reference="QWE987654"
            )

        mail.outbox = []

        # Admin marks as Processing / Verified
        with self.captureOnCommitCallbacks(execute=True):
            order.status = "Processing"
            order.save()

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Confirmed", email.subject)
        self.assertIn("charlie@example.com", email.to)
        self.assertIn("5,400.00", email.body)

    def test_processing_to_shipped_triggers_shipped_email_with_tracking(self):
        """
        Test that admin marking order as 'Shipped' with tracking triggers Order Shipped email.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="David Miller",
                customer_email="david@example.com",
                total=Decimal("8900.00"),
                status="Processing",
            )

        mail.outbox = []

        # Admin marks as Shipped with Courier tracking
        with self.captureOnCommitCallbacks(execute=True):
            order.status = "Shipped"
            order.tracking_number = "G4S-NBO-88219"
            order.save()

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Package Is On Its Way", email.subject)
        self.assertIn("G4S-NBO-88219", email.body)
        self.assertIn("david@example.com", email.to)

    def test_shipped_to_completed_triggers_completed_email(self):
        """
        Test that admin marking order as 'Completed' or 'Delivered' triggers Order Completed email.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Eve Adams",
                customer_email="eve@example.com",
                total=Decimal("2100.00"),
                status="Shipped",
            )

        mail.outbox = []

        with self.captureOnCommitCallbacks(execute=True):
            order.status = "Completed"
            order.save()

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Delivered", email.subject)
        self.assertIn("eve@example.com", email.to)

    def test_order_cancellation_triggers_cancelled_email(self):
        """
        Test that admin cancelling an order triggers Order Cancelled email.
        """
        with self.captureOnCommitCallbacks(execute=True):
            order = Order.objects.create(
                id=str(uuid.uuid4()),
                customer_name="Frank White",
                customer_email="frank@example.com",
                total=Decimal("4300.00"),
                status="Pending",
            )

        mail.outbox = []

        with self.captureOnCommitCallbacks(execute=True):
            order.status = "Cancelled"
            order.save()

        self.assertEqual(len(mail.outbox), 1)
        email = mail.outbox[0]
        self.assertIn("Cancelled", email.subject)
        self.assertIn("frank@example.com", email.to)

    def test_direct_synchronous_dispatch_sends_to_customer_and_admin(self):
        """
        Test that dispatch_order_status_email and dispatch_admin_order_notification
        work synchronously without Celery binding misalignment.
        """
        from apps.orders.tasks import dispatch_order_status_email, dispatch_admin_order_notification

        order = Order.objects.create(
            id=str(uuid.uuid4()),
            customer_name="Grace Hopper",
            customer_email="grace@customer.com",
            customer_phone="+254799887766",
            total=Decimal("6500.00"),
            status="Processing",
        )
        mail.outbox = []

        # Directly invoke customer dispatch
        dispatch_order_status_email(str(order.id), None, "Processing", None)
        self.assertEqual(len(mail.outbox), 1)
        customer_msg = mail.outbox[0]
        self.assertIn("grace@customer.com", customer_msg.to)
        self.assertIn("Confirmed", customer_msg.subject)

        # Directly invoke admin dispatch
        dispatch_admin_order_notification(str(order.id))
        self.assertEqual(len(mail.outbox), 2)
        admin_msg = mail.outbox[1]
        self.assertIn("ropenixkenya@gmail.com", admin_msg.to)
        self.assertIn("Grace Hopper", admin_msg.body)
        self.assertIn("grace@customer.com", admin_msg.body)
        self.assertIn("+254799887766", admin_msg.body)

