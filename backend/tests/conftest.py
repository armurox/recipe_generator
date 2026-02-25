import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from django.conf import settings


def make_auth_header(user):
    """Generate a Supabase-style JWT auth header for a user (HS256)."""
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "aud": "authenticated",
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


# Reusable EC key pair for ES256 tests.
# Generated once per test session; the private key signs tokens and the
# public key is injected into a mock JWKS client.
EC_PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
EC_PUBLIC_KEY = EC_PRIVATE_KEY.public_key()


def make_es256_token(payload):
    """Sign a JWT payload with the test EC private key (ES256)."""
    return jwt.encode(payload, EC_PRIVATE_KEY, algorithm="ES256")


def make_es256_auth_header(user):
    """Generate a JWT auth header for a user using ES256."""
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "aud": "authenticated",
    }
    return {"HTTP_AUTHORIZATION": f"Bearer {make_es256_token(payload)}"}
