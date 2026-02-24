import jwt
from django.conf import settings
from ninja.security import HttpBearer

from apps.users.models import User


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
            return None

        sub = payload.get("sub")
        if not sub:
            return None

        email = payload.get("email", "")
        user, _ = await User.objects.aget_or_create(
            id=sub,
            defaults={"email": email},
        )
        return user
