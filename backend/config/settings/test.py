from config.settings.base import *  # noqa: F401, F403

DEBUG = True

SECRET_KEY = "test-secret-key-not-for-production"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

SUPABASE_JWT_SECRET = "test-supabase-jwt-secret"

ANTHROPIC_API_KEY = "test-anthropic-key"
ANTHROPIC_MODEL = "claude-sonnet-4-20250514"

SPOONACULAR_API_KEY = "test-spoonacular-key"
SPOONACULAR_BASE_URL = "https://api.spoonacular.com"

SUPABASE_URL = "https://test-project.supabase.co"
