import json
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.ingredients.models import Ingredient
from apps.pantry.models import PantryItem
from apps.receipts.models import ReceiptItem, ReceiptScan
from apps.receipts.services.base import ExtractedItem, OCRExtractionError, ReceiptExtractionResult
from tests.conftest import make_auth_header
from tests.factories import (
    IngredientCategoryFactory,
    IngredientFactory,
    PantryItemFactory,
    ReceiptItemFactory,
    ReceiptScanFactory,
    UserFactory,
)

# Valid Supabase Storage URL for tests (matches SUPABASE_URL in test settings)
VALID_IMAGE_URL = "https://test-project.supabase.co/storage/v1/object/public/receipts/test.jpg"


# ---------------------------------------------------------------------------
# Model tests (existing)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# API tests
# ---------------------------------------------------------------------------

MOCK_OCR_RESULT = ReceiptExtractionResult(
    store_name="Test Grocery",
    items=[
        ExtractedItem(
            raw_text="ORGANIC BANANAS",
            name="banana",
            quantity=1.0,
            unit="bunch",
            price=2.49,
            is_food=True,
            category_hint="Fresh Fruits",
        ),
        ExtractedItem(
            raw_text="CHICKEN BREAST 1.5LB",
            name="chicken breast",
            quantity=1.5,
            unit="lb",
            price=8.99,
            is_food=True,
            category_hint="Poultry",
        ),
        ExtractedItem(
            raw_text="TAX",
            name="tax",
            quantity=None,
            unit=None,
            price=0.87,
            is_food=False,
            category_hint=None,
        ),
    ],
    raw_response={"mock": True},
)


class ScanReceiptAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)
        self.url = "/api/v1/receipts/scan"
        # Pre-create categories so category_hint matching works
        IngredientCategoryFactory(name="Fresh Fruits", default_shelf_life=5)
        IngredientCategoryFactory(name="Poultry", default_shelf_life=3)
        # Clear rate limit cache between tests
        cache.clear()

    @patch("apps.receipts.api.ocr_provider")
    def test_scan_success(self, mock_provider):
        mock_provider.extract_receipt = AsyncMock(return_value=MOCK_OCR_RESULT)
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["store_name"], "Test Grocery")
        self.assertEqual(data["status"], "completed")
        self.assertEqual(len(data["items"]), 3)

        # Food items should have ingredients linked
        banana_item = next(i for i in data["items"] if i["ingredient_name"] == "banana")
        self.assertTrue(banana_item["is_food"])
        self.assertIsNotNone(banana_item["ingredient_id"])

        # Non-food items should have null ingredient
        tax_item = next(i for i in data["items"] if i["raw_text"] == "TAX")
        self.assertFalse(tax_item["is_food"])
        self.assertIsNone(tax_item["ingredient_id"])

        # Verify DB state
        self.assertEqual(ReceiptScan.objects.count(), 1)
        self.assertEqual(ReceiptItem.objects.count(), 3)
        self.assertTrue(Ingredient.objects.filter(name="banana").exists())
        self.assertTrue(Ingredient.objects.filter(name="chicken breast").exists())

    @patch("apps.receipts.api.ocr_provider")
    def test_scan_ocr_failure(self, mock_provider):
        mock_provider.extract_receipt = AsyncMock(side_effect=OCRExtractionError("API timeout"))
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 502)
        # Scan should be marked as failed
        scan = ReceiptScan.objects.first()
        self.assertEqual(scan.status, ReceiptScan.Status.FAILED)

    def test_scan_unauthenticated(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    # --- SSRF protection tests ---

    def test_scan_rejects_non_supabase_host(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": "https://evil.com/storage/v1/object/public/test.jpg"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Supabase Storage", response.json()["detail"])

    def test_scan_rejects_http_scheme(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": "http://test-project.supabase.co/storage/v1/object/public/test.jpg"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("HTTPS", response.json()["detail"])

    def test_scan_rejects_non_storage_path(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": "https://test-project.supabase.co/auth/v1/admin"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Supabase Storage", response.json()["detail"])

    def test_scan_rejects_path_traversal(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": "https://test-project.supabase.co/storage/../../internal/secrets"}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    # --- Rate limiting tests ---

    @override_settings(SCAN_RATE_LIMIT_MAX=2, SCAN_RATE_LIMIT_PERIOD=3600)
    @patch("apps.receipts.api.ocr_provider")
    def test_scan_rate_limit(self, mock_provider):
        mock_provider.extract_receipt = AsyncMock(return_value=MOCK_OCR_RESULT)

        # First 2 requests should succeed
        for _ in range(2):
            response = self.client.post(
                self.url,
                data=json.dumps({"image_url": VALID_IMAGE_URL}),
                content_type="application/json",
                **self.auth,
            )
            self.assertEqual(response.status_code, 200)

        # Third request should be rate limited
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 429)
        self.assertIn("Rate limit", response.json()["detail"])

    @override_settings(SCAN_RATE_LIMIT_MAX=1, SCAN_RATE_LIMIT_PERIOD=3600)
    @patch("apps.receipts.api.ocr_provider")
    def test_scan_rate_limit_per_user(self, mock_provider):
        """Rate limit is per-user — different users have independent limits."""
        mock_provider.extract_receipt = AsyncMock(return_value=MOCK_OCR_RESULT)

        # First user hits the limit
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)

        # Second user should still be able to scan
        other_user = UserFactory()
        other_auth = make_auth_header(other_user)
        response = self.client.post(
            self.url,
            data=json.dumps({"image_url": VALID_IMAGE_URL}),
            content_type="application/json",
            **other_auth,
        )
        self.assertEqual(response.status_code, 200)


class ListScansAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)
        self.url = "/api/v1/receipts/"

    def test_list_own_scans(self):
        ReceiptScanFactory(user=self.user)
        ReceiptScanFactory(user=self.user)
        # Another user's scan — should not appear
        ReceiptScanFactory()

        response = self.client.get(self.url, **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(len(data["items"]), 2)

    def test_list_empty(self):
        response = self.client.get(self.url, **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["items"], [])

    def test_list_includes_item_count(self):
        scan = ReceiptScanFactory(user=self.user)
        ReceiptItemFactory(receipt=scan)
        ReceiptItemFactory(receipt=scan)

        response = self.client.get(self.url, **self.auth)
        data = response.json()
        self.assertEqual(data["items"][0]["item_count"], 2)


class GetScanAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_get_own_scan(self):
        scan = ReceiptScanFactory(user=self.user)
        ingredient = IngredientFactory(name="tomato")
        ReceiptItemFactory(receipt=scan, ingredient=ingredient, raw_text="TOMATOES")

        response = self.client.get(f"/api/v1/receipts/{scan.id}", **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["ingredient_name"], "tomato")

    def test_get_other_users_scan(self):
        scan = ReceiptScanFactory()  # Different user
        response = self.client.get(f"/api/v1/receipts/{scan.id}", **self.auth)
        self.assertEqual(response.status_code, 404)

    def test_get_nonexistent_scan(self):
        response = self.client.get("/api/v1/receipts/00000000-0000-0000-0000-000000000000", **self.auth)
        self.assertEqual(response.status_code, 404)


class ConfirmReceiptAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)
        self.category = IngredientCategoryFactory(name="Fresh Fruits", default_shelf_life=5)
        self.ingredient = IngredientFactory(name="banana", category=self.category)
        self.scan = ReceiptScanFactory(user=self.user, status=ReceiptScan.Status.COMPLETED)
        self.item = ReceiptItemFactory(
            receipt=self.scan,
            ingredient=self.ingredient,
            raw_text="BANANAS",
            quantity=Decimal("3.00"),
            unit="piece",
        )
        self.url = f"/api/v1/receipts/{self.scan.id}/confirm"

    def test_confirm_creates_pantry_item(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["pantry_items_created"], 1)
        self.assertEqual(data["pantry_items_updated"], 0)
        self.assertEqual(len(data["items"]), 1)

        # Verify response includes full pantry item detail with nested category
        item_data = data["items"][0]
        self.assertEqual(item_data["ingredient"]["name"], "banana")
        self.assertEqual(item_data["ingredient"]["category_name"], "Fresh Fruits")
        self.assertEqual(item_data["source"], "receipt_scan")
        self.assertIsNotNone(item_data["expiry_date"])

        pantry = PantryItem.objects.first()
        self.assertEqual(pantry.ingredient, self.ingredient)
        self.assertEqual(pantry.quantity, Decimal("3.00"))
        self.assertEqual(pantry.source, PantryItem.Source.RECEIPT_SCAN)
        self.assertIsNotNone(pantry.expiry_date)

    def test_confirm_with_name_override(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id, "ingredient_name": "plantain"}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        pantry = PantryItem.objects.first()
        self.assertEqual(pantry.ingredient.name, "plantain")

    def test_confirm_upserts_existing_pantry_item(self):
        # Pre-existing pantry item for same ingredient
        PantryItemFactory(
            user=self.user,
            ingredient=self.ingredient,
            quantity=Decimal("2.00"),
            status=PantryItem.Status.AVAILABLE,
        )

        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["pantry_items_created"], 0)
        self.assertEqual(data["pantry_items_updated"], 1)
        self.assertEqual(len(data["items"]), 1)
        self.assertEqual(data["items"][0]["quantity"], "5.00")

        pantry = PantryItem.objects.get(user=self.user, ingredient=self.ingredient)
        self.assertEqual(pantry.quantity, Decimal("5.00"))  # 2.00 + 3.00

    def test_confirm_with_expiry_override(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id, "expiry_date": "2026-06-15"}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # User-provided expiry_date should take precedence over auto-calculation
        self.assertEqual(data["items"][0]["expiry_date"], "2026-06-15")
        pantry = PantryItem.objects.first()
        self.assertEqual(str(pantry.expiry_date), "2026-06-15")

    def test_confirm_response_includes_pantry_items(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("items", data)
        self.assertEqual(len(data["items"]), 1)

        item_data = data["items"][0]
        # Full PantryItemOut shape
        self.assertIn("id", item_data)
        self.assertIn("ingredient", item_data)
        self.assertIn("quantity", item_data)
        self.assertIn("unit", item_data)
        self.assertIn("added_date", item_data)
        self.assertIn("expiry_date", item_data)
        self.assertIn("source", item_data)
        self.assertIn("status", item_data)
        # Nested ingredient detail
        self.assertIn("name", item_data["ingredient"])
        self.assertIn("category_name", item_data["ingredient"])
        self.assertIn("category_icon", item_data["ingredient"])

    def test_confirm_transitions_to_confirmed_status(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        self.scan.refresh_from_db()
        self.assertEqual(self.scan.status, ReceiptScan.Status.CONFIRMED)

    def test_confirm_already_confirmed_scan_409(self):
        self.scan.status = ReceiptScan.Status.CONFIRMED
        self.scan.save()
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 409)

    def test_confirm_rejects_non_completed_scan(self):
        self.scan.status = ReceiptScan.Status.PROCESSING
        self.scan.save()
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": self.item.id}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_confirm_invalid_item_id(self):
        response = self.client.post(
            self.url,
            data=json.dumps({"items": [{"receipt_item_id": 99999}]}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 400)

    def test_confirm_other_users_scan(self):
        other_scan = ReceiptScanFactory(status=ReceiptScan.Status.COMPLETED)
        response = self.client.post(
            f"/api/v1/receipts/{other_scan.id}/confirm",
            data=json.dumps({"items": []}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 404)


class DeleteScanAPITest(TestCase):
    def setUp(self):
        self.user = UserFactory()
        self.auth = make_auth_header(self.user)

    def test_delete_own_scan(self):
        scan = ReceiptScanFactory(user=self.user)
        ReceiptItemFactory(receipt=scan)

        response = self.client.delete(f"/api/v1/receipts/{scan.id}", **self.auth)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(ReceiptScan.objects.count(), 0)
        self.assertEqual(ReceiptItem.objects.count(), 0)

    def test_delete_confirmed_scan_409(self):
        scan = ReceiptScanFactory(user=self.user, status=ReceiptScan.Status.CONFIRMED)
        response = self.client.delete(f"/api/v1/receipts/{scan.id}", **self.auth)
        self.assertEqual(response.status_code, 409)
        # Scan should still exist
        self.assertTrue(ReceiptScan.objects.filter(id=scan.id).exists())

    def test_delete_other_users_scan(self):
        scan = ReceiptScanFactory()  # Different user
        response = self.client.delete(f"/api/v1/receipts/{scan.id}", **self.auth)
        self.assertEqual(response.status_code, 404)
        # Scan should still exist
        self.assertEqual(ReceiptScan.objects.count(), 1)
