import jwt
from django.conf import settings


def make_auth_header(user):
    """Generate a Supabase-style JWT auth header for a user."""
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "aud": "authenticated",
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}
