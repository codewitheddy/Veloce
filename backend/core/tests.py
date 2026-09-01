from decimal import Decimal
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.core import mail
from core.celery import app as celery_app
from products.models import Product, ProductCategory
from apps.orders.models import Order, OrderItem
from apps.affiliates.models import AffiliateProfile, CommissionEntry
from apps.users.models import UserProfile, UserNotification

# Tasks to test
from apps.orders.tasks import send_order_confirmation_email_task, send_order_status_notification_task
from apps.users.tasks import send_welcome_email_task
from apps.products.tasks import check_low_stock_threshold_task, process_product_bulk_update_task
from apps.affiliates.tasks import process_affiliate_commission_task
from core.tasks import generate_sales_report_task, generate_inventory_health_report_task


@override_settings(
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    SECURE_SSL_REDIRECT=False,
)
class CeleryArchitectureTestSuite(TestCase):
    """
    Validates Celery integration, task auto-discovery, eager execution,
    email sending, transactional on_commit behavior, and data reconciliation.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='testcustomer',
            email='customer@example.com',
            first_name='John',
            last_name='Doe',
            password='Password123!'
        )
        self.profile = UserProfile.objects.create(
            user=self.user,
            referral_code='JOHNDOE10',
            loyalty_points=150
        )

        self.category = ProductCategory.objects.create(name='Apparel', slug='apparel')
        self.product = Product.objects.create(
            sku='TEST-HOODIE-01',
            name='Veloce Black Edition Hoodie',
            category_ref=self.category,
            price=Decimal('4500.00'),
            stock=12,
            low_stock_threshold=5,
            track_stock=True
        )

    def test_celery_app_initialized_and_configured(self):
        """Verify Celery app name and task autodiscovery."""
        self.assertEqual(celery_app.main, 'veloce_ecommerce')
        registered_tasks = celery_app.tasks.keys()
        
        # Verify all custom ecommerce tasks are registered
        self.assertIn('apps.orders.tasks.send_order_confirmation_email_task', registered_tasks)
        self.assertIn('apps.orders.tasks.send_order_status_notification_task', registered_tasks)
        self.assertIn('apps.users.tasks.send_welcome_email_task', registered_tasks)
        self.assertIn('apps.products.tasks.check_low_stock_threshold_task', registered_tasks)
        self.assertIn('apps.affiliates.tasks.process_affiliate_commission_task', registered_tasks)
        self.assertIn('core.tasks.generate_sales_report_task', registered_tasks)

    def test_send_order_confirmation_email_task(self):
        """Verify order confirmation email formatting, delivery and in-app notification creation."""
        order = Order.objects.create(
            user=self.user,
            customer_name='John Doe',
            customer_email='customer@example.com',
            subtotal=Decimal('4500.00'),
            discount=Decimal('0.00'),
            shipping_fee=Decimal('200.00'),
            tax_amount=Decimal('720.00'),
            total=Decimal('5420.00'),
            status='Pending',
            payment_method='M-PESA'
        )
        OrderItem.objects.create(
            order=order,
            product=self.product,
            product_name=self.product.name,
            product_sku=self.product.sku,
            quantity=1,
            unit_price=Decimal('4500.00')
        )

        result = send_order_confirmation_email_task.delay(str(order.id)).get()
        self.assertIn(result['status'], ('success', 'sent'))
        self.assertEqual(len(mail.outbox), 1)
        order_prefix = str(order.id)[:8].upper()
        self.assertIn(f"#{order_prefix}", mail.outbox[0].subject)
        self.assertEqual(mail.outbox[0].to, ['customer@example.com'])

        # Verify in-app notification
        notifications = UserNotification.objects.filter(user=self.user, type='order')
        self.assertTrue(notifications.exists())
        self.assertIn(order_prefix, notifications.first().title)

    def test_send_welcome_email_task(self):
        """Verify welcome email execution."""
        result = send_welcome_email_task.delay(self.user.id).get()
        self.assertIn(result['status'], ('success', 'sent'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Welcome to Veloce Kenya", mail.outbox[0].subject)

    def test_check_low_stock_threshold_task(self):
        """Verify inventory monitoring task flags low stock items."""
        # Lower stock to below threshold
        self.product.stock = 3
        self.product.save()

        result = check_low_stock_threshold_task.delay().get()
        self.assertEqual(result['status'], 'alerts_sent')
        self.assertEqual(result['low_stock_count'], 1)
        self.assertEqual(result['products'][0]['sku'], 'TEST-HOODIE-01')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("[INVENTORY ALERT]", mail.outbox[0].subject)

    def test_process_affiliate_commission_task(self):
        """Verify affiliate commission processing, tier rate calculation and notification."""
        affiliate = AffiliateProfile.objects.create(
            user=self.user,
            name='Edwin Partner',
            email='partner@example.com',
            affiliate_code='EDWIN254',
            partner_tier='Gold',  # 12%
            status='approved'
        )

        order_id = 'order-test-uuid-999'
        order_total = 10000.00
        result = process_affiliate_commission_task.delay(order_id, 'EDWIN254', order_total).get()

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['amount'], 1200.00)  # 12% of 10,000

        # Check DB records
        comm = CommissionEntry.objects.get(affiliate=affiliate, order_id=order_id)
        self.assertEqual(comm.commission_amount, Decimal('1200.00'))
        self.assertEqual(comm.status, 'pending')

        # Check affiliate balance update
        affiliate.refresh_from_db()
        self.assertEqual(affiliate.pending_balance, Decimal('1200.00'))
        self.assertEqual(affiliate.total_earned, Decimal('1200.00'))

    def test_generate_sales_report_task(self):
        """Verify aggregation of metrics for sales report."""
        Order.objects.create(
            customer_name='Alice',
            customer_email='alice@example.com',
            total=Decimal('3500.00'),
            subtotal=Decimal('3000.00'),
            shipping_fee=Decimal('500.00'),
            status='Delivered',
            payment_method='M-PESA'
        )
        Order.objects.create(
            customer_name='Bob',
            customer_email='bob@example.com',
            total=Decimal('6500.00'),
            subtotal=Decimal('6000.00'),
            shipping_fee=Decimal('500.00'),
            status='Delivered',
            payment_method='Card'
        )

        result = generate_sales_report_task.delay().get()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['metrics']['total_orders'], 2)
        self.assertEqual(result['metrics']['gross_revenue'], 10000.00)
        self.assertEqual(result['metrics']['avg_order_value'], 5000.00)

    def test_process_product_bulk_update_task(self):
        """Verify bulk update background task."""
        p2 = Product.objects.create(
            sku='TEST-SKU-02',
            name='Test Product 2',
            price=Decimal('1000.00'),
            stock=5,
            status='Active'
        )
        result = process_product_bulk_update_task.delay([self.product.id, p2.id], 'update_status', 'Inactive').get()
        self.assertEqual(result['status'], 'completed')
        self.assertEqual(result['affected_count'], 2)

        self.product.refresh_from_db()
        self.assertEqual(self.product.status, 'Inactive')


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
    SECURE_SSL_REDIRECT=False,
)
class ContactMessageAPITestCase(TestCase):
    """
    Validates public Contact Form endpoint, input validation, honeypot anti-spam,
    and administrative email delivery to ropenixkenya@gmail.com.
    """
    def setUp(self):
        mail.outbox = []

    def test_valid_contact_form_submission_sends_email_to_admin(self):
        payload = {
            'name': 'Sarah Jenkins',
            'email': 'sarah.jenkins@example.com',
            'phone': '+254711223344',
            'subject': 'Bulk Custom Apparel Inquiry',
            'message': 'We would like to order 100 customized hoodies for our startup team.',
        }
        response = self.client.post('/api/contact/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get('success'))

        # Verify admin email delivery
        admin_emails = [m for m in mail.outbox if 'ropenixkenya@gmail.com' in m.to]
        self.assertTrue(len(admin_emails) >= 1)
        admin_mail = admin_emails[0]
        self.assertIn('[Contact Inquiry]', admin_mail.subject)
        self.assertIn('Sarah Jenkins', admin_mail.body)
        self.assertIn('sarah.jenkins@example.com', admin_mail.body)
        self.assertIn('100 customized hoodies', admin_mail.body)
        self.assertEqual(admin_mail.reply_to, ['sarah.jenkins@example.com'])

        # Verify customer acknowledgement email delivery
        customer_emails = [m for m in mail.outbox if 'sarah.jenkins@example.com' in m.to]
        self.assertTrue(len(customer_emails) >= 1)
        self.assertIn('We received your message', customer_emails[0].subject)

    def test_invalid_email_format_returns_bad_request(self):
        payload = {
            'name': 'Bob Tester',
            'email': 'not-a-valid-email',
            'message': 'This is a test message.',
        }
        response = self.client.post('/api/contact/', payload, content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json().get('errors', {}))
        self.assertEqual(len(mail.outbox), 0)

    def test_honeypot_drops_spam_silently(self):
        payload = {
            'name': 'Spam Bot',
            'email': 'bot@spamnetwork.com',
            'message': 'Buy cheap backlinks today!',
            'hp_field': 'http://spam-link.example.com',  # Honeypot filled by bot
        }
        response = self.client.post('/api/contact/', payload, content_type='application/json')
        # Returns 200 to confuse bots
        self.assertEqual(response.status_code, 200)
        # But drops email transmission
        self.assertEqual(len(mail.outbox), 0)

