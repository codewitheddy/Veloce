import uuid
from django.test import TestCase
from products.models import Product, ProductCategory
from apps.inventory.models import Inventory, InventoryReservation
from apps.inventory.services import InventoryReservationService


class InventoryReservationTests(TestCase):
    def setUp(self):
        self.category = ProductCategory.objects.create(name="Apparel", slug="apparel")
        self.product = Product.objects.create(
            id=str(uuid.uuid4()),
            sku="TEST-SKU-HOODIE-1",
            name="Veloce Performance Hoodie",
            price=3500.0,
            stock=10,
            category=self.category,
            status="Active"
        )
        self.inventory = Inventory.objects.create(
            product=self.product,
            sku="TEST-SKU-HOODIE-1",
            stock_quantity=10,
            reserved_quantity=0,
            low_stock_threshold=2
        )

    def test_inventory_reservation_success(self):
        cart_id = f"cart_{uuid.uuid4().hex[:8]}"
        items = [{"sku": "TEST-SKU-HOODIE-1", "quantity": 3}]

        success, token, failed = InventoryReservationService.reserve_cart(cart_id, items)
        self.assertTrue(success)
        self.assertTrue(token.startswith("RES-"))
        self.assertEqual(len(failed), 0)

        # Check DB hold
        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.reserved_quantity, 3)
        self.assertEqual(self.inventory.available_quantity, 7)

    def test_inventory_reservation_insufficient_stock(self):
        cart_id = f"cart_{uuid.uuid4().hex[:8]}"
        items = [{"sku": "TEST-SKU-HOODIE-1", "quantity": 15}]  # Requests more than 10

        success, token, failed = InventoryReservationService.reserve_cart(cart_id, items)
        self.assertFalse(success)
        self.assertEqual(token, "")
        self.assertIn("TEST-SKU-HOODIE-1", failed)

    def test_commit_reservation(self):
        cart_id = f"cart_{uuid.uuid4().hex[:8]}"
        items = [{"sku": "TEST-SKU-HOODIE-1", "quantity": 4}]

        success, token, _ = InventoryReservationService.reserve_cart(cart_id, items)
        self.assertTrue(success)

        committed = InventoryReservationService.commit_reservation(token)
        self.assertTrue(committed)

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 6)
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertEqual(self.inventory.available_quantity, 6)

    def test_release_reservation(self):
        cart_id = f"cart_{uuid.uuid4().hex[:8]}"
        items = [{"sku": "TEST-SKU-HOODIE-1", "quantity": 2}]

        success, token, _ = InventoryReservationService.reserve_cart(cart_id, items)
        self.assertTrue(success)

        released = InventoryReservationService.release_reservation(token)
        self.assertTrue(released)

        self.inventory.refresh_from_db()
        self.assertEqual(self.inventory.stock_quantity, 10)
        self.assertEqual(self.inventory.reserved_quantity, 0)
        self.assertEqual(self.inventory.available_quantity, 10)
