from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.users.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "display_name", "feedback_consent", "is_staff", "is_active")
    list_filter = ("feedback_consent", "is_staff", "is_active")
    search_fields = ("email", "display_name")
    ordering = ("-created_at",)
    readonly_fields = ("id", "created_at", "updated_at", "feedback_consent_updated_at", "last_login")

    # Fieldsets for the change (edit) form
    fieldsets = (
        (None, {"fields": ("id", "email")}),
        ("Profile", {"fields": ("display_name", "dietary_prefs", "household_size")}),
        ("Feedback", {"fields": ("feedback_consent", "feedback_consent_updated_at")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
        ("Timestamps", {"fields": ("created_at", "updated_at", "last_login")}),
    )

    # Fieldsets for the add (create) form — no password since we use Supabase Auth
    add_fieldsets = ((None, {"fields": ("id", "email", "display_name")}),)
