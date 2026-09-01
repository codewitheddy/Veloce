from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from apps.customers.models import Customer, Deal, Invoice
from apps.orders.models import Order


class CustomerRegistrationDedupeTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_guest_checkout_then_registration_dedupe_and_link(self):
        guest_email = "guest.buyer@testmail.ke"

        # (a) Guest checks out or creates Customer record with no user (is_registered = False)
        guest_customer = Customer.objects.create(
            first_name="Guest",
            last_name="Buyer",
            email=guest_email,
            phone="+254700112233",
            company="Guest Ventures",
            status="lead",
            notes="Placed guest order #ORD-GUEST-1"
        )
        self.assertIsNone(guest_customer.user)
        self.assertFalse(guest_customer.is_registered)

        # Create an order and deal for this guest customer
        order = Order.objects.create(
            customer=guest_customer,
            customer_name="Guest Buyer",
            customer_email=guest_email,
            total=Decimal("12500.00"),
            status="Processing"
        )
        deal = Deal.objects.create(
            customer=guest_customer,
            title="Guest Trial Software",
            value=Decimal("50000.00"),
            stage="prospecting"
        )
        self.assertEqual(guest_customer.orders.count(), 1)
        self.assertEqual(guest_customer.deals.count(), 1)
        self.assertEqual(guest_customer.open_deal_value, Decimal("50000.00"))

        # Verify Customer API endpoint returns is_registered=False
        list_res = self.client.get(f"/api/customers/{guest_customer.id}/")
        self.assertEqual(list_res.status_code, 200)
        self.assertFalse(list_res.data["is_registered"])
        self.assertIsNone(list_res.data["user"])

        # (b) That same email later registers via /api/auth/register/
        reg_payload = {
            "username": "guestbuyer254",
            "email": guest_email,
            "password": "SecurePassword254!",
            "first_name": "RegisteredGuest",
            "last_name": "Buyer"
        }
        reg_res = self.client.post("/api/auth/register/", reg_payload, format="json")
        self.assertEqual(reg_res.status_code, 201)

        # (c) Verify the Customer record is reused/linked rather than duplicated
        matching_customers = Customer.objects.filter(email__iexact=guest_email)
        self.assertEqual(matching_customers.count(), 1, "Customer record should not be duplicated")

        reused_customer = matching_customers.first()
        self.assertEqual(str(reused_customer.id), str(guest_customer.id), "Original Customer ID should be preserved")
        self.assertIsNotNone(reused_customer.user, "Customer should now be linked to the registered User")
        self.assertTrue(reused_customer.is_registered)
        self.assertEqual(reused_customer.user.username, "guestbuyer254")

        # Verify linked deals, orders, and invoices are still intact
        self.assertEqual(reused_customer.orders.count(), 1)
        self.assertEqual(reused_customer.deals.count(), 1)

        # (d) Test is_registered filter in CustomerViewSet
        # Filter for registered customers
        reg_filter_res = self.client.get("/api/customers/?is_registered=true")
        self.assertEqual(reg_filter_res.status_code, 200)
        results = reg_filter_res.data.get("results", reg_filter_res.data)
        self.assertTrue(any(str(c["id"]) == str(guest_customer.id) for c in results))

        # Filter for guest customers (should not include our newly registered customer)
        guest_filter_res = self.client.get("/api/customers/?is_registered=false")
        self.assertEqual(guest_filter_res.status_code, 200)
        guest_results = guest_filter_res.data.get("results", guest_filter_res.data)
        self.assertFalse(any(str(c["id"]) == str(guest_customer.id) for c in guest_results))

    def test_direct_user_registration_creates_registered_customer(self):
        new_email = "direct.user@testmail.ke"
        reg_payload = {
            "username": "directuser254",
            "email": new_email,
            "password": "SecurePassword254!",
            "first_name": "Direct",
            "last_name": "User"
        }
        reg_res = self.client.post("/api/auth/register/", reg_payload, format="json")
        self.assertEqual(reg_res.status_code, 201)

        created_customer = Customer.objects.filter(email__iexact=new_email).first()
        self.assertIsNotNone(created_customer)
        self.assertTrue(created_customer.is_registered)
        self.assertIsNotNone(created_customer.user)
        self.assertEqual(created_customer.user.username, "directuser254")
