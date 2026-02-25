import logging

import jwt
from django.conf import settings
from ninja.security import HttpBearer

from apps.users.models import User

logger = logging.getLogger(__name__)

# Lazy-initialized JWKS client for ES256 token verification.
# Supabase projects using asymmetric JWTs sign with ES256 and publish
# public keys at /.well-known/jwks.json. PyJWKClient handles key
# fetching and caching automatically.
_jwks_client = None


def _get_jwks_client():
    global _jwks_client
    if _jwks_client is None and settings.SUPABASE_URL:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client


def _decode_token(token):
    """Decode a Supabase JWT, supporting both ES256 (JWKS) and HS256 (legacy).

    Tries ES256 via JWKS first (if SUPABASE_URL is configured), then falls
    back to HS256 with the legacy shared secret. Tests use HS256.
    """
    jwks_client = _get_jwks_client()

    # Try ES256 with JWKS (asymmetric — modern Supabase projects)
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
        except jwt.PyJWTError:
            logger.debug("[_decode_token] ES256/JWKS verification failed, trying HS256")

    # Fall back to HS256 with shared secret (legacy projects and tests)
    if settings.SUPABASE_JWT_SECRET:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )

    raise jwt.InvalidTokenError("No valid verification method available")


class SupabaseJWTAuth(HttpBearer):
    # Decision: async authenticate() since this runs on every request under ASGI.
    # Uses aget_or_create for fully non-blocking auth resolution.
    async def authenticate(self, request, token):
        try:
            payload = _decode_token(token)
        except jwt.PyJWTError:
            logger.warning("[authenticate] invalid JWT token")
            return None

        sub = payload.get("sub")
        if not sub:
            logger.warning("[authenticate] JWT missing 'sub' claim")
            return None

        email = payload.get("email", "")
        user, created = await User.objects.aget_or_create(
            id=sub,
            defaults={"email": email},
        )
        if created:
            logger.info("[authenticate] auto-created user=%s email=%s", sub, email)
        return user
