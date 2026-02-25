"""Tests for the dual-algorithm JWT authentication flow (ES256 + HS256 fallback)."""

import uuid
from unittest.mock import MagicMock, patch

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from django.test import TestCase, override_settings

from apps.users.auth import _decode_token
from apps.users.models import User
from tests.conftest import EC_PUBLIC_KEY, make_es256_auth_header, make_es256_token
from tests.factories import UserFactory


def _mock_jwks_client(public_key):
    """Create a mock PyJWKClient that returns the given public key."""
    mock_client = MagicMock()
    mock_signing_key = MagicMock()
    mock_signing_key.key = public_key
    mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
    return mock_client


class DecodeTokenES256Test(TestCase):
    """Unit tests for _decode_token with ES256 tokens."""

    def _make_payload(self, **overrides):
        defaults = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "aud": "authenticated",
        }
        defaults.update(overrides)
        return defaults

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_valid_token(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        payload = self._make_payload()
        token = make_es256_token(payload)

        decoded = _decode_token(token)

        self.assertEqual(decoded["sub"], payload["sub"])
        self.assertEqual(decoded["email"], payload["email"])

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_wrong_key_falls_back_to_hs256(self, mock_get_client):
        """ES256 verification fails with wrong key, falls back to HS256."""
        wrong_key = ec.generate_private_key(ec.SECP256R1()).public_key()
        mock_get_client.return_value = _mock_jwks_client(wrong_key)

        # Sign with HS256 — ES256 will fail, HS256 should succeed
        payload = self._make_payload()
        token = jwt.encode(payload, "test-supabase-jwt-secret", algorithm="HS256")

        decoded = _decode_token(token)

        self.assertEqual(decoded["sub"], payload["sub"])

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_wrong_audience_rejected(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        payload = self._make_payload(aud="wrong-audience")
        token = make_es256_token(payload)

        # ES256 fails due to audience mismatch; HS256 also fails (wrong algorithm)
        with self.assertRaises(jwt.PyJWTError):
            _decode_token(token)

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_tampered_token_rejected(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        payload = self._make_payload()
        token = make_es256_token(payload)

        # Tamper with the token payload
        parts = token.split(".")
        parts[1] = parts[1][::-1]  # reverse the payload
        tampered = ".".join(parts)

        with self.assertRaises(jwt.PyJWTError):
            _decode_token(tampered)

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_signed_with_different_key_rejected(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)

        # Sign with a completely different EC key
        other_key = ec.generate_private_key(ec.SECP256R1())
        payload = self._make_payload()
        token = jwt.encode(payload, other_key, algorithm="ES256")

        # ES256 fails (signature mismatch); HS256 fails (not HS256 format)
        with self.assertRaises(jwt.PyJWTError):
            _decode_token(token)


class DecodeTokenHS256Test(TestCase):
    """Unit tests for _decode_token with HS256 tokens (legacy/fallback)."""

    def _make_payload(self, **overrides):
        defaults = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "aud": "authenticated",
        }
        defaults.update(overrides)
        return defaults

    def test_hs256_valid_token(self):
        payload = self._make_payload()
        token = jwt.encode(payload, "test-supabase-jwt-secret", algorithm="HS256")

        decoded = _decode_token(token)

        self.assertEqual(decoded["sub"], payload["sub"])
        self.assertEqual(decoded["email"], payload["email"])

    def test_hs256_wrong_secret_rejected(self):
        payload = self._make_payload()
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        with self.assertRaises(jwt.PyJWTError):
            _decode_token(token)

    def test_hs256_wrong_audience_rejected(self):
        payload = self._make_payload(aud="wrong-audience")
        token = jwt.encode(payload, "test-supabase-jwt-secret", algorithm="HS256")

        with self.assertRaises(jwt.PyJWTError):
            _decode_token(token)

    @override_settings(SUPABASE_JWT_SECRET="", SUPABASE_URL="")
    def test_no_verification_method_raises(self):
        """With no JWKS and no HS256 secret, all tokens are rejected."""
        payload = self._make_payload()
        token = jwt.encode(payload, "some-secret", algorithm="HS256")

        with self.assertRaises(jwt.PyJWTError):
            _decode_token(token)


class ES256AuthEndToEndTest(TestCase):
    """End-to-end tests: ES256 token → SupabaseJWTAuth → User resolution."""

    def setUp(self):
        self.user = UserFactory(email="es256@example.com", display_name="ES256 User")

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_token_authenticates_existing_user(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        auth = make_es256_auth_header(self.user)

        response = self.client.get("/api/v1/me", **auth)

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], str(self.user.id))
        self.assertEqual(data["email"], "es256@example.com")

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_token_auto_creates_user(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        new_id = str(uuid.uuid4())
        payload = {"sub": new_id, "email": "new-es256@example.com", "aud": "authenticated"}
        token = make_es256_token(payload)

        response = self.client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], new_id)
        self.assertTrue(User.objects.filter(id=new_id).exists())

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_invalid_signature_returns_401(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)

        # Sign with different key
        other_key = ec.generate_private_key(ec.SECP256R1())
        payload = {"sub": str(self.user.id), "email": self.user.email, "aud": "authenticated"}
        token = jwt.encode(payload, other_key, algorithm="ES256")

        response = self.client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")

        self.assertEqual(response.status_code, 401)

    @patch("apps.users.auth._get_jwks_client")
    def test_es256_missing_sub_returns_401(self, mock_get_client):
        mock_get_client.return_value = _mock_jwks_client(EC_PUBLIC_KEY)
        payload = {"email": "no-sub@example.com", "aud": "authenticated"}
        token = make_es256_token(payload)

        response = self.client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")

        # Auth succeeds (valid JWT) but missing sub → returns None → 401
        self.assertEqual(response.status_code, 401)
