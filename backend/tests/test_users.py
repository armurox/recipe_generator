import json
import uuid

import jwt
from django.conf import settings
from django.test import TestCase

from apps.users.models import User
from tests.conftest import make_auth_header
from tests.factories import UserFactory


class GetMeTest(TestCase):
    def setUp(self):
        self.user = UserFactory(email="test@example.com", display_name="Test User")
        self.auth = make_auth_header(self.user)

    def test_get_me(self):
        response = self.client.get("/api/v1/me", **self.auth)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id"], str(self.user.id))
        self.assertEqual(data["email"], "test@example.com")
        self.assertEqual(data["display_name"], "Test User")

    def test_patch_me(self):
        response = self.client.patch(
            "/api/v1/me",
            data=json.dumps({"display_name": "Updated Name", "household_size": 3}),
            content_type="application/json",
            **self.auth,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["display_name"], "Updated Name")
        self.assertEqual(data["household_size"], 3)

        self.user.refresh_from_db()
        self.assertEqual(self.user.display_name, "Updated Name")
        self.assertEqual(self.user.household_size, 3)

    def test_auto_creates_user(self):
        new_user_id = str(uuid.uuid4())
        payload = {"sub": new_user_id, "email": "new@example.com", "aud": "authenticated"}
        token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

        response = self.client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["id"], new_user_id)
        self.assertTrue(User.objects.filter(id=new_user_id).exists())

    def test_unauthenticated(self):
        response = self.client.get("/api/v1/me")
        self.assertEqual(response.status_code, 401)

    def test_invalid_token(self):
        response = self.client.get("/api/v1/me", HTTP_AUTHORIZATION="Bearer invalid")
        self.assertEqual(response.status_code, 401)
