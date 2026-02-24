import json
import uuid

import jwt
import pytest
from django.conf import settings

from apps.users.models import User


def test_get_me(api_client, user, auth_headers):
    response = api_client.get("/api/v1/me", **auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"


def test_patch_me(api_client, user, auth_headers):
    response = api_client.patch(
        "/api/v1/me",
        data=json.dumps({"display_name": "Updated Name", "household_size": 3}),
        content_type="application/json",
        **auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["display_name"] == "Updated Name"
    assert data["household_size"] == 3

    user.refresh_from_db()
    assert user.display_name == "Updated Name"
    assert user.household_size == 3


def test_get_me_auto_creates_user(api_client, db):
    new_user_id = str(uuid.uuid4())
    payload = {
        "sub": new_user_id,
        "email": "newuser@example.com",
        "aud": "authenticated",
    }
    token = jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")

    response = api_client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {token}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == new_user_id
    assert data["email"] == "newuser@example.com"

    assert User.objects.filter(id=new_user_id).exists()


def test_get_me_unauthenticated(api_client):
    response = api_client.get("/api/v1/me")
    assert response.status_code == 401


def test_get_me_invalid_token(api_client):
    response = api_client.get("/api/v1/me", HTTP_AUTHORIZATION="Bearer invalid-token")
    assert response.status_code == 401
