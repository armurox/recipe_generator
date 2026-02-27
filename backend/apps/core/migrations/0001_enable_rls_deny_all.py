"""Enable Row Level Security on all public tables (deny-all).

With no explicit policies, RLS blocks all access via Supabase PostgREST API
while Django's direct database connection (superuser role) bypasses RLS.
This is defense-in-depth: Django handles auth at the API layer, and RLS
prevents any data exposure through the PostgREST sidecar.

Skipped on non-PostgreSQL backends (e.g. SQLite in tests).
"""

from django.db import migrations

# All 18 public tables in the schema.
# Django internal tables first, then app tables alphabetically.
TABLES = [
    # Django framework tables
    "auth_group",
    "auth_group_permissions",
    "auth_permission",
    "django_admin_log",
    "django_content_type",
    "django_migrations",
    "django_session",
    # App tables
    "cooking_log",
    "ingredient_categories",
    "ingredients",
    "pantry_items",
    "receipt_items",
    "receipt_scans",
    "recipes",
    "saved_recipes",
    "users",
    "users_groups",
    "users_user_permissions",
]


def enable_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in TABLES:
        schema_editor.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")


def disable_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for table in TABLES:
        schema_editor.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY;")


class Migration(migrations.Migration):
    dependencies = [
        ("admin", "0001_initial"),
        ("contenttypes", "0001_initial"),
        ("sessions", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("ingredients", "0001_initial"),
        ("pantry", "0001_initial"),
        ("receipts", "0001_initial"),
        ("recipes", "0001_initial"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(enable_rls, disable_rls),
    ]
