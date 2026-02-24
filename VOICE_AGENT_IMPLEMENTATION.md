# Voice Agent Implementation Guide

## Overview

This document describes the complete voice agent system for Wispr Flow - a real-time voice-to-text-to-LLM pipeline with conversation persistence and auto-summarization.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  App.jsx (Main Component)                                       │
│  ├─ useVoiceWebSocket: STT streaming                           │
│  ├─ useVoiceAgent: LLM response processing                     │
│  └─ Voice Button → handleStartVoice → handleStopVoice         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
           ┌────────────┴──────────────┐
           │ WebSocket (STT)            │ REST API (LLM Response)
           │ wss://api/speech/stream    │ POST /api/chat/session/{id}/transcript/
           ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend (Django)                             │
├─────────────────────────────────────────────────────────────────┤
│  Speech Consumer (WebSocket Consumer)                           │
│  ├─ connect() → Deepgram Stream                               │
│  ├─ receive() → Audio chunks → Deepgram                       │
│  └─ send_transcript() → Frontend                              │
│                                                                 │
│  Chat Views (REST API)                                         │
│  ├─ create_chat_session() → New session in DB                │
│  ├─ get_chat_history() → All user sessions                   │
│  ├─ process_voice_transcript() → LLM response streaming      │
│  └─ delete_session() → Remove session                        │
│                                                                 │
│  Voice Agent (LLM Integration)                                │
│  ├─ load_session() → Load conversation history               │
│  ├─ process_transcript() → Send to LLM                       │
│  ├─ stream_openai_response() → GPT-4 streaming              │
│  ├─ stream_gemini_response() → Gemini fallback              │
│  ├─ save_message() → Store in DB                            │
│  └─ generate_and_save_title() → Auto-summarization          │
│                                                                 │
│  Models (Django ORM)                                          │
│  ├─ ChatSession: User conversations                          │
│  └─ ChatMessage (Message alias): Individual messages         │
│                                                                 │
│  Deepgram SDK Integration                                     │
│  └─ Live STT with nova-3 model                               │
└─────────────────────────────────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                              ▼
    Deepgram API               OpenAI API / Gemini API
    (Speech-to-Text)           (LLM Response Gen)
```

## Features

### 1. **Real-time STT (Speech-to-Text)**

- Browser captures 48kHz audio from microphone
- Downsamples to 16kHz 16-bit PCM
- Sends via WebSocket to Django Channels backend
- Deepgram SDK processes via nova-3 model
- Transcripts accumulate across long speech sessions
- Interim results show live typing effect

**Key Files:**

- `src/hooks/useVoiceWebSocket.js` - WebSocket management
- `apps/speech/consumers.py` - Django Channels consumer
- `apps/speech/deepgram.py` - Deepgram SDK integration

### 2. **Real-time LLM Response Streaming**

- Transcripts sent to `/api/chat/session/{id}/transcript/` endpoint
- Backend processes with primary LLM (OpenAI GPT-4)
- Automatic fallback to Gemini if OpenAI fails
- Response streamed back as SSE (Server-Sent Events)
- Frontend displays chunks in real-time as assistant types

**Key Files:**

- `apps/Chat/voice_agent.py` - LLM streaming logic
- `apps/Chat/views.py` - REST API endpoints
- `src/services/voice-agent.service.js` - Frontend client
- `src/hooks/useVoiceAgent.js` - Chat integration hook

### 3. **Conversation History Persistence**

- User sessions stored in Django database
- Each session has title, creation date, and messages
- Messages linked to users via JWT authentication
- Full conversation history retrievable at `/api/chat/history/`
- Sessions support resumption and deletion

**Key Files:**

- `apps/Chat/models.py` - ChatSession & ChatMessage models
- `apps/Chat/urls.py` - API endpoints
- `src/services/history.service.js` - History retrieval

### 4. **Auto-Summarization**

- After first user-assistant exchange, session title auto-generated
- Title created from first 5 words of user's message
- Prevents "New Conversation" placeholder in history
- Updates database automatically

### 5. **Multi-Model Support**

- **Primary:** OpenAI GPT-4-turbo-preview (gpt-5.2 when available)
- **Fallback:** Google Gemini Pro
- Automatic failover if primary model fails or API key missing
- Both models configured via environment variables

## Frontend Integration

### Setup Voice Agent in App.jsx

```jsx
import { useVoiceAgent } from "./hooks/useVoiceAgent";

export default function App() {
  const { processVoiceTranscript } = useVoiceAgent();

  const handleStopVoice = async () => {
    // ... stop recording ...

    if (authenticated && activeSession) {
      setAiStreaming(true);

      // Add user message
      setMessages((prev) => [...prev, { role: "user", content: combined }]);

      let assistantMessage = "";

      // Stream response from LLM
      await processVoiceTranscript(
        activeSession,
        combined,
        (chunk, isFinal) => {
          // Update UI in real-time
          assistantMessage += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg?.role === "assistant") {
              lastMsg.content = assistantMessage;
            }
            return updated;
          });
        },
        (fullResponse) => {
          // Complete
          setAiStreaming(false);
        },
        (error) => {
          // Handle error
          setAiStreaming(false);
        },
      );
    }
  };
}
```

## Backend Integration

### VoiceAgent Class Usage

```python
from apps.Chat.voice_agent import VoiceAgent

# Initialize agent for user
agent = VoiceAgent(request.user, session_id)

# Load existing conversation history
await agent.load_session()

# Process transcript and stream response
async def send_response(chunk_data):
    # Send to frontend via SSE
    pass

