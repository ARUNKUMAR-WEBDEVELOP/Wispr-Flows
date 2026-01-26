 Wispr-Flows

Short description
- Wispr-Flows is a Django-based backend that provides AI chat and speech features: AI chat sessions (Google Gemini), real-time speech-to-text (Deepgram WebSocket), text-to-speech (Deepgram Speak API), and Google sign-in with JWT authentication.

Why this repo
- This repository contains the server-side implementation for conversational and speech workflows. It stores chat sessions and messages, streams AI responses, and integrates with external AI/audio services.

Features (implemented)
- Chat sessions and message storage (Django models)
- Streaming AI responses using Google Gemini (streaming chunks)
- Real-time STT using Deepgram WebSocket integration
- TTS using Deepgram Speak API (handles long text chunking)
- Google Sign-in (verify ID token) and JWT generation (SimpleJWT)
- WebSocket routing for live audio (consumer referenced)
- Django admin support for managing models

Quick links to important code (paths inside repo)
- Django entry point: `wispr-backend/manage.py`
- Chat models, views, urls:
  - `wispr-backend/apps/Chat/models.py`
  - `wispr-backend/apps/Chat/views.py`
  - `wispr-backend/apps/Chat/urls.py`
  - `wispr-backend/apps/Chat/streaming.py` (Google Gemini streaming)
- Speech / Deepgram:
  - `wispr-backend/apps/speech/deepgram.py` (Deepgram websocket STT)
  - `wispr-backend/apps/speech/tts.py` (Deepgram TTS via HTTP)
  - `wispr-backend/apps/speech/routing.py` (websocket URL patterns)
  - (Check `wispr-backend/apps/speech/consumers.py` for the consumer implementation)
- Auth utilities:
  - `wispr-backend/apps/core/auth_utils.py` (Google token verify, user create, JWT tokens)
  - `wispr-backend/apps/account/serializers.py` (Google auth serializer)
- Migrations:
  - `wispr-backend/apps/Chat/migrations/0001_initial.py` (Chat DB schema)

Environment variables (required / recommended)
- `SECRET_KEY` — Django secret key
- `DEBUG` — true/false
- `DATABASE_URL` — database connection (or configure in settings)
- `DEEPGRAM_API_KEY` — Deepgram API key (STT and TTS)
- `GEMINI_API_KEY` — Google Gemini API key (AI streaming)
- `GOOGLE_CLIENT_ID` — used to validate Google ID tokens
- `DJANGO_ALLOWED_HOSTS` — hosts allowed by Django

Quick start (local development)
1. Clone the repository
   - git clone https://github.com/ARUNKUMAR-WEBDEVELOP/Wispr-Flows
   - cd Wispr-Flows/wispr-backend

2. IMPORTANT: remove committed virtualenv
   - The repo currently contains `venv/` under `wispr-backend/venv/`. Commit history shows installed packages inside it. Remove it and add to `.gitignore`:
     - git rm -r --cached venv
     - echo "venv/" >> .gitignore
     - git add .gitignore && git commit -m "Remove committed venv and add to .gitignore"

3. Create a new virtual environment and activate it
   - python3 -m venv .venv
   - source .venv/bin/activate  # macOS/Linux
     - or `.venv\Scripts\activate` on Windows

4. Install dependencies
   - If `requirements.txt` exists:
     - pip install -r requirements.txt
   - If not, add dependencies (examples):
     - pip install django djangorestframework google-generativeai websockets requests djangorestframework-simplejwt
     - pip freeze > requirements.txt

5. Configure environment variables
   - Create `.env` (or set env vars in your shell). Example `.env.example` should include the keys listed above.

6. Apply database migrations
   - python manage.py migrate

7. Create superuser
   - python manage.py createsuperuser

8. Start development server
   - python manage.py runserver
   - Default URL: http://127.0.0.1:8000/

API & WebSocket endpoints (from repo)
- Chat endpoints (see `wispr-backend/apps/Chat/urls.py`):
  - POST ask/            — ask AI (expects JSON with `message`)
  - POST session/        — create a chat session (authenticated)
  - POST / GET message/<session_id>/ — send or fetch messages
  - GET stream/<session_id>/ — stream AI response for a session (SSE-like)
  - GET history/         — get chat history for authenticated user
  - Note: These paths are namespaced to how they are included in project-level URLConf. Check `config/urls.py` (or project URL conf) for exact prefixes.
- WebSocket for speech (routing):
  - `ws/speech/` — mapped to `SpeechConsumer` in `wispr-backend/apps/speech/routing.py`

How the main features work — short technical overview
- Chat + Gemini streaming
  - User message saved to DB (ChatSession, ChatMessage).
  - `stream_ai_response()` (apps/Chat/streaming.py) configures `google.generativeai` with `GEMINI_API_KEY` and streams response chunks from the Gemini model (`gemini-flash-lite-latest`). The view yields chunks to client and saves assistant message.
- Real-time STT (Deepgram)
  - `deepgram_stream()` (apps/speech/deepgram.py) connects to Deepgram WebSocket (`wss://api.deepgram.com/v1/listen`) using `DEEPGRAM_API_KEY`, sends audio bytes from an internal queue, and receives transcripts which are forwarded into the app.
- TTS (Deepgram)
  - `text_to_speech()` (apps/speech/tts.py) posts text (chunked if long) to Deepgram speak endpoint and concatenates audio bytes returned from each call.

Recommendations / next small improvements
- Remove committed `venv/` and add `venv/` to `.gitignore`.
- Add `requirements.txt` (or `pyproject.toml`) listing dependencies.
- Add `.env.example` with required environment variables and descriptions.
- Add documentation for how Chat endpoints are mounted (project-level URLConf).
- Add tests covering Chat flow, TTS, and Deepgram stream utilities.
- Add CI (GitHub Actions) to run tests and linters.



Need me to add this README.md to the repository?
- I can create the file and open a pull request for you, or push directly if you prefer. Tell me which and provide the repository & branch details if you want me to make the change.
