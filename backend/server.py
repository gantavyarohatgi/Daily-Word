"""Lexis backend - daily vocabulary learning app."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import uuid
import jwt
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---- Config ----
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', '720'))
GEMINI_MODEL = "gemini-3-flash-preview"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("lexis")


# ============== MODELS ==============
class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=60)


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class WordOut(BaseModel):
    id: str
    word: str
    phonetic: str
    meaning: str
    example: str
    unlocked_date: str   # YYYY-MM-DD
    unlocked_at: str     # ISO

    practiced: bool = False


class PracticeSubmitReq(BaseModel):
    word_id: str
    sentences: List[str] = Field(min_length=3, max_length=3)


class SentenceFeedback(BaseModel):
    sentence: str
    score: int   # 0-10
    feedback: str


class PracticeResultOut(BaseModel):
    overall_score: int
    feedbacks: List[SentenceFeedback]
    summary: str


class StartRevisionReq(BaseModel):
    count: int = Field(ge=1, le=50)


class RevisionWordOut(BaseModel):
    revision_id: str
    word_id: str
    word: str
    phonetic: str
    index: int
    total: int


class RevisionAnswerReq(BaseModel):
    revision_id: str
    word_id: str
    meaning: str
    sentences: List[str] = Field(min_length=3, max_length=3)


class RevisionAnswerOut(BaseModel):
    meaning_score: int          # 0-10
    meaning_feedback: str
    correct_meaning: str
    sentence_feedbacks: List[SentenceFeedback]
    overall_score: int


class RevisionSummaryOut(BaseModel):
    revision_id: str
    total_score: int
    max_score: int
    percentage: int
    word_count: int
    started_at: str
    finished_at: str


# ============== HELPERS ==============
def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    if cred is None:
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def today_str() -> str:
    return date.today().isoformat()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def extract_json(text: str) -> dict:
    """Try to extract JSON from LLM text response."""
    # Try fenced code block first
    m = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    else:
        m = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
        if m:
            text = m.group(1)
    return json.loads(text)


async def llm_chat(system_message: str, user_text: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_message,
    ).with_model("gemini", GEMINI_MODEL)
    resp = await chat.send_message(UserMessage(text=user_text))
    return resp if isinstance(resp, str) else str(resp)


# ============== LLM TASKS ==============
async def generate_new_word(exclude: List[str]) -> dict:
    """Ask Gemini for a fresh word, not in exclude list."""
    sys = (
        "You are a vocabulary tutor for advanced English learners. "
        "Return ONLY a strict JSON object with keys: word, phonetic, meaning, example. "
        "The word should be one English word (no spaces, no hyphens), useful, interesting, "
        "and suitable for adult learners. The phonetic must be IPA, e.g. /əˈbʌn.dənt/. "
        "The meaning is one concise sentence. The example is one natural sentence using the word."
    )
    excl = ", ".join(exclude[-200:]) if exclude else "(none yet)"
    user = (
        f"Suggest a new vocabulary word the learner has NOT yet seen.\n"
        f"Already learned words (avoid these exact words): {excl}\n"
        f"Return ONLY JSON like: "
        f'{{"word": "ephemeral", "phonetic": "/ɪˈfɛm.ər.əl/", '
        f'"meaning": "Lasting for a very short time.", '
        f'"example": "Social media fame is often ephemeral."}}'
    )
    for attempt in range(3):
        try:
            raw = await llm_chat(sys, user)
            data = extract_json(raw)
            w = data.get("word", "").strip().lower()
            if not w or any(c.isspace() for c in w) or w in {e.lower() for e in exclude}:
                continue
            return {
                "word": w,
                "phonetic": str(data.get("phonetic", "")).strip(),
                "meaning": str(data.get("meaning", "")).strip(),
                "example": str(data.get("example", "")).strip(),
            }
        except Exception as e:
            logger.warning(f"generate_new_word attempt {attempt} failed: {e}")
    raise HTTPException(503, "Could not generate a new word right now. Try again shortly.")


async def evaluate_sentences(word: str, meaning: str, sentences: List[str]) -> dict:
    sys = (
        "You are a strict but encouraging English tutor. "
        "Score each sentence from 0 to 10 based on: (a) correct grammar, "
        "(b) the target word is used naturally with its intended meaning, "
        "(c) the sentence shows understanding (not trivial). "
        "Return ONLY JSON."
    )
    user = (
        f"Word: {word}\nMeaning: {meaning}\n"
        f"Learner's 3 sentences:\n"
        f"1. {sentences[0]}\n2. {sentences[1]}\n3. {sentences[2]}\n\n"
        "Return JSON like:\n"
        '{"feedbacks":[{"score":8,"feedback":"..."},{"score":..,"feedback":".."},'
        '{"score":..,"feedback":".."}],"summary":"one-line overall remark"}'
    )
    raw = await llm_chat(sys, user)
    data = extract_json(raw)
    fbs = data.get("feedbacks") or []
    while len(fbs) < 3:
        fbs.append({"score": 0, "feedback": "No feedback returned."})
    out = []
    total = 0
    for i, s in enumerate(sentences):
        score = int(fbs[i].get("score", 0))
        score = max(0, min(10, score))
        total += score
        out.append({"sentence": s, "score": score,
                    "feedback": str(fbs[i].get("feedback", "")).strip()})
    return {
        "overall_score": total,
        "feedbacks": out,
        "summary": str(data.get("summary", "")).strip(),
    }


async def evaluate_revision_answer(word: str, correct_meaning: str,
                                   user_meaning: str, sentences: List[str]) -> dict:
    sys = (
        "You are an English tutor evaluating a learner's revision answer. "
        "Score meaning 0-10 by closeness to the correct meaning (paraphrase OK). "
        "Score each sentence 0-10 (grammar + correct use of the word). "
        "Return ONLY JSON."
    )
    user = (
        f"Word: {word}\nCorrect meaning: {correct_meaning}\n"
        f"Learner's meaning: {user_meaning}\n"
        f"Learner's 3 sentences:\n"
        f"1. {sentences[0]}\n2. {sentences[1]}\n3. {sentences[2]}\n\n"
        "Return JSON like:\n"
        '{"meaning_score":7,"meaning_feedback":"...",'
        '"sentence_feedbacks":[{"score":8,"feedback":"..."},{"score":..,"feedback":".."},'
        '{"score":..,"feedback":".."}]}'
    )
    raw = await llm_chat(sys, user)
    data = extract_json(raw)
    msc = max(0, min(10, int(data.get("meaning_score", 0))))
    sfb_raw = data.get("sentence_feedbacks") or []
    while len(sfb_raw) < 3:
        sfb_raw.append({"score": 0, "feedback": "No feedback."})
    sfb = []
    s_total = 0
    for i, s in enumerate(sentences):
        sc = max(0, min(10, int(sfb_raw[i].get("score", 0))))
        s_total += sc
        sfb.append({"sentence": s, "score": sc,
                    "feedback": str(sfb_raw[i].get("feedback", "")).strip()})
    return {
        "meaning_score": msc,
        "meaning_feedback": str(data.get("meaning_feedback", "")).strip(),
        "correct_meaning": correct_meaning,
        "sentence_feedbacks": sfb,
        "overall_score": msc + s_total,   # 0-40
    }


# ============== ROUTES: AUTH ==============
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(req: SignupReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(409, "Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": req.email.lower(),
        "name": req.name.strip(),
        "password_hash": hash_password(req.password),
        "created_at": utc_now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = make_token(user_id)
    return AuthResponse(
        token=token,
        user={"id": user_id, "email": user_doc["email"], "name": user_doc["name"]},
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginReq):
    u = await db.users.find_one({"email": req.email.lower()})
    if not u or not verify_password(req.password, u["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = make_token(u["id"])
    return AuthResponse(
        token=token,
        user={"id": u["id"], "email": u["email"], "name": u["name"]},
    )


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ============== ROUTES: TODAY'S WORD ==============
async def _word_to_out(w: dict) -> WordOut:
    practiced = await db.practices.find_one(
        {"word_id": w["id"]}, {"_id": 0, "id": 1}
    )
    return WordOut(
        id=w["id"],
        word=w["word"],
        phonetic=w["phonetic"],
        meaning=w["meaning"],
        example=w["example"],
        unlocked_date=w["unlocked_date"],
        unlocked_at=w["unlocked_at"],
        practiced=bool(practiced),
    )


@api_router.get("/today", response_model=WordOut)
async def get_today_word(user: dict = Depends(get_current_user)):
    today = today_str()
    existing = await db.words.find_one(
        {"user_id": user["id"], "unlocked_date": today}, {"_id": 0}
    )
    if existing:
        return await _word_to_out(existing)

    # Generate fresh word
    learned_cursor = db.words.find({"user_id": user["id"]}, {"_id": 0, "word": 1})
    learned = [d["word"] async for d in learned_cursor]
    new_word = await generate_new_word(learned)
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "word": new_word["word"],
        "phonetic": new_word["phonetic"],
        "meaning": new_word["meaning"],
        "example": new_word["example"],
        "unlocked_date": today,
        "unlocked_at": utc_now_iso(),
    }
    await db.words.insert_one(doc)
    return await _word_to_out(doc)


@api_router.get("/words", response_model=List[WordOut])
async def list_words(user: dict = Depends(get_current_user)):
    cursor = db.words.find({"user_id": user["id"]}, {"_id": 0}).sort("unlocked_at", -1)
    docs = await cursor.to_list(1000)
    out = []
    for d in docs:
        out.append(await _word_to_out(d))
    return out


@api_router.get("/words/{word_id}", response_model=WordOut)
async def get_word(word_id: str, user: dict = Depends(get_current_user)):
    w = await db.words.find_one(
        {"id": word_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not w:
        raise HTTPException(404, "Word not found")
    return await _word_to_out(w)


# ============== ROUTES: PRACTICE ==============
@api_router.post("/practice", response_model=PracticeResultOut)
async def practice_submit(req: PracticeSubmitReq,
                          user: dict = Depends(get_current_user)):
    w = await db.words.find_one(
        {"id": req.word_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not w:
        raise HTTPException(404, "Word not found")
    cleaned = [s.strip() for s in req.sentences]
    if any(not s for s in cleaned):
        raise HTTPException(400, "All three sentences are required")

    result = await evaluate_sentences(w["word"], w["meaning"], cleaned)
    await db.practices.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "word_id": w["id"],
        "sentences": cleaned,
        "feedbacks": result["feedbacks"],
        "overall_score": result["overall_score"],
        "summary": result["summary"],
        "created_at": utc_now_iso(),
    })
    return PracticeResultOut(**result)


# ============== ROUTES: REVISION ==============
@api_router.post("/revision/start")
async def start_revision(req: StartRevisionReq,
                         user: dict = Depends(get_current_user)):
    count = await db.words.count_documents({"user_id": user["id"]})
    if count < 5:
        raise HTTPException(400, "Unlock at least 5 words before revising")
    n = min(req.count, count)
    # Sample random words
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$sample": {"size": n}},
        {"$project": {"_id": 0}},
    ]
    sampled = await db.words.aggregate(pipeline).to_list(n)
    rev_id = str(uuid.uuid4())
    await db.revisions.insert_one({
        "id": rev_id,
        "user_id": user["id"],
        "word_ids": [w["id"] for w in sampled],
        "answers": [],
        "started_at": utc_now_iso(),
        "finished_at": None,
        "total_score": 0,
        "max_score": n * 40,  # 10 meaning + 30 sentences per word
    })
    return {
        "revision_id": rev_id,
        "total": n,
        "words": [
            {
                "word_id": w["id"], "word": w["word"], "phonetic": w["phonetic"],
                "index": i, "total": n,
            }
            for i, w in enumerate(sampled)
        ],
    }


@api_router.post("/revision/answer", response_model=RevisionAnswerOut)
async def revision_answer(req: RevisionAnswerReq,
                          user: dict = Depends(get_current_user)):
    rev = await db.revisions.find_one(
        {"id": req.revision_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not rev:
        raise HTTPException(404, "Revision not found")
    if rev.get("finished_at"):
        raise HTTPException(400, "Revision already finished")
    if req.word_id not in rev.get("word_ids", []):
        raise HTTPException(400, "This word is not part of the revision")
    if any(a.get("word_id") == req.word_id for a in rev.get("answers", [])):
        raise HTTPException(400, "Already answered this word")
    w = await db.words.find_one(
        {"id": req.word_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not w:
        raise HTTPException(404, "Word not found")
    cleaned = [s.strip() for s in req.sentences]
    if any(not s for s in cleaned) or not req.meaning.strip():
        raise HTTPException(400, "Meaning and all sentences are required")

    evald = await evaluate_revision_answer(
        w["word"], w["meaning"], req.meaning.strip(), cleaned
    )
    await db.revisions.update_one(
        {"id": req.revision_id},
        {
            "$push": {"answers": {
                "word_id": w["id"],
                "word": w["word"],
                "user_meaning": req.meaning.strip(),
                "sentences": cleaned,
                "evaluation": evald,
                "at": utc_now_iso(),
            }},
            "$inc": {"total_score": evald["overall_score"]},
        },
    )
    return RevisionAnswerOut(**evald)


@api_router.post("/revision/{revision_id}/finish", response_model=RevisionSummaryOut)
async def finish_revision(revision_id: str,
                          user: dict = Depends(get_current_user)):
    rev = await db.revisions.find_one(
        {"id": revision_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not rev:
        raise HTTPException(404, "Revision not found")
    finished_at = rev.get("finished_at") or utc_now_iso()
    if not rev.get("finished_at"):
        await db.revisions.update_one(
            {"id": revision_id}, {"$set": {"finished_at": finished_at}}
        )
    total = rev.get("total_score", 0)
    max_score = rev.get("max_score", 0) or 1
    return RevisionSummaryOut(
        revision_id=rev["id"],
        total_score=total,
        max_score=max_score,
        percentage=round(total * 100 / max_score),
        word_count=len(rev.get("word_ids", [])),
        started_at=rev["started_at"],
        finished_at=finished_at,
    )


@api_router.get("/revision/history")
async def revision_history(user: dict = Depends(get_current_user)):
    cursor = db.revisions.find(
        {"user_id": user["id"], "finished_at": {"$ne": None}},
        {"_id": 0, "id": 1, "total_score": 1, "max_score": 1,
         "word_ids": 1, "started_at": 1, "finished_at": 1},
    ).sort("finished_at", -1)
    docs = await cursor.to_list(200)
    out = []
    for d in docs:
        ms = d.get("max_score", 0) or 1
        out.append({
            "revision_id": d["id"],
            "total_score": d.get("total_score", 0),
            "max_score": ms,
            "percentage": round(d.get("total_score", 0) * 100 / ms),
            "word_count": len(d.get("word_ids", [])),
            "started_at": d.get("started_at"),
            "finished_at": d.get("finished_at"),
        })
    return out


# ============== ROUTES: STATS ==============
@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total_words = await db.words.count_documents({"user_id": user["id"]})
    total_practices = await db.practices.count_documents({"user_id": user["id"]})
    total_revisions = await db.revisions.count_documents(
        {"user_id": user["id"], "finished_at": {"$ne": None}}
    )
    # Streak: consecutive days up to today (or yesterday)
    cursor = db.words.find(
        {"user_id": user["id"]}, {"_id": 0, "unlocked_date": 1}
    ).sort("unlocked_date", -1)
    dates = sorted({d["unlocked_date"] async for d in cursor}, reverse=True)
    streak = 0
    today_d = date.today()
    expected = today_d
    for s in dates:
        try:
            d = date.fromisoformat(s)
        except Exception:
            continue
        if d == expected:
            streak += 1
            expected = expected - timedelta(days=1)
        elif d == expected - timedelta(days=1) and streak == 0:
            # If today's word not unlocked, start from yesterday
            streak = 1
            expected = d - timedelta(days=1)
        else:
            break
    can_revise = total_words >= 5
    return {
        "total_words": total_words,
        "total_practices": total_practices,
        "total_revisions": total_revisions,
        "streak": streak,
        "can_revise": can_revise,
    }


@api_router.get("/")
async def root():
    return {"app": "Lexis", "status": "ok"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
