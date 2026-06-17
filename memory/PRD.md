# Lexis — Daily Vocabulary Learning App (PRD)

## Vision
A calm, editorial mobile app that teaches one new English word every day. The learner reads its meaning, hears its pronunciation, sees an example, then crafts three sentences to receive AI feedback. After 5 unlocked words, on-demand revision sessions help cement knowledge.

## Users
Multi-user. JWT auth (email + password). Each user has their own private word library, streak, and revision history.

## Core flows

### 1. Auth
- Signup with name/email/password (min 6 chars).
- Login with email/password.
- Token persisted in AsyncStorage; auth gate in `_layout.tsx` redirects.

### 2. Daily Word (Today tab)
- On open, calls `GET /api/today`.
- If the user already has a word for today's local date, return it. Otherwise generate a fresh one via Gemini 3 Flash, excluding all their previously learned words, and store it with `unlocked_date = YYYY-MM-DD`. New words unlock strictly at local midnight; skipped days are skipped.
- Shows: word, IPA phonetic, audio playback (expo-speech), meaning, example sentence, Practice CTA.

### 3. Practice
- `POST /api/practice` with 3 sentences.
- LLM scores each 0-10 with feedback + overall summary. Stored in `practices` collection.

### 4. Library tab
- Lists all unlocked words with hero header (image + streak metrics overlaid).
- Tap → word detail (`/word/[id]`).

### 5. Revise tab
- Locked until 5+ words unlocked.
- Pick count (3, 5, 10, 20, or All). `POST /api/revision/start` returns a random sample.
- Stepped flow (`/revision/play`): for each word the user enters meaning + 3 sentences. LLM returns meaning_score (0-10), sentence_feedbacks (3 × 0-10), correct meaning. Per-word max 40, total = count × 40.
- Final summary screen with percentage and reflection.
- `GET /api/revision/history` lists past sessions.

### 6. Profile tab
- Stats (words, streak, practices, revisions). Sign out.

## Integrations
- **Gemini 3 Flash** via `emergentintegrations` + `EMERGENT_LLM_KEY` for word generation & feedback evaluation.
- **expo-speech** for on-device text-to-speech (no API key required).

## Tech
- Backend: FastAPI + Motor (Mongo) + JWT (PyJWT) + bcrypt.
- Frontend: Expo Router (SDK 54), TypeScript, react-native-safe-area-context, expo-linear-gradient, Feather icons, expo-image.
- Design: Editorial Light personality — Cormorant Garamond style serif headings + system sans body, ochre (#A16207) accent, paper surface (#FAF9F6).

## Data model (MongoDB)
- `users`: `{id, email, name, password_hash, created_at}`
- `words`: `{id, user_id, word, phonetic, meaning, example, unlocked_date, unlocked_at}` — uniqueness per user enforced by excluding previously seen words at generation time.
- `practices`: `{id, user_id, word_id, sentences, feedbacks, overall_score, summary, created_at}`
- `revisions`: `{id, user_id, word_ids, answers[], started_at, finished_at, total_score, max_score}`

## Out of scope (MVP)
- Notifications (would require deployed build + Firebase config).
- Social features.