await agent.process_transcript(
    transcript="What's the weather today?",
    send_response=send_response
)
```

### API Endpoints

#### 1. Create Chat Session

```
POST /api/chat/session/create/
Authorization: Bearer {token}
{}

Response:
{
  "session_id": 123,
  "created_at": "2024-01-15T10:30:00Z"
}
```

#### 2. Get Chat History

```
GET /api/chat/history/
Authorization: Bearer {token}

Response:
{
  "sessions": [
    {
      "session_id": 123,
      "title": "What's the weather...",
      "created_at": "2024-01-15T10:30:00Z",
      "message_count": 4,
      "messages": [
        {"role": "user", "content": "...", "created_at": "..."},
        {"role": "assistant", "content": "...", "created_at": "..."}
      ]
    }
  ]
}
```

#### 3. Process Voice Transcript (Streaming)

```
POST /api/chat/session/{session_id}/transcript/
Authorization: Bearer {token}
Content-Type: application/json

{
  "transcript": "What is machine learning?",
  "is_final": true
}

Response (Server-Sent Events):
data: {"type": "llm_chunk", "text": "Machine", "is_final": false}
data: {"type": "llm_chunk", "text": " learning", "is_final": false}
data: {"type": "llm_chunk", "text": " is...", "is_final": false}
data: {"type": "llm_chunk", "text": "", "is_final": true}
```

#### 4. Get Session Messages

```
GET /api/chat/session/{session_id}/messages/
Authorization: Bearer {token}

Response:
{
  "session_id": 123,
  "title": "What's the weather...",
  "created_at": "2024-01-15T10:30:00Z",
  "messages": [...]
}
```

#### 5. Delete Session

```
DELETE /api/chat/session/{session_id}/delete/
Authorization: Bearer {token}

Response:
{
  "status": "deleted"
}
```

## Environment Configuration

Add to `.env`:

```bash
# STT
DEEPGRAM_API_KEY=your_deepgram_key

# LLM - OpenAI
OPENAI_API_KEY=your_openai_key

# LLM - Google Gemini
GEMINI_API_KEY=your_gemini_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Dependencies

### Backend Requirements

```
Django==5.2.4
djangorestframework==3.16.0
channels==4.3.2
daphne==4.2.1
deepgram-sdk==3.5.0
openai==1.3.6
google-generativeai==0.8.6
asgiref==3.10.0
```

### Frontend Dependencies

```json
{
  "axios": "latest",
  "framer-motion": "latest",
  "react": "^18.0.0",
  "react-dom": "^18.0.0"
}
```

## Database Schema

### ChatSession

- `id` - Primary key
- `user` - ForeignKey to User
- `title` - Conversation title (auto-generated after first exchange)
- `created_at` - Timestamp

### ChatMessage

- `id` - Primary key
- `session` - ForeignKey to ChatSession
- `role` - "user" or "assistant"
- `content` - Message text
- `created_at` - Timestamp

**Index:** `(session, created_at)` for efficient history retrieval

## Deployment Notes

### Testing Locally

```bash
# Terminal 1: Backend
cd wispr-backend
python manage.py runserver

# Terminal 2: Frontend Dev Server
cd wispr-flow-clone
npm run dev

# Visit: http://localhost:1420
```

### Production (Render)

- Backend: `https://wispr-flows-3adt.onrender.com`
- Frontend: Built as static site on Render
- ASGI Server: Daphne via `daphne -b 0.0.0.0 config.asgi:application`
- Environment variables configured in Render dashboard

## Features Not Yet Implemented

1. **Voice Output (TTS)**
   - Could add text-to-speech for assistant responses
   - Use Deepgram TTS or browser Web Speech API

2. **Conversation Branching**
   - Save multiple response options for user prompts
   - Choose alternative paths in conversation

3. **Custom Instructions**
   - System prompts per session
   - Role-playing agents (therapist, tutor, etc.)

4. **Export Conversations**
   - PDF/markdown export of full sessions
   - Share conversation transcripts

5. **Advanced Analytics**
   - Session duration, word count, sentiment
   - User engagement metrics

## Troubleshooting

### No LLM Response

Check:

1. `OPENAI_API_KEY` and `GEMINI_API_KEY` set in `.env`
2. Backend logs for LLM errors
3. Session ID exists for user
4. Network connectivity to OpenAI/Gemini APIs

### Transcript Not Saving

Check:

1. User authenticated (JWT token valid)
2. Session exists in database
3. Database migrations applied (`python manage.py migrate`)
4. Message model indexed properly

### STT Not Working

Check:

1. Browser microphone permissions granted
2. Deepgram WebSocket connected in browser console
3. Audio format 16kHz 16-bit PCM
4. `DEEPGRAM_API_KEY` configured

## Security Considerations

1. **Authentication:** All voice agent endpoints require JWT token
2. **Session Isolation:** Users can only access their own sessions
3. **API Keys:** Never commit to git; use environment variables
4. **Rate Limiting:** Consider adding per-user request limits for LLM calls
5. **Input Validation:** Transcripts validated before sending to LLM

## Performance Optimization

1. **Streaming:** Real-time display prevents waiting for full response
2. **Database Indexing:** Index on (session, created_at) for fast retrieval
3. **Conversation Pruning:** Limit context window to last 4 messages for LLM
4. **Caching:** Could cache frequent session titles/summaries

---

**Created:** 2024-01-15  
**Version:** 1.0.0  
**Status:** Fully Implemented
