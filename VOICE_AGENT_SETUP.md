# Wispr Flow Voice Agent - Quick Setup Guide

## What's New

You now have a **complete voice-to-voice assistant**:
- 🎤 **STT:** Deepgram nova-3 converts speech → text (real-time)
- 🤖 **LLM:** GPT-4 or Gemini converts text → intelligent response (streaming)
- 💾 **History:** All conversations saved with auto-generated titles
- 🔄 **Fallback:** Automatic switch to Gemini if OpenAI fails

## Quick Setup (5 minutes)

### 1. Install Python Dependencies
```bash
cd wispr-backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
```bash
# Copy template
cp .env.template .env

# Edit .env with your API keys:
# - DEEPGRAM_API_KEY: https://console.deepgram.com/
# - OPENAI_API_KEY: https://platform.openai.com/api-keys
# - GEMINI_API_KEY: https://makersuite.google.com/app/apikey
# - GOOGLE_CLIENT_ID/SECRET: https://console.cloud.google.com/
```

### 3. Run Database Migrations
```bash
python manage.py migrate
```

### 4. Start Backend
```bash
python manage.py runserver
# Or with Daphne (recommended for production):
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

### 5. Start Frontend (in new terminal)
```bash
cd wispr-flow-clone
npm install  # If first time
npm run dev
```

### 6. Open Browser
```
http://localhost:1420
```

## Testing the Voice Agent

1. **Create Account:** Click "Login" → Use Google OAuth
2. **Start Voice Session:** Click microphone icon
3. **Speak:** Say something like "What is artificial intelligence?"
4. **Watch Magic:** 
   - Your speech transcribed in real-time
   - Assistant response streams back
   - Chat saved automatically with auto-generated title

## API Endpoints

### Create New Chat
```bash
curl -X POST http://localhost:8000/api/chat/session/create/ \
  -H "Authorization: Bearer $TOKEN"
```

### Get Chat History
```bash
curl -X GET http://localhost:8000/api/chat/history/ \
  -H "Authorization: Bearer $TOKEN"
```

### Send Voice Transcript
```bash
curl -X POST http://localhost:8000/api/chat/session/123/transcript/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "What is AI?", "is_final": true}'
```

(Response streams as Server-Sent Events with LLM response chunks)

## Project Structure

```
wispr-backend/
├── apps/
│   ├── Chat/
│   │   ├── models.py              # ChatSession, ChatMessage models
│   │   ├── views.py               # REST API endpoints
│   │   ├── voice_agent.py         # LLM streaming logic
│   │   └── urls.py                # API routes
│   └── speech/
│       ├── deepgram.py            # STT with Deepgram SDK
│       └── consumers.py            # WebSocket consumer
├── config/
│   ├── settings.py                # Django config + API keys
│   ├── asgi.py                    # Django Channels setup
│   └── urls.py                    # URL routing
└── .env                            # API keys (create from .env.template)

wispr-flow-clone/
├── src/
│   ├── App.jsx                    # Main component with voice logic
│   ├── hooks/
│   │   ├── useVoiceWebSocket.js   # STT WebSocket management
│   │   ├── useVoiceAgent.js       # LLM response processing
│   │   └── useVoiceRecorder.js    # Audio capture
│   ├── services/
│   │   ├── voice-agent.service.js # LLM API client
│   │   ├── history.service.js     # Chat history API
│   │   └── auth.service.js        # JWT authentication
│   └── components/
│       ├── chat/ChatWindow.jsx    # Message display
│       └── voice/VoiceButton.jsx  # Record button
└── package.json
```

## Key Features Explained

### Real-time Streaming
**App speaks → Deepgram transcribes live → LLM responds in real-time → Agent speaks back**

Each step happens while you're still speaking. No waiting for silence detection.

### Auto-Summarization
After first exchange, the session title is automatically generated from your first message. No "New Chat" placeholders.

```python
# First message: "What is the capital of France?"
# Auto-generated title: "What is the capital of France?"

# Works for longer messages too:
# "Tell me something interesting about quantum physics"
# Auto-generated title: "Tell me something interesting about..."
```

### Conversation Persistence
Every conversation is stored in the database. You can:
- Resume conversations later
- View full history
- Delete old conversations
- Track all interactions

### Multi-Model Fallback
If OpenAI is down or your API key is invalid:
1. Try GPT-4 (primary)
2. If fails → Switch to Gemini (fallback)
3. If both fail → Show error message to user

```python
try:
    response = await stream_openai_response(transcript)
except:
    response = await stream_gemini_response(transcript)  # Automatic fallback
```

## Common Issues & Fixes

### "No response from LLM"
```bash
# Check API keys are set
echo $OPENAI_API_KEY
echo $GEMINI_API_KEY

# Check logs for errors
tail -f backend.log
```

### "Microphone permission denied"
- Grant microphone permission in browser
- Check browser console for errors

### "Connection refused"
- Backend not running? → `python manage.py runserver`
- Frontend can't reach backend? → Check `BACKEND_URL` in config

### "Chat not saving"
- Not authenticated? → Login with Google
- Database not migrated? → `python manage.py migrate`
- Check Django admin for ChatSession records

## Next Steps

### Deploy to Render (Production)
1. Push code to GitHub
2. Connect to Render
3. Set environment variables in Render dashboard
4. Deploy both frontend and backend

### Enhance Voice Output
Add text-to-speech so assistant speaks responses:
```javascript
// In handleStopVoice callback
const utterance = new SpeechSynthesisUtterance(response);
window.speechSynthesis.speak(utterance);
```

### Add Conversation Settings
Let users choose:
- Response tone (formal, casual, technical)
- LLM model preference
- Context window size
- Language

### Monitor Usage
Track:
- API costs (OpenAI, Gemini, Deepgram)
- Most popular questions
- User engagement time
- Error rates

## Documentation

- Full implementation details: [`VOICE_AGENT_IMPLEMENTATION.md`](VOICE_AGENT_IMPLEMENTATION.md)
- API reference: See REST endpoints in implementation guide
- Frontend hooks: Check `src/hooks/useVoiceAgent.js`
- Backend models: Check `apps/Chat/models.py`

## Support

If something breaks:
1. Check console logs (browser DevTools + terminal)
2. Verify API keys in `.env`
3. Ensure migrations are applied (`python manage.py migrate`)
4. Restart both backend and frontend
5. Check GitHub issues for similar problems

---

**Happy Voice Chatting! 🎤🤖**
