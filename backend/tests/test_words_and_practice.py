"""/api/today, /api/words, /api/words/{id}, /api/practice tests."""
import pytest
from datetime import date
from conftest import BASE_URL


# ---- Today's word generation (Gemini) ----
class TestTodayWord:
    @pytest.fixture(scope="class")
    def first_word(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/today", headers=test_user["headers"], timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("id", "word", "phonetic", "meaning", "example",
                  "unlocked_date", "unlocked_at"):
            assert k in d and d[k], f"Missing/empty field {k}: {d}"
        assert d["unlocked_date"] == date.today().isoformat()
        assert d["practiced"] is False
        return d

    def test_today_first_call_generates(self, first_word):
        assert first_word["word"]

    def test_today_idempotent_same_day(self, api, test_user, first_word):
        r = api.get(f"{BASE_URL}/api/today", headers=test_user["headers"], timeout=60)
        assert r.status_code == 200
        d2 = r.json()
        assert d2["id"] == first_word["id"]
        assert d2["word"] == first_word["word"]

    def test_today_uniqueness_across_days(self, api, test_user, mongo, first_word):
        # Move first word's unlocked_date back so today is empty
        mongo.words.update_one(
            {"id": first_word["id"]}, {"$set": {"unlocked_date": "2000-01-01"}}
        )
        try:
            r = api.get(f"{BASE_URL}/api/today",
                        headers=test_user["headers"], timeout=60)
            assert r.status_code == 200, r.text
            new = r.json()
            assert new["word"] != first_word["word"], \
                f"Got same word again: {new['word']}"
            # Track new ID for sibling tests via class attribute
            TestTodayWord.second_word_id = new["id"]
        finally:
            # Restore so other tests have a current "today" word too
            pass


# ---- Words list / get one ----
class TestWordsList:
    def test_words_list_returns_sorted_with_practiced(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/words", headers=test_user["headers"])
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1
        # All must have practiced bool
        for w in arr:
            assert "practiced" in w and isinstance(w["practiced"], bool)
        # Sorted by unlocked_at desc
        times = [w["unlocked_at"] for w in arr]
        assert times == sorted(times, reverse=True)

    def test_word_by_id_owner(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/words", headers=test_user["headers"])
        wid = r.json()[0]["id"]
        r2 = api.get(f"{BASE_URL}/api/words/{wid}", headers=test_user["headers"])
        assert r2.status_code == 200
        assert r2.json()["id"] == wid

    def test_word_by_id_unknown_404(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/words/nope-not-real-id",
                    headers=test_user["headers"])
        assert r.status_code == 404


# ---- Practice ----
class TestPractice:
    def test_practice_invalid_empty_sentences_400(self, api, test_user):
        r = api.get(f"{BASE_URL}/api/words", headers=test_user["headers"])
        wid = r.json()[0]["id"]
        r2 = api.post(f"{BASE_URL}/api/practice", headers=test_user["headers"],
                      json={"word_id": wid, "sentences": ["", "  ", "ok"]})
        assert r2.status_code == 400, r2.text

    def test_practice_unknown_word_404(self, api, test_user):
        r = api.post(f"{BASE_URL}/api/practice", headers=test_user["headers"],
                     json={"word_id": "nope-x", "sentences": ["a", "b", "c"]})
        assert r.status_code == 404, r.text

    def test_practice_success_then_today_practiced_true(self, api, test_user):
        # Get the current today word
        rt = api.get(f"{BASE_URL}/api/today", headers=test_user["headers"], timeout=60)
        assert rt.status_code == 200
        word = rt.json()
        sentences = [
            f"I use the word {word['word']} carefully in this sentence.",
            f"She demonstrated what {word['word']} truly means today.",
            f"Learning {word['word']} expands my vocabulary noticeably.",
        ]
        r = api.post(f"{BASE_URL}/api/practice", headers=test_user["headers"],
                     json={"word_id": word["id"], "sentences": sentences}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert 0 <= d["overall_score"] <= 30
        assert len(d["feedbacks"]) == 3
        for fb in d["feedbacks"]:
            assert 0 <= fb["score"] <= 10
            assert "sentence" in fb and "feedback" in fb
        assert isinstance(d["summary"], str)

        # Today should now show practiced=true
        r2 = api.get(f"{BASE_URL}/api/today", headers=test_user["headers"], timeout=60)
        assert r2.status_code == 200
        assert r2.json()["practiced"] is True
