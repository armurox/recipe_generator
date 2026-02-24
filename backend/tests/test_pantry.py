from datetime import date

from django.db.models import ProtectedError
from django.test import TestCase

from apps.pantry.models import PantryItem
from tests.factories import IngredientFactory, PantryItemFactory, ReceiptScanFactory, UserFactory


class PantryItemTest(TestCase):
    def test_create(self):
        item = PantryItemFactory(expiry_date=date(2026, 3, 3))
        self.assertIsNotNone(item.pk)
        self.assertEqual(item.expiry_date, date(2026, 3, 3))

    def test_defaults(self):
        item = PantryItemFactory()
        self.assertEqual(item.status, "available")
        self.assertEqual(item.source, "manual")
        self.assertEqual(item.added_date, date.today())

    def test_user_cascade(self):
        item = PantryItemFactory()
        item.user.delete()
        self.assertEqual(PantryItem.objects.count(), 0)

    def test_ingredient_protect(self):
        item = PantryItemFactory()
        with self.assertRaises(ProtectedError):
            item.ingredient.delete()

    def test_receipt_scan_set_null(self):
        scan = ReceiptScanFactory()
        item = PantryItemFactory(
            user=scan.user,
            receipt_scan=scan,
            source=PantryItem.Source.RECEIPT_SCAN,
        )
        scan.delete()
        item.refresh_from_db()
        self.assertIsNone(item.receipt_scan)

    def test_str(self):
        item = PantryItemFactory()
        self.assertIn("available", str(item))

    def test_ordering(self):
        user = UserFactory()
        ing1 = IngredientFactory()
        ing2 = IngredientFactory()
        item1 = PantryItemFactory(user=user, ingredient=ing1, expiry_date=date(2026, 3, 10))
        item2 = PantryItemFactory(user=user, ingredient=ing2, expiry_date=date(2026, 3, 5))
        items = list(PantryItem.objects.all())
        self.assertEqual(items[0], item2)  # earlier expiry first
        self.assertEqual(items[1], item1)
