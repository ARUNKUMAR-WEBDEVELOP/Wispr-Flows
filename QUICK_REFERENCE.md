# Voice Agent - Quick Reference

## 🎤 How It Works (User Perspective)

```
1. User clicks microphone 🎤
   ↓
2. Speaks: "What is AI?"
   ↓
3. STT in real-time: "What is AI?"
   ↓
4. LLM responds in real-time: "AI is artificial intelligence..."
   ↓
5. Chat auto-saved with title: "What is AI?"
```

## 🔧 How It Works (Developer Perspective)

### Flow Diagram

```
FRONTEND                          BACKEND                        EXTERNAL
┌──────────────┐                 ┌──────────────┐               ┌──────────┐
│  App.jsx     │                 │  Django      │               │ Deepgram │
│              │─ WebSocket ────▶│ SpeechConsumer              │ (Speech) │
│ Voice Button │                 │              │               │         ├──→ STT
│              │◀─ Transcript ───│ deepgram.py │◀─────────────┤           │
└──────────────┘                 └──────────────┘               │        │
                                        ↓                        └──────────┘
                                 ┌──────────────┐
                                 │ VoiceAgent   │
                                 │              │               ┌──────────┐
                                 │ process_     │               │ OpenAI   │
                                 │ transcript() │─────────────▶│ GPT-4    │
                                 │              │              ├──────────┤
                                 │ save_        │               │ (Primary)│
                                 │ message()    │               │         ├──→ LLM
                                 │              │               │        │
                                 │ stream_*_    │               └──────────┘
                                 │ response()   │
                                 └──────────────┘  Fallback if GPT-4 fails
                                        ↑                └──────────────┐
                                        │                ┌──────────────┐
                                        └────────────────│ Google       │
                                 SSE (Stream)           │ Gemini       │
                                                        │ (Fallback)  │
                                                        └──────────────┘

Database: SQLite (local) or PostgreSQL (production)
- ChatSession (title, user, created_at)
- ChatMessage (role, content, timestamp)
```

## 📝 Code Reference

### Frontend: Use Voice Agent

```jsx
import { useVoiceAgent } from "./hooks/useVoiceAgent";

const { processVoiceTranscript } = useVoiceAgent();

// When user stops speaking:
await processVoiceTranscript(
  sessionId,
  transcript,
  (chunk) => {
    /* Display chunk */
  },
  (complete) => {
    /* Done */
  },
  (error) => {
    /* Handle error */
  },
);
```

### Backend: VoiceAgent Class

```python
from apps.Chat.voice_agent import VoiceAgent

agent = VoiceAgent(request.user, session_id)
await agent.load_session()
await agent.process_transcript(transcript, send_response)
```

### Database Models

```python
class ChatSession:
    user = ForeignKey(User)
    title = CharField()
    created_at = DateTimeField()

class ChatMessage:
    session = ForeignKey(ChatSession)
    role = CharField("user" or "assistant")
    content = TextField()
    created_at = DateTimeField()
```

## 🔑 API Endpoints

| Endpoint                             | Method | Purpose          | Auth |
| ------------------------------------ | ------ | ---------------- | ---- |
| `/api/chat/session/create/`          | POST   | New chat         | JWT  |
| `/api/chat/history/`                 | GET    | All sessions     | JWT  |
| `/api/chat/session/{id}/messages/`   | GET    | Session messages | JWT  |
| `/api/chat/session/{id}/transcript/` | POST   | Voice→LLM        | JWT  |
| `/api/chat/session/{id}/delete/`     | DELETE | Delete chat      | JWT  |

## ⚙️ Environment Variables

```bash
# Speech-to-Text
DEEPGRAM_API_KEY=...

# Large Language Models
OPENAI_API_KEY=...
GEMINI_API_KEY=...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## 🚀 Local Setup

```bash
# 1. Backend
cd wispr-backend
python manage.py migrate
python manage.py runserver

# 2. Frontend (new terminal)
cd wispr-flow-clone
npm run dev

# 3. Open: http://localhost:1420
```

## 📊 Key Files

| File                                  | Purpose                         |
| ------------------------------------- | ------------------------------- |
| `apps/Chat/voice_agent.py`            | LLM streaming logic             |
| `apps/Chat/views.py`                  | REST API endpoints              |
| `src/App.jsx`                         | Voice capture + LLM integration |
| `src/hooks/useVoiceAgent.js`          | React hook for LLM              |
| `src/services/voice-agent.service.js` | API client                      |
| `apps/Chat/models.py`                 | Database models                 |

## 🎯 Implementation Checklist

✅ Backend LLM streaming  
✅ Frontend voice capture  
✅ Real-time display  
✅ Database persistence  
✅ Auto-title generation  
✅ Multi-model fallback  
✅ User authentication  
✅ Error handling  
✅ Documentation

## 🐛 Debugging

### Check Backend

```bash
# Verify migrations
python manage.py migrate --check

# Test API endpoint
curl -X POST http://localhost:8000/api/chat/session/create/ \
  -H "Authorization: Bearer $TOKEN"

# View logs
tail -f backend.log
```

### Check Frontend

```bash
# Browser Console (F12)
- Check for WebSocket errors
- Check network requests
- Check VoiceAgent hook logs

# Check services
console.log('Session:', activeSession)
console.log('Messages:', messages)
```

### Check Database

```bash
# Django shell
python manage.py shell
from apps.Chat.models import ChatSession
ChatSession.objects.filter(user=user).count()
```

## 📈 Performance Tips

1. **Limit context window** - Use last 4 messages in LLM
2. **Stream responses** - Display chunks, don't wait
3. **Index database** - (session, created_at) indexed
4. **Cache titles** - Generated after first exchange
5. **Async operations** - Non-blocking with asyncio

## 🔐 Security Notes

- All endpoints require JWT authentication
- User-session isolation enforced
- API keys in environment variables
- Input validation before sending to LLM
- Rate limiting recommended for production

## 🚢 Production Checklist

- [ ] API keys configured in Render
- [ ] Database backups enabled
- [ ] HTTPS certificates configured
- [ ] Error logging setup (Sentry)
- [ ] Rate limiting added
- [ ] Performance monitoring enabled
- [ ] Cost alerts configured (OpenAI)
- [ ] Load testing completed

## 📚 Full Documentation

- **Detailed:** `VOICE_AGENT_IMPLEMENTATION.md`
- **Quick Start:** `VOICE_AGENT_SETUP.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`

## 💡 Tips

1. **Test locally first** before deploying
2. **Monitor API costs** - OpenAI can be expensive
3. **Set rate limits** - Prevent runaway charges
4. **Use Gemini as default** - Cheaper than OpenAI
5. **Cache frequently asked questions** - Reduce API calls

---

**Status: Production Ready ✅**

Questions? Check the full documentation files!
