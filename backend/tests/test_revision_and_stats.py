"""Revision flow + stats tests."""
import uuid
import pytest
from datetime import datetime, timezone, date, timedelta
from conftest import BASE_URL


def _seed_words(mongo, user_id, n):
    """Insert n synthetic words for the user."""
    base = date.today() - timedelta(days=10)
    docs = []
    for i in range(n):
        d = (base + timedelta(days=i)).isoformat()
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "word": f"testword{i}_{uuid.uuid4().hex[:6]}",
            "phonetic": f"/test{i}/",
            "meaning": f"A test meaning for word {i}.",
            "example": f"Example using testword{i} in a sentence.",
            "unlocked_date": d,
            "unlocked_at": datetime.now(timezone.utc).isoformat(),
        })
    mongo.words.insert_many(docs)
    return docs


# ---- Revision start: too few words ----
class TestRevisionStart400:
    @pytest.fixture(scope="class")
    def fresh_user(self, api, mongo):
        import time
        ts = int(time.time() * 1000)
        email = f"testbe_rev+{ts}@x.com"
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": email, "password": "abcdef", "name": "TEST_Rev"})
        d = r.json()
        headers = {"Authorization": f"Bearer {d['token']}",
                   "Content-Type": "application/json"}
        uid = d["user"]["id"]
        yield {"headers": headers, "uid": uid}
        mongo.users.delete_many({"id": uid})
        mongo.words.delete_many({"user_id": uid})
        mongo.revisions.delete_many({"user_id": uid})

    def test_start_revision_less_than_5_words_400(self, api, fresh_user, mongo):
        # Seed 3 only
        _seed_words(mongo, fresh_user["uid"], 3)
        r = api.post(f"{BASE_URL}/api/revision/start",
                     headers=fresh_user["headers"], json={"count": 3})
        assert r.status_code == 400, r.text


# ---- Full revision flow ----
class TestRevisionFlow:
    @pytest.fixture(scope="class")
    def rev_user(self, api, mongo):
        import time
        ts = int(time.time() * 1000)
        email = f"testbe_revflow+{ts}@x.com"
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": email, "password": "abcdef",
                           "name": "TEST_RevFlow"})
        d = r.json()
        headers = {"Authorization": f"Bearer {d['token']}",
                   "Content-Type": "application/json"}
        uid = d["user"]["id"]
        docs = _seed_words(mongo, uid, 6)
        yield {"headers": headers, "uid": uid, "words": docs}
        mongo.users.delete_many({"id": uid})
        mongo.words.delete_many({"user_id": uid})
        mongo.revisions.delete_many({"user_id": uid})
        mongo.practices.delete_many({"user_id": uid})

    def test_start_revision_with_5plus(self, api, rev_user):
        r = api.post(f"{BASE_URL}/api/revision/start",
                     headers=rev_user["headers"], json={"count": 3})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "revision_id" in d
        assert d["total"] == 3
        assert len(d["words"]) == 3
        for i, w in enumerate(d["words"]):
            for k in ("word_id", "word", "phonetic", "index", "total"):
                assert k in w
            assert w["total"] == 3
        TestRevisionFlow.rev_data = d

    def test_revision_answer_invalid(self, api, rev_user):
        rev = TestRevisionFlow.rev_data
        # Unknown revision
        r = api.post(f"{BASE_URL}/api/revision/answer",
                     headers=rev_user["headers"],
                     json={"revision_id": "bad-id",
                           "word_id": rev["words"][0]["word_id"],
                           "meaning": "x", "sentences": ["a", "b", "c"]})
        assert r.status_code == 404
        # Empty meaning
        r2 = api.post(f"{BASE_URL}/api/revision/answer",
                      headers=rev_user["headers"],
                      json={"revision_id": rev["revision_id"],
                            "word_id": rev["words"][0]["word_id"],
                            "meaning": "  ",
                            "sentences": ["a", "b", "c"]})
        assert r2.status_code == 400
        # Fewer than 3 sentences => Pydantic validation 422
        r3 = api.post(f"{BASE_URL}/api/revision/answer",
                      headers=rev_user["headers"],
                      json={"revision_id": rev["revision_id"],
                            "word_id": rev["words"][0]["word_id"],
                            "meaning": "ok",
                            "sentences": ["a", "b"]})
        assert r3.status_code in (400, 422)

    def test_revision_answer_success_all_words(self, api, rev_user):
        rev = TestRevisionFlow.rev_data
        for w in rev["words"]:
            payload = {
                "revision_id": rev["revision_id"],
                "word_id": w["word_id"],
                "meaning": f"A meaning for {w['word']}.",
                "sentences": [
                    f"I use {w['word']} carefully.",
                    f"She showed me what {w['word']} can mean.",
                    f"Studying {w['word']} helps a lot.",
                ],
            }
            r = api.post(f"{BASE_URL}/api/revision/answer",
                         headers=rev_user["headers"], json=payload, timeout=60)
            assert r.status_code == 200, r.text
            d = r.json()
            assert 0 <= d["meaning_score"] <= 10
            assert isinstance(d["meaning_feedback"], str)
            assert d["correct_meaning"]
            assert len(d["sentence_feedbacks"]) == 3
            for fb in d["sentence_feedbacks"]:
                assert 0 <= fb["score"] <= 10
            assert 0 <= d["overall_score"] <= 40

    def test_revision_finish_idempotent(self, api, rev_user):
        rev = TestRevisionFlow.rev_data
        r1 = api.post(
            f"{BASE_URL}/api/revision/{rev['revision_id']}/finish",
            headers=rev_user["headers"],
        )
        assert r1.status_code == 200, r1.text
        s1 = r1.json()
        assert s1["revision_id"] == rev["revision_id"]
        assert s1["word_count"] == 3
        assert s1["max_score"] == 3 * 40
        assert 0 <= s1["total_score"] <= s1["max_score"]
        assert 0 <= s1["percentage"] <= 100
        assert s1["started_at"] and s1["finished_at"]

        # Second call - should return same finished_at
        r2 = api.post(
            f"{BASE_URL}/api/revision/{rev['revision_id']}/finish",
            headers=rev_user["headers"],
        )
        assert r2.status_code == 200
        s2 = r2.json()
        assert s2["finished_at"] == s1["finished_at"]

    def test_revision_history(self, api, rev_user):
        r = api.get(f"{BASE_URL}/api/revision/history",
                    headers=rev_user["headers"])
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1
        for item in arr:
            for k in ("revision_id", "total_score", "max_score",
                      "percentage", "word_count", "started_at", "finished_at"):
                assert k in item
            assert item["finished_at"] is not None
        # Sorted by finished_at desc
        finishes = [x["finished_at"] for x in arr]
        assert finishes == sorted(finishes, reverse=True)


# ---- Stats ----
class TestStats:
    def test_stats_basic(self, api, test_user, mongo):
        r = api.get(f"{BASE_URL}/api/stats", headers=test_user["headers"])
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_words", "total_practices",
                  "total_revisions", "streak", "can_revise"):
            assert k in d
        assert isinstance(d["can_revise"], bool)
        assert d["can_revise"] == (d["total_words"] >= 5)
        assert d["streak"] >= 0
