import uuid

import jwt
import pytest
from django.conf import settings
from django.test import Client

from apps.users.models import User


@pytest.fixture
def user(db):
    return User.objects.create_user(
        id=uuid.uuid4(),
        email="test@example.com",
        display_name="Test User",
    )


@pytest.fixture
def auth_token(user):
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "aud": "authenticated",
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers(auth_token):
    return {"HTTP_AUTHORIZATION": f"Bearer {auth_token}"}


@pytest.fixture
def api_client():
    return Client()
