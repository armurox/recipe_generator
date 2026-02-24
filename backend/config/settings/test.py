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
