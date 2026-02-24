from decimal import Decimal

from django.test import TestCase

from apps.receipts.models import ReceiptItem, ReceiptScan
from tests.factories import IngredientFactory, ReceiptItemFactory, ReceiptScanFactory, UserFactory


class ReceiptScanTest(TestCase):
    def test_create(self):
        scan = ReceiptScanFactory()
        self.assertIsNotNone(scan.pk)
        self.assertIsNotNone(scan.scanned_at)
        self.assertEqual(scan.status, ReceiptScan.Status.COMPLETED)

    def test_default_status(self):
        user = UserFactory()
        scan = ReceiptScan.objects.create(user=user, image_url="https://example.com/img.jpg")
        self.assertEqual(scan.status, "processing")

    def test_cascade_on_user_delete(self):
        scan = ReceiptScanFactory()
        scan.user.delete()
        self.assertEqual(ReceiptScan.objects.count(), 0)

    def test_str(self):
        scan = ReceiptScanFactory()
        self.assertIn("Scan", str(scan))
        self.assertIn("completed", str(scan))


class ReceiptItemTest(TestCase):
    def test_create(self):
        ingredient = IngredientFactory()
        scan = ReceiptScanFactory()
        item = ReceiptItemFactory(
            receipt=scan,
            ingredient=ingredient,
            raw_text="TOMATOES 1kg",
            quantity=Decimal("1.00"),
            unit="kg",
            price=Decimal("3.50"),
        )
        self.assertEqual(item.raw_text, "TOMATOES 1kg")
        self.assertEqual(item.quantity, Decimal("1.00"))
        self.assertEqual(item.price, Decimal("3.50"))

    def test_ingredient_nullable(self):
        item = ReceiptItemFactory(ingredient=None, raw_text="TAX")
        self.assertIsNone(item.ingredient)

    def test_cascade_on_scan_delete(self):
        scan = ReceiptScanFactory()
        ReceiptItemFactory(receipt=scan)
        scan.delete()
        self.assertEqual(ReceiptItem.objects.count(), 0)

    def test_ingredient_set_null(self):
        ingredient = IngredientFactory()
        item = ReceiptItemFactory(ingredient=ingredient)
        ingredient.delete()
        item.refresh_from_db()
        self.assertIsNone(item.ingredient)

    def test_str(self):
        item = ReceiptItemFactory(raw_text="ORGANIC BANANAS")
        self.assertEqual(str(item), "ORGANIC BANANAS")
