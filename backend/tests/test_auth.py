"""Auth tests: signup, login, /me."""
import time
import pytest
from conftest import BASE_URL


# ---- Signup ----
class TestSignup:
    def test_signup_success(self, api, mongo):
        ts = int(time.time() * 1000)
        email = f"TEST_signup+{ts}@x.com"
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": email, "password": "abcdef", "name": "TEST_User"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["token"]
        assert d["user"]["email"] == email.lower()
        assert d["user"]["name"] == "TEST_User"
        assert "id" in d["user"]
        # Verify hashed password stored
        u = mongo.users.find_one({"id": d["user"]["id"]})
        assert u and u["password_hash"] != "abcdef"
        assert u["email"] == email.lower()
        # cleanup
        mongo.users.delete_many({"id": d["user"]["id"]})

    def test_signup_duplicate_email_409(self, api, test_user):
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": test_user["email"], "password": "xxxxxx",
                           "name": "dup"})
        assert r.status_code == 409, r.text


# ---- Login ----
class TestLogin:
    def test_login_success(self, api, test_user):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": test_user["email"], "password": test_user["password"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["token"]
        assert d["user"]["email"] == test_user["email"]

    def test_login_wrong_password_401(self, api, test_user):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": test_user["email"], "password": "wrongpass"})
        assert r.status_code == 401, r.text

    def test_login_unknown_email_401(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": "nosuch_TEST_user@x.com", "password": "abcdef"})
        assert r.status_code == 401, r.text


# ---- /me ----
class TestMe:
    def test_me_returns_user_no_secrets(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=test_user["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == test_user["email"]
        assert "password_hash" not in d
        assert "_id" not in d
        assert d["id"] == test_user["user"]["id"]

    def test_me_no_token_401(self, api):
        r = api.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401
