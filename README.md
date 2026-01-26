# Wispr-Flows

Short overview
- Wispr‑Flows is a full‑stack conversational and speech workflows project.
- Backend: Django + Django REST Framework + Django Channels (ASGI) implementing chat sessions, streaming AI responses, real‑time speech‑to‑text (STT) and text‑to‑speech (TTS).
- Frontend: React client (wispr‑flow‑clone) that provides the chat UI, voice recording, live transcript, and streaming display of AI responses.

Goals
- Provide users with authenticated chat sessions and persistent chat history.
- Stream AI responses incrementally to the UI for a real‑time experience.
- Support live voice input (stream audio from client to backend/Deepgram) and TTS playback.
- Integrate Google Sign‑in and JWT for authentication.

Repository layout (important paths)
- wispr-backend/
  - manage.py — Django CLI entrypoint
  - config/
    - settings.py — Django settings and installed apps (rest_framework, channels, corsheaders)
    - urls.py — routes: /api/auth/, /api/chat/, /api/speech/
    - asgi.py — ASGI/Channels application (used for WebSocket routing)
  - apps/
    - Chat/
      - models.py — ChatSession, ChatMessage
      - views.py — CreateChatSessionView, SendMessageView, StreamAIResponseView, ask_ai, ChatHistoryView
      - urls.py — ask/, session/, message/<id>/, stream/<id>/, history/
      - streaming.py — connectors to AI streaming (Google Gemini referenced)
      - migrations/ — DB schema
    - speech/
      - urls.py — tts/ and transcribe/ REST endpoints
      - routing.py — websocket_urlpatterns (ws/speech/)
      - deepgram.py — Deepgram STT helper (websocket STT)
      - tts.py — Deepgram TTS helper
      - consumers.py — (SpeechConsumer) handles incoming audio frames via WebSocket
    - account/, core/ — auth utilities: Google ID token verification and JWT creation
  - venv/ — committed virtual environment (recommend removal)
- wispr-flow-clone/
  - src/App.jsx — main React app: UI, voice controls, streaming handling
  - other React components for ChatWindow, VoiceButton, etc.

Implemented features (what's present and working)
- Chat sessions and persistent messages persisted in the DB.
- REST endpoints to create sessions, send messages, fetch messages, fetch chat history.
- Streaming AI responses via Server‑Sent Events (text/event-stream) so frontend receives incremental text chunks.
- ask_ai endpoint for synchronous AI responses (aggregated).
- Real‑time STT using Deepgram WebSocket integration (SpeechConsumer <-> Deepgram).
- Text‑to‑Speech via Deepgram TTS helper (returns audio or plays audio in frontend).
- Google Sign‑in verification and JWT token generation for authentication.
- WebSocket route for live audio: ws/speech/.
- Django Admin enabled for model management.

Quick architecture / data flows

1) Text chat (authenticated)
- Frontend creates a ChatSession (POST /api/chat/session/).
- User sends message (POST /api/chat/message/<session_id>/) — message stored in DB.
- Frontend requests streaming response (GET /api/chat/stream/<session_id>/) which returns SSE chunks produced by stream_ai_response (AI streaming connector). As chunks stream to the client, the UI appends them live. When finished, assistant reply is saved server‑side.

2) Voice input -> live transcript -> send message
- Frontend records audio and sends audio frames via WebSocket to ws/speech/.
- SpeechConsumer forwards audio frames to Deepgram STT; Deepgram returns partial & final transcripts.
- SpeechConsumer forwards transcripts back to the frontend for live display.
- When recording stops, user sends the transcript as a normal chat message and the chat flow continues.

3) Text-to-Speech
- Frontend posts text to /api/speech/tts/ — server calls Deepgram TTS and returns playable audio or an audio URL.

Authentication
- Google Sign‑in on frontend posts ID token to backend auth endpoint.
- core/auth_utils.py verifies the token, ensures user exists, and issues JWT for API calls.
- Protected API views use DRF's IsAuthenticated permission.

Environment variables (required / recommended)
- SECRET_KEY — Django secret key (do not commit)
- DEBUG — True/False
- DATABASE_URL / DB configuration — or use default sqlite for dev
- DEEPGRAM_API_KEY — Deepgram API key for STT/TTS
- GOOGLE_CLIENT_ID — used to verify Google ID tokens
- REDIS_URL — channel layer and production Channels layer (if using channels_redis)
- DJANGO_ALLOWED_HOSTS — comma separated allowed hosts

Local setup (development)

