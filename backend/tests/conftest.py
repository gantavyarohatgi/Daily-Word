"""Shared fixtures for Lexis backend tests."""
import os
import time
import pytest
import requests
from pymongo import MongoClient
from datetime import datetime, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                          "https://vocab-revision-hub.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "lexis_db")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c.close()


@pytest.fixture(scope="session")
def test_user(api, mongo):
    """Create fresh test user via signup."""
    ts = int(time.time() * 1000)
    email = f"testbe+{ts}@x.com"
    payload = {"email": email, "password": "testpass123", "name": "TEST_Backend"}
    r = api.post(f"{BASE_URL}/api/auth/signup", json=payload)
    assert r.status_code == 200, f"Signup failed: {r.status_code} {r.text}"
    data = r.json()
    yield {
        "email": email,
        "password": "testpass123",
        "token": data["token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['token']}",
                    "Content-Type": "application/json"},
    }
    # Cleanup
    uid = data["user"]["id"]
    mongo.users.delete_many({"id": uid})
    mongo.words.delete_many({"user_id": uid})
    mongo.practices.delete_many({"user_id": uid})
    mongo.revisions.delete_many({"user_id": uid})
