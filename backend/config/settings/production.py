import os

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F401, F403

DEBUG = False

# --- Fail-fast validation ---
# Ensure critical settings are configured before the app starts.

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "").split(",") if h.strip()]
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("ALLOWED_HOSTS must be set in production (comma-separated)")

CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must be set in production (comma-separated)")

if not SECRET_KEY:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production")

if not SUPABASE_JWT_SECRET:  # noqa: F405
    raise ImproperlyConfigured("SUPABASE_JWT_SECRET must be set in production")

if not SUPABASE_URL:  # noqa: F405
    raise ImproperlyConfigured("SUPABASE_URL must be set in production")

# --- HTTPS security ---
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health$"]  # Allow HTTP health checks from load balancer
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# CSRF trusted origins — must match CORS_ALLOWED_ORIGINS for cross-origin requests
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# --- API docs disabled in production ---
NINJA_DOCS_URL = None
