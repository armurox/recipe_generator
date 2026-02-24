import logging

import jwt
from django.conf import settings
from ninja.security import HttpBearer

from apps.users.models import User

logger = logging.getLogger(__name__)


class SupabaseJWTAuth(HttpBearer):
    # Decision: async authenticate() since this runs on every request under ASGI.
    # Uses aget_or_create for fully non-blocking auth resolution.
    async def authenticate(self, request, token):
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
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