Prerequisites
- Python 3.10+ (or matching your project's supported version)
- Node.js 16+ and npm/yarn (for frontend)
- Redis (optional, for production Channels channel layer)

Steps

1. Clone the repo
   git clone https://github.com/ARUNKUMAR-WEBDEVELOP/Wispr-Flows.git
   cd Wispr-Flows/wispr-backend

2. Remove committed venv (strongly recommended)
   git rm -r --cached wispr-backend/venv
   echo "wispr-backend/venv/" >> .gitignore
   git commit -m "Remove committed venv and add to .gitignore"

3. Create and activate a virtual environment
   python3 -m venv .venv
   source .venv/bin/activate   # macOS/Linux
   .venv\Scripts\activate      # Windows

4. Install dependencies
   - If you have a requirements.txt:
     pip install -r requirements.txt
   - If not, install the likely dependencies:
     pip install django djangorestframework channels python-dotenv deepgram-sdk djangorestframework-simplejwt corsheaders

   After installing, run:
     pip freeze > requirements.txt

5. Provide environment variables
   - Create wispr-backend/.env (use a .env.example for reference) and set:
     SECRET_KEY=change-me
     DEBUG=True
     DEEPGRAM_API_KEY=your_key
     GOOGLE_CLIENT_ID=your_client_id
     REDIS_URL=redis://localhost:6379/0
     DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

6. Apply database migrations
   python manage.py migrate

7. Create superuser
   python manage.py createsuperuser

8. Run development server
   python manage.py runserver

Frontend (React) setup
1. cd ../wispr-flow-clone
2. npm install
3. npm start
- Dev server typically runs at http://localhost:3000 and calls backend at http://127.0.0.1:8000 (configure proxy or CORS as needed).

API quick reference & examples

- Create chat session (authenticated)
  POST /api/chat/session/
  Headers: Authorization: Bearer <JWT>
  Response: { "session_id": <id> }

- Send message (save user message)
  POST /api/chat/message/<session_id>/
  Headers: Authorization: Bearer <JWT>
  Body JSON: { "message": "Hello" }

- Get messages for a session
  GET /api/chat/message/<session_id>/
  Headers: Authorization: Bearer <JWT>

- Ask AI (synchronous)
  POST /api/chat/ask/
  Headers: Authorization: Bearer <JWT>
  Body JSON: { "message": "What's the weather?" }
  Response: { "text": "..." }

  Example curl:
  curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
    -d '{"message":"Hello"}' http://127.0.0.1:8000/api/chat/ask/

- Stream AI response (Server‑Sent Events)
  GET /api/chat/stream/<session_id>/
  Headers: Authorization: Bearer <JWT>
  The response is text/event-stream; use EventSource in browser or curl -N to see streaming data.

  Example:
  curl -N -H "Authorization: Bearer <token>" http://127.0.0.1:8000/api/chat/stream/1/

- Chat history
  GET /api/chat/history/
  Headers: Authorization: Bearer <JWT>

- TTS
  POST /api/speech/tts/
  Headers: Authorization: Bearer <token>
  Body JSON: { "text": "Hello world" }

- STT (transcribe, non‑WebSocket)
  POST /api/speech/transcribe/
  Multipart/form-data with audio file, or send audio data as required by the view.

WebSocket (live STT)
- ws://<host>/ws/speech/ — connect with a WebSocket client (frontend) and send audio frames (binary or base64 depending on consumer implementation). SpeechConsumer will forward to Deepgram and send transcript messages back to client.

Production / Deployment notes
- Use a proper ASGI server (daphne or uvicorn) with Channels and a production channel layer (Redis).
- Do not use Django's runserver for production.
- Configure allowed hosts, DEBUG=False, proper SECRET_KEY management, HTTPS (TLS), and CORS as needed.
- Use a cloud object store or static host for static/media files and run collectstatic.
- Consider adding Gunicorn + Daphne or Uvicorn with process manager for serving backend.


Recommended dependencies (example)
- django
- djangorestframework
- channels
- channels-redis
- python-dotenv
- deepgram-sdk (or custom websocket client code)
- djangorestframework-simplejwt
- corsheaders

Contributing
- Fork the repo → create feature branch → implement changes → add tests → open pull request.
- Keep commits small and focused; include migration files when models change.
- Provide API docs or example requests for new endpoints.

Troubleshooting
- "ModuleNotFoundError: deepgram": ensure you installed dependencies and removed old committed venv.
- WebSocket not connecting: check ASGI configuration and channel layer backend (Redis).
- Streaming page shows nothing: confirm you are using EventSource/Accept header or curl -N to test SSE.

Contact / Maintainer
- Owner: ARUNKUMAR-WEBDEVELOP
- For help or feature requests, open an issue in the repository.

