from django.core.management.base import BaseCommand

from apps.ingredients.models import IngredientCategory

CATEGORIES = [
    {"name": "Fresh Vegetables", "default_shelf_life": 7, "icon": "🥬"},
    {"name": "Fresh Fruits", "default_shelf_life": 5, "icon": "🍎"},
    {"name": "Leafy Greens", "default_shelf_life": 4, "icon": "🥗"},
    {"name": "Root Vegetables", "default_shelf_life": 14, "icon": "🥕"},
    {"name": "Herbs", "default_shelf_life": 7, "icon": "🌿"},
    {"name": "Dairy", "default_shelf_life": 10, "icon": "🥛"},
    {"name": "Cheese", "default_shelf_life": 21, "icon": "🧀"},
    {"name": "Eggs", "default_shelf_life": 21, "icon": "🥚"},
    {"name": "Meat", "default_shelf_life": 4, "icon": "🥩"},
    {"name": "Poultry", "default_shelf_life": 3, "icon": "🍗"},
    {"name": "Seafood", "default_shelf_life": 2, "icon": "🐟"},
    {"name": "Deli Meats", "default_shelf_life": 5, "icon": "🥓"},
    {"name": "Bread & Bakery", "default_shelf_life": 5, "icon": "🍞"},
    {"name": "Canned Goods", "default_shelf_life": 365, "icon": "🥫"},
    {"name": "Frozen Foods", "default_shelf_life": 180, "icon": "🧊"},
    {"name": "Dry Goods & Pasta", "default_shelf_life": 365, "icon": "🍝"},
    {"name": "Rice & Grains", "default_shelf_life": 365, "icon": "🍚"},
    {"name": "Snacks", "default_shelf_life": 90, "icon": "🍿"},
    {"name": "Condiments & Sauces", "default_shelf_life": 180, "icon": "🫙"},
    {"name": "Oils & Vinegars", "default_shelf_life": 365, "icon": "🫒"},
    {"name": "Spices & Seasonings", "default_shelf_life": 365, "icon": "🧂"},
    {"name": "Beverages", "default_shelf_life": 180, "icon": "🥤"},
    {"name": "Baking Supplies", "default_shelf_life": 180, "icon": "🧁"},
    {"name": "Nuts & Seeds", "default_shelf_life": 90, "icon": "🥜"},
    {"name": "Tofu & Plant Protein", "default_shelf_life": 7, "icon": "🌱"},
]


class Command(BaseCommand):
    help = "Seed ingredient categories with default shelf life data"

    def handle(self, *args, **options):
        created_count = 0
        for cat_data in CATEGORIES:
            _, created = IngredientCategory.objects.get_or_create(
                name=cat_data["name"],
                defaults={
                    "default_shelf_life": cat_data["default_shelf_life"],
                    "icon": cat_data["icon"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} new categories ({len(CATEGORIES) - created_count} already existed)"
            )
        )
