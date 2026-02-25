import json
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import ProtectedError
from django.test import TestCase

from apps.pantry.models import PantryItem
from tests.conftest import make_auth_header
from tests.factories import (
    IngredientCategoryFactory,
    IngredientFactory,
    PantryItemFactory,
    ReceiptScanFactory,
    UserFactory,
)


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


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------

BASE_URL = "/api/v1/pantry/"


class ListPantryItemsAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_list_own_items_only(self):
        PantryItemFactory(user=self.user)
        PantryItemFactory(user=self.user)
        PantryItemFactory()  # another user
        response = self.client.get(BASE_URL, **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["items"]), 2)

    def test_filter_by_status(self):
        PantryItemFactory(user=self.user, status=PantryItem.Status.AVAILABLE)
        PantryItemFactory(user=self.user, status=PantryItem.Status.USED_UP)
        response = self.client.get(f"{BASE_URL}?status=available", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["status"], "available")

    def test_filter_by_expiring_within(self):
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=2))
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=10))
        PantryItemFactory(user=self.user, expiry_date=None)
        response = self.client.get(f"{BASE_URL}?expiring_within=3", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)

    def test_filter_by_category(self):
        cat = IngredientCategoryFactory(name="Dairy")
        ing = IngredientFactory(category=cat)
        PantryItemFactory(user=self.user, ingredient=ing)
        PantryItemFactory(user=self.user)  # different category
        response = self.client.get(f"{BASE_URL}?category={cat.id}", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)

    def test_search_by_ingredient_name(self):
        ing1 = IngredientFactory(name="chicken breast")
        ing2 = IngredientFactory(name="cheddar cheese")
        ing3 = IngredientFactory(name="brown rice")
        PantryItemFactory(user=self.user, ingredient=ing1)
        PantryItemFactory(user=self.user, ingredient=ing2)
        PantryItemFactory(user=self.user, ingredient=ing3)

        response = self.client.get(f"{BASE_URL}?search=chicken", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["ingredient"]["name"], "chicken breast")

    def test_search_case_insensitive(self):
        ing = IngredientFactory(name="greek yogurt")
        PantryItemFactory(user=self.user, ingredient=ing)

        response = self.client.get(f"{BASE_URL}?search=GREEK", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)

    def test_search_partial_match(self):
        ing1 = IngredientFactory(name="bell peppers")
        ing2 = IngredientFactory(name="black pepper")
        PantryItemFactory(user=self.user, ingredient=ing1)
        PantryItemFactory(user=self.user, ingredient=ing2)

        response = self.client.get(f"{BASE_URL}?search=pepper", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 2)

    def test_search_no_results(self):
        PantryItemFactory(user=self.user)
        response = self.client.get(f"{BASE_URL}?search=nonexistent", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 0)

    def test_search_combined_with_status_filter(self):
        ing = IngredientFactory(name="whole milk")
        PantryItemFactory(user=self.user, ingredient=ing, status=PantryItem.Status.AVAILABLE)
        ing2 = IngredientFactory(name="almond milk")
        PantryItemFactory(user=self.user, ingredient=ing2, status=PantryItem.Status.EXPIRED)

        response = self.client.get(f"{BASE_URL}?search=milk&status=available", **self.auth)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["ingredient"]["name"], "whole milk")

    def test_includes_ingredient_detail(self):
        cat = IngredientCategoryFactory(name="Produce", icon="🥬")
        ing = IngredientFactory(name="spinach", category=cat)
        PantryItemFactory(user=self.user, ingredient=ing)
        response = self.client.get(BASE_URL, **self.auth)
        data = response.json()
        item = data["items"][0]
        self.assertEqual(item["ingredient"]["name"], "spinach")
        self.assertEqual(item["ingredient"]["category_name"], "Produce")
        self.assertEqual(item["ingredient"]["category_icon"], "🥬")

    def test_unauthenticated(self):
        response = self.client.get(BASE_URL)
        self.assertEqual(response.status_code, 401)


class AddPantryItemAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_new_item_201(self):
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Tomato", "quantity": "3", "unit": "piece"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertTrue(data["created"])
        self.assertEqual(data["item"]["ingredient"]["name"], "tomato")
        self.assertEqual(data["item"]["quantity"], "3.00")
        self.assertEqual(data["item"]["source"], "manual")

    def test_auto_expiry_calc(self):
        cat = IngredientCategoryFactory(name="Dairy", default_shelf_life=7)
        IngredientFactory(name="milk", category=cat)
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Milk"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        expected_expiry = str(date.today() + timedelta(days=7))
        self.assertEqual(data["item"]["expiry_date"], expected_expiry)

    def test_explicit_expiry_override(self):
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Cheese", "expiry_date": "2026-04-01"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["item"]["expiry_date"], "2026-04-01")

    def test_upsert_existing_200(self):
        ing = IngredientFactory(name="rice")
        PantryItemFactory(user=self.user, ingredient=ing, quantity=Decimal("2.00"), status=PantryItem.Status.AVAILABLE)
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Rice", "quantity": "3"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["created"])
        self.assertEqual(data["item"]["quantity"], "5.00")

    def test_creates_new_ingredient(self):
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Dragon Fruit", "category_hint": "Fresh Fruits"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["item"]["ingredient"]["name"], "dragon fruit")

    def test_unit_defaults_to_common_unit(self):
        IngredientFactory(name="eggs", common_unit="dozen")
        response = self.client.post(
            BASE_URL,
            data=json.dumps({"ingredient_name": "Eggs"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["item"]["unit"], "dozen")


class UpdatePantryItemAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_update_quantity(self):
        item = PantryItemFactory(user=self.user, quantity=Decimal("5.00"))
        response = self.client.patch(
            f"{BASE_URL}{item.id}",
            data=json.dumps({"quantity": "10"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.json()["quantity"]), Decimal("10"))

    def test_update_expiry(self):
        item = PantryItemFactory(user=self.user)
        response = self.client.patch(
            f"{BASE_URL}{item.id}",
            data=json.dumps({"expiry_date": "2026-05-01"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["expiry_date"], "2026-05-01")

    def test_partial_update(self):
        item = PantryItemFactory(user=self.user, quantity=Decimal("5.00"), unit="kg")
        response = self.client.patch(
            f"{BASE_URL}{item.id}",
            data=json.dumps({"unit": "lb"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["unit"], "lb")
        self.assertEqual(data["quantity"], "5.00")  # unchanged

    def test_invalid_status_400(self):
        item = PantryItemFactory(user=self.user)
        response = self.client.patch(
            f"{BASE_URL}{item.id}",
            data=json.dumps({"status": "invalid_status"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_other_users_item_404(self):
        item = PantryItemFactory()  # different user
        response = self.client.patch(
            f"{BASE_URL}{item.id}",
            data=json.dumps({"quantity": "1"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 404)


class DeletePantryItemAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_delete_own_item(self):
        item = PantryItemFactory(user=self.user)
        response = self.client.delete(f"{BASE_URL}{item.id}", **self.auth)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(PantryItem.objects.filter(user=self.user).count(), 0)

    def test_other_users_item_404(self):
        item = PantryItemFactory()  # different user
        response = self.client.delete(f"{BASE_URL}{item.id}", **self.auth)
        self.assertEqual(response.status_code, 404)
        self.assertTrue(PantryItem.objects.filter(id=item.id).exists())


class UsePantryItemAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_use_all_no_quantity(self):
        item = PantryItemFactory(user=self.user, quantity=Decimal("5.00"))
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "used_up")
        self.assertEqual(Decimal(response.json()["quantity"]), Decimal("0"))

    def test_partial_use(self):
        item = PantryItemFactory(user=self.user, quantity=Decimal("5.00"))
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({"quantity": "2"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "available")
        self.assertEqual(response.json()["quantity"], "3.00")

    def test_exact_quantity_marks_used_up(self):
        item = PantryItemFactory(user=self.user, quantity=Decimal("3.00"))
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({"quantity": "3"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "used_up")

    def test_already_used_up_400(self):
        item = PantryItemFactory(user=self.user, status=PantryItem.Status.USED_UP)
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_expired_item_400(self):
        item = PantryItemFactory(user=self.user, status=PantryItem.Status.EXPIRED)
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_other_users_item_404(self):
        item = PantryItemFactory()  # different user
        response = self.client.post(
            f"{BASE_URL}{item.id}/use",
            data=json.dumps({}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 404)


class ExpiringItemsAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_default_3_days(self):
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=2))
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=10))
        response = self.client.get(f"{BASE_URL}expiring", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_custom_days_param(self):
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=5))
        PantryItemFactory(user=self.user, expiry_date=date.today() + timedelta(days=10))
        response = self.client.get(f"{BASE_URL}expiring?days=7", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_excludes_used_up(self):
        PantryItemFactory(
            user=self.user,
            expiry_date=date.today() + timedelta(days=1),
            status=PantryItem.Status.USED_UP,
        )
        response = self.client.get(f"{BASE_URL}expiring", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 0)

    def test_excludes_null_expiry(self):
        PantryItemFactory(user=self.user, expiry_date=None)
        response = self.client.get(f"{BASE_URL}expiring", **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 0)


class PantrySummaryAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_groups_by_category(self):
        cat1 = IngredientCategoryFactory(name="Dairy", icon="🥛")
        cat2 = IngredientCategoryFactory(name="Produce", icon="🥬")
        ing1 = IngredientFactory(category=cat1)
        ing2 = IngredientFactory(category=cat2)
        PantryItemFactory(user=self.user, ingredient=ing1)
        PantryItemFactory(user=self.user, ingredient=ing2)

        response = self.client.get(f"{BASE_URL}summary", **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_items"], 2)
        self.assertEqual(len(data["categories"]), 2)
        names = {c["category_name"] for c in data["categories"]}
        self.assertEqual(names, {"Dairy", "Produce"})

    def test_counts_statuses(self):
        cat = IngredientCategoryFactory(name="Produce")
        ing1 = IngredientFactory(category=cat)
        ing2 = IngredientFactory(category=cat)
        ing3 = IngredientFactory(category=cat)
        PantryItemFactory(user=self.user, ingredient=ing1, status=PantryItem.Status.AVAILABLE)
        PantryItemFactory(user=self.user, ingredient=ing2, status=PantryItem.Status.EXPIRED)
        PantryItemFactory(user=self.user, ingredient=ing3, status=PantryItem.Status.USED_UP)

        response = self.client.get(f"{BASE_URL}summary", **self.auth)
        data = response.json()
        cat_data = data["categories"][0]
        self.assertEqual(cat_data["available_count"], 1)
        self.assertEqual(cat_data["expired_count"], 1)
        self.assertEqual(cat_data["used_up_count"], 1)
        self.assertEqual(cat_data["total_count"], 3)

    def test_uncategorized_group(self):
        ing = IngredientFactory(category=None)
        PantryItemFactory(user=self.user, ingredient=ing)

        response = self.client.get(f"{BASE_URL}summary", **self.auth)
        data = response.json()
        self.assertEqual(len(data["categories"]), 1)
        self.assertEqual(data["categories"][0]["category_name"], "Uncategorized")
        self.assertIsNone(data["categories"][0]["category_id"])

    def test_empty_pantry(self):
        response = self.client.get(f"{BASE_URL}summary", **self.auth)
        data = response.json()
        self.assertEqual(data["total_items"], 0)
        self.assertEqual(data["total_available"], 0)
        self.assertEqual(data["categories"], [])


class BulkDeletePantryAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_bulk_delete_own_items(self):
        items = [PantryItemFactory(user=self.user) for _ in range(3)]
        ids = [str(item.id) for item in items]
        response = self.client.post(
            f"{BASE_URL}bulk-delete",
            data=json.dumps({"ids": ids}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted_count"], 3)
        self.assertEqual(PantryItem.objects.filter(user=self.user).count(), 0)

    def test_skips_other_users_items(self):
        own_item = PantryItemFactory(user=self.user)
        other_item = PantryItemFactory()  # different user
        response = self.client.post(
            f"{BASE_URL}bulk-delete",
            data=json.dumps({"ids": [str(own_item.id), str(other_item.id)]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted_count"], 1)
        # Other user's item still exists
        self.assertTrue(PantryItem.objects.filter(id=other_item.id).exists())

    def test_empty_ids_400(self):
        response = self.client.post(
            f"{BASE_URL}bulk-delete",
            data=json.dumps({"ids": []}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_nonexistent_ids_return_zero(self):
        import uuid

        fake_ids = [str(uuid.uuid4()) for _ in range(2)]
        response = self.client.post(
            f"{BASE_URL}bulk-delete",
            data=json.dumps({"ids": fake_ids}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted_count"], 0)

    def test_partial_match(self):
        """Some IDs exist (owned by user), some don't — only existing ones are deleted."""
        import uuid

        item = PantryItemFactory(user=self.user)
        response = self.client.post(
            f"{BASE_URL}bulk-delete",
            data=json.dumps({"ids": [str(item.id), str(uuid.uuid4())]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["deleted_count"], 1)
        self.assertFalse(PantryItem.objects.filter(id=item.id).exists())
