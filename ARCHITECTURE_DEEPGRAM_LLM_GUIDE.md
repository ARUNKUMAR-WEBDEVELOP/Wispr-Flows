# Complete Architecture Guide: Deepgram, LLM Models & Voice Agents

## Table of Contents

1. [System Architecture Overview](#system-architecture)
2. [How Deepgram SDK Works](#deepgram-sdk)
3. [LLM Model Training & Fine-tuning](#llm-models)
4. [Prompt Engineering Strategies](#prompt-engineering)
5. [Storage Architecture (localStorage + Database)](#storage)
6. [Voice Agent Unlimited Chats Strategy](#unlimited-chats)
7. [Development Roadmap](#roadmap)

---

## System Architecture Overview

Your Wispr Flow app has **4 main components**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE (React)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ Voice Input │  │ Chat Window  │  │ Voice Agent      │       │
│  │ (Microphone)│  │ (Messages)   │  │ (Settings Panel) │       │
│  └──────┬──────┘  └──────────────┘  └──────────────────┘       │
│         │                                      │                 │
└─────────┼──────────────────────────────────────┼────────────────┘
          │                                      │
          │ Audio Stream (PCM 16kHz)             │ Text Messages
          │                                      │
┌─────────▼───────────────────────────────────────▼────────────────┐
│                    FRONTEND SERVICES (JavaScript)                 │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Voice Recorder   │  │ Chat Service │  │ Auth Service │       │
│  │ (Web Audio API)  │  │ (API calls)  │  │ (Google)     │       │
│  └────────┬─────────┘  └──────┬───────┘  └──────────────┘       │
│           │                    │                                  │
└───────────┼────────────────────┼──────────────────────────────────┘
            │                    │
            │ WebSocket          │ HTTP REST
            │ (Real-time)        │ (JSON)
            │                    │
┌───────────▼────────────────────▼──────────────────────────────────┐
│              BACKEND API (Django + Django Channels)               │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Speech Consumer  │  │ Chat Views   │  │ Auth Views   │       │
│  │ (WebSocket)      │  │ (REST API)   │  │ (OAuth)      │       │
│  └────────┬─────────┘  └──────┬───────┘  └──────────────┘       │
│           │                    │                                  │
└───────────┼────────────────────┼──────────────────────────────────┘
            │                    │
            │                    │ ORM
            │ Deepgram API       │ (SQL)
            │ (WebSocket)        │
            │                    │
┌───────────▼─┐    ┌─────────────▼──────────┐   ┌──────────────┐
│  Deepgram   │    │   Database             │   │ Google Gemini│
│  (Speech)   │    │   (PostgreSQL/SQLite)  │   │   (LLM)      │
└─────────────┘    └────────────────────────┘   └──────────────┘
```

### Data Flow: User Asks Voice Question

```
1. User says: "What's the weather?"
   ↓
2. Microphone records audio (48kHz)
   ↓
3. Frontend downsamples to 16kHz PCM
   ↓
4. WebSocket sends to Django backend
   ↓
5. Django forwards to Deepgram API (WebSocket)
   ↓
6. Deepgram returns: "what's the weather" (real-time)
   ↓
7. Frontend displays interim transcript
   ↓
8. Deepgram sends final: "What's the weather?"
   ↓
9. Frontend sends to AI backend: "What's the weather?"
   ↓
10. Backend calls Google Gemini API with prompt:
    "You are a helpful assistant. User asked: What's the weather?"
   ↓
11. Gemini returns: "I don't have real-time weather data, but..."
   ↓
12. Message saved to database
    - Logged in users: Saved in PostgreSQL
    - Guest users: Saved in localStorage
   ↓
13. Frontend converts response to speech (TTS)
   ↓
14. User hears: AI response played back

```

---

## Deepgram SDK - How It Works

### What Deepgram Does

Deepgram is a **Speech-to-Text (STT)** service that converts audio to text in real-time.

### Current Implementation

**Frontend (React):** `useVoiceWebSocket.js`

```javascript
// 1. USER SAYS SOMETHING
const stream = await navigator.mediaDevices.getUserMedia({
  audio: { echoCancellation: true, noiseSuppression: true },
});

// 2. CONVERT TO 16kHz PCM (Deepgram standard)
const audioContext = new AudioContext(); // Native rate (48kHz)
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (event) => {
  const inputData = event.inputBuffer.getChannelData(0); // 48kHz
  const downsampled = downsample(inputData, 48000, 16000); // → 16kHz
  const pcm16 = convertToPCM16(downsampled); // → 16-bit

  // 3. SEND TO BACKEND VIA WEBSOCKET
  ws.send(pcm16.buffer);
};

// 4. LISTEN FOR TRANSCRIPTS
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.text = "what's the weather"
  // data.is_final = false (interim) or true (final)
  onTranscript(data);
};
```

**Backend (Django):** `apps/Chat/consumers.py`

```python
import aiohttp

class SpeechConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

        # Connect to Deepgram with model selection
        self.deepgram_url = (
            "wss://api.deepgram.com/v1/listen?"
            "model=nova-2-phonecall"  # ← Best for voice
            "&encoding=linear16"      # PCM 16-bit
            "&sample_rate=16000"      # 16kHz
            "&punctuate=true"         # Add punctuation
            "&diarize=true"          # Speaker detection
            "&smart_format=true"      # Format numbers
            "&language=en"            # English
        )

        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
        self.dgm_ws = await aiohttp.ClientSession().ws_connect(
            self.deepgram_url, headers=headers
        )

    async def receive(self, bytes_data):
        # Receive 16kHz PCM bytes from frontend
        await self.dgm_ws.send_bytes(bytes_data)

    async def listen_deepgram(self):
        # Listen for Deepgram transcripts
        async for msg in self.dgm_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                transcript_data = json.loads(msg.data)

                # Extract transcript
                transcript = transcript_data['channel']['alternatives'][0]['transcript']
                is_final = transcript_data['is_final']
                confidence = transcript_data['channel']['alternatives'][0]['confidence']

                # Send back to frontend
                await self.send(json.dumps({
                    "type": "transcript",
                    "text": transcript,
                    "is_final": is_final,
                    "confidence": confidence
                }))
```

### Deepgram Models Comparison

| Model                  | Best For         | Accuracy | Latency   | Cost     |
| ---------------------- | ---------------- | -------- | --------- | -------- |
| `nova-2`               | General          | 95%      | 200ms     | Base     |
| `nova-2-general`       | Conversation     | 95%      | 100ms     | Base     |
| **`nova-2-phonecall`** | **Voice agents** | **98%**  | **200ms** | **Base** |
| `nova-2-meeting`       | Multi-speaker    | 99%      | 300ms     | Higher   |
| `nova-2-medical`       | Medical terms    | 99.5%    | 250ms     | Premium  |
| `nova-2-finance`       | Finance domain   | 98.5%    | 220ms     | Standard |

### Enabling Advanced Deepgram Features

```python
# Current implementation
deepgram_url = (
    "wss://api.deepgram.com/v1/listen?"
    "model=nova-2-phonecall"
    "&encoding=linear16"
    "&sample_rate=16000"
    "&punctuate=true"
    "&smart_format=true"
    "&diarize=true"
    "&language=en"
)

# To add more features:
deepgram_url += (
    "&numerals=true"           # "23" not "twenty three"
    "&profanity_filter=true"   # Remove bad words
    "&paragraphs=true"         # Group into paragraphs
    "&entities=true"           # Extract: emails, phones, URLs
    "&sentiment=true"          # Detect emotion
    "&search=term1,term2"      # Custom vocabulary
    "&alternative_languages=es,fr"  # Multiple languages
)
```

---

## LLM Models - Training & Fine-tuning

### Your Current Setup: Google Gemini API

**File**: `apps/Chat/streaming.py`

```python
import google.generativeai as genai

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-flash-lite-latest")

# No fine-tuning needed - works out of the box
response = model.generate_content(user_prompt, stream=True)
for chunk in response:
    yield chunk.text
```

### How LLMs Work (Brief)

1. **Pre-trained**: Gemini trained on billions of tokens
2. **Context**: You provide system prompt + user message
3. **Prediction**: Model predicts next token (word)
4. **Streaming**: Returns text as it's generated

### Current Pre-trained Models Available

```
Google   | Free Tier        | Capabilities
---------|------------------|----------------------------------
Gemini   | gemini-flash     | Fast, cheap, summarization
         | gemini-pro       | More powerful, less fast
         | gemini-ultra     | Most powerful (limited access)

OpenAI   | GPT-4o mini      | Fast vision + text
         | GPT-4o           | Most capable, expensive
         | GPT-4            | Very capable

Anthropic| Claude 3 Haiku   | Fast and accurate
         | Claude 3 Sonnet  | Balanced
         | Claude 3 Opus    | Most capable

Meta     | Llama 3.1 8B     | Open source, free
         | Llama 3.1 70B    | Larger, more capable
```

### When to Fine-tune (Train Custom Model)

**Fine-tuning is needed when:**

1. You want specific behavior (e.g., "respond like a pirate")
2. You have domain-specific knowledge (medical, legal, finance)
3. You want to reduce tokens/costs
4. You need specific output format

**Fine-tuning example:**

```python
# You would create training data like:
training_data = [
    {
        "prompt": "What is the capital of France?",
        "completion": "The capital of France is Paris."
    },
    {
        "prompt": "What is the capital of Japan?",
        "completion": "The capital of Japan is Tokyo."
    },
    # ... 1000s more examples
]

# Then fine-tune model:
tuned_model = model.fine_tune(training_data, epochs=3)
```

### Your Assistant's System Prompt

**File**: `apps/Chat/voice_agent.py`

```python
VOICE_AGENT_SYSTEM_PROMPT = """You are a general-purpose virtual assistant...
- Be warm, friendly, and professional.
- Keep responses to 1-2 sentences and under 120 characters.
- Do not use markdown formatting.
- Speak in a conversational tone—responses will be spoken aloud.
- ...more guidelines...
"""

# Usage:
def get_voice_agent_response(user_message):
    response = gemini_model.generate_content(
        VOICE_AGENT_SYSTEM_PROMPT + "\n\nUser: " + user_message
    )
    return response
```

---

## Prompt Engineering Strategies

Prompt engineering is the art of writing instructions for LLMs.

### Good Prompts vs Bad Prompts

**❌ BAD:**

```
"What's the weather?"
```

_Problem: LLM doesn't know your location, current date, real-time data_

**✅ GOOD:**

```
"You are a helpful weather assistant.
The current date is February 26, 2026.
User location: Seattle Washington.
User question: What's the weather?
Provide forecast for next 3 days."
```

_Better: Provides context, but LLM still can't access real-time data_

**🔥 EXCELLENT:**

```
"You are a helpful voice assistant that helps users understand
their home automation systems.

Current context:
- Temperature sensor in living room: 72°F
- Humidity: 45%
- Weather API says: Partly cloudy, 68°F
- User's timezone: PST (UTC-8)

Respond concisely (1-2 sentences) in a friendly tone,
as this will be spoken aloud. No markdown.

User question: Is it cold outside right now?"
```

_Perfect: Includes context, constraints, tone, format_

### Prompt Template for Voice Agents

```javascript
// Good prompt structure for voice
function buildPrompt(userMessage, context = {}) {
  return `You are a helpful voice assistant for Wispr Flow.

Guidelines:
- Be concise (max 2 sentences)
- Use simple, natural language
- This will be spoken aloud
- No markdown, code, or special formatting
- If unsure, ask clarifying questions

Context:
- User name: ${context.userName || "Guest"}
- Time: ${new Date().toLocaleTimeString()}
- Timezone: ${context.timezone || "UTC"}
- Previous requests: ${context.history?.length || 0}

User request: "${userMessage}"

Your response:`;
}

// Usage:
const finalPrompt = buildPrompt("What time is it?", {
  userName: "John",
  timezone: "PST",
});

const response = await sendToClaude(finalPrompt);
// Returns: "It's currently 3:45 PM Pacific Time."
```

### Advanced Prompt Techniques

**1. Chain-of-Thought (Make it explain)**

```
"Think step by step:
1. What does the user actually need?
2. What information do I have?
3. What's the best answer?

Then provide your response."
```

**2. Role-playing**

```
"You are a friendly tech support agent with 10 years experience.
How would you help someone troubleshoot their internet connection?"
```

**3. Few-shot Examples**

```
"Examples of good responses:
Q: 'What time is it?'
A: 'It's 3 PM.'

Q: 'How's the weather?'
A: 'It's sunny with a high of 75 degrees.'

Now, answer this:
Q: 'What's my calendar look like today?'
A:"
```

**4. Constraints**

```
"Keep your response under 50 words.
Use active voice.
Use simple words (avoid technical jargon).
Be encouraging.

User question: How do I get started with programming?"
```

---

## Storage Architecture

### Current Implementation

Your app stores messages in **3 places**:

```
┌──────────────────────────────────┐
│   Frontend (React Component)     │
│   const [messages, setMessages]  │ ← In-memory state
└──────────────┬───────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
  ┌──────────┐  ┌──────────┐
  │localStorage  │ Database │
  │ (Browser)│  │(Backend) │
  └──────────┘  └──────────┘
```

### Storage by User Type

**GUEST USERS:**

```javascript
// Only localStorage
localStorage.setItem("guestChat", JSON.stringify(messages));

// On refresh → loads from localStorage
const stored = JSON.parse(localStorage.getItem("guestChat"));
```

**AUTHENTICATED USERS:**

```javascript
// Both localStorage (cache) AND database (persistent)

// Save to database
await saveMessage(sessionId, content, role);

// Also cache locally (optional)
localStorage.setItem("lastMessages", JSON.stringify(messages));

// On refresh → loads from database
const messages = await fetchSessionMessages(sessionId);
```

### API Calls Structure

**File**: `services/history.service.js`

```javascript
// Save messages
export async function saveMessage(sessionId, content, role) {
  return axios.post(
    `${API_BASE}/chat/message/`,
    {
      session_id: sessionId,
      content: content,
      role: role, // "user" or "assistant"
    },
    { headers: getAuthHeaders() },
  );
}

// Fetch messages
export async function fetchSessionMessages(sessionId) {
  return axios.get(`${API_BASE}/chat/message/${sessionId}/`, {
    headers: getAuthHeaders(),
  });
}

// Fetch all sessions (chat history)
export async function fetchChatHistory() {
  return axios.get(`${API_BASE}/chat/history/`, { headers: getAuthHeaders() });
}
```

### Database Schema (Django Models)

```python
# apps/Chat/models.py
from django.db import models
from django.contrib.auth.models import User

class ChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

class ChatMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'Assistant'),
        ('system', 'System'),
    ]

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    tokens_used = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
```

### How Messages Flow

```
User types: "Hello"
    ↓
Frontend state updates: setMessages([...prev, {role: "user", content: "Hello"}])
    ↓
Save to localStorage: localStorage.setItem("guestChat", ...)
    ↓
Send API request: saveMessage(sessionId, "Hello", "user")
    ↓
Backend receives API call
    ↓
Database stores: INSERT INTO ChatMessage (session_id, role, content)
    ↓
API returns: {id: 123, created_at: "2026-02-26T..."}
    ↓
Response visible in UI immediately (optimistic update)

On refresh:
    ↓
Frontend calls: fetchSessionMessages(sessionId)
    ↓
Backend queries: SELECT * FROM ChatMessage WHERE session_id = ?
    ↓
Returns all messages in order
    ↓
Frontend loads into state
    ↓
Chat history appears instantly
```

---

## Unlimited Chats in Voice Agents - Strategy

### Current Limits (If Any)

Your app currently has **no limits** on:

- Number of chats per user
- Messages per session
- Voice agent conversations

### Why No Limits?

```
Database: PostgreSQL/SQLite → Can store billions of rows
          No practical limit for typical users (millions of messages)

Voice API: Deepgram → Charges per minute
          If unlimited voices used = High costs

LLM API: Google Gemini → Charges per API call
         If unlimited LLM calls = Higher costs

Bandwidth: WebSocket streaming is efficient
           Can handle thousands of simultaneous users
```

### Cost Implications (Rough Estimates)

```
VOICE INPUT (Deepgram):
- $0.0069 per minute
- 10-second request = $0.001
- 1000 voice requests = $1

LLM OUTPUT (Google Gemini):
- $0.075 per million input tokens
- Average conversation = 1000 tokens
- 1000 conversations = $0.075

DATABASE STORAGE:
- PostgreSQL: ~$15/month (Cloud)
- 1 million messages = ~1GB
- Basically free

BANDWIDTH:
- WebSocket: Minimal data
- 1000 concurrent users = Manageable
```

### Recommended Monetization Strategy

**Freemium Model:**

```
┌─────────────────────────────────────┐
│         FREE TIER (Guest)           │
├─────────────────────────────────────┤
│ • Unlimited text chats              │ ← Self-sustaining
│ • 3 voice chat sessions/month       │ ← Limit voice (costs)
│ • Voice agent disabled              │
│ • No chat persistence               │
│ • Ads shown                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       PREMIUM TIER ($9.99/month)    │
├─────────────────────────────────────┤
│ • Unlimited text chats              │
│ • Unlimited voice chats             │ ← Full access
│ • Voice agent enabled               │
│ • 5 year chat history               │
│ • No ads                            │
│ • Export conversations              │
│ • Custom assistant name             │
└─────────────────────────────────────┘
```

### How to Implement Chat Limits

```javascript
// Frontend - Check remaining quota
async function checkUserQuota() {
  const response = await axios.get("/api/user/quota/", {
    headers: getAuthHeaders(),
  });

  return {
    voiceChatsUsed: response.data.voice_chats_used,
    voiceChatsLimit: response.data.voice_chats_limit,
    canUseVoice:
      response.data.voice_chats_used < response.data.voice_chats_limit,
  };
}

// Conditional rendering
{
  !canUseVoice && (
    <Banner>
      🎙️ You've used 3/3 voice chats this month.
      <Button>Upgrade to Premium</Button>
    </Banner>
  );
}
```

### Development Approach for Scaling

**Phase 1 (Current):** Unlimited for all

- No rate limiting needed
- Focus on features

**Phase 2:** Add quotas

```python
# models.py
class UserQuota(models.Model):
    user = models.OneToOneField(User)
    voice_chats_limit = models.IntegerField(default=3)  # Free tier
    voice_chats_used = models.IntegerField(default=0)
    reset_date = models.DateField()
```

**Phase 3:** Implement monitoring

```python
# Track usage
from django.utils import timezone

async def increment_voice_usage(user):
    quota, _ = UserQuota.objects.get_or_create(user=user)
    quota.voice_chats_used += 1
    quota.save()
```

**Phase 4:** Add payment system

- Integrate Stripe
- Create subscription tiers
- Auto-upgrade on payment

---

## Development Roadmap

### Phase 1: Foundation (✅ DONE)

- [x] Basic chat UI
- [x] Voice recording (Deepgram integration)
- [x] Google Gemini API integration
- [x] Chat persistence (localStorage + database)
- [x] User authentication (Google OAuth)

### Phase 2: Voice Agent Features (🔄 IN PROGRESS)

- [x] Voice agent settings panel
- [x] Language selection (9 languages)
- [x] Voice speed control (0.5x - 2.0x)
- [ ] Speaker diarization (show "User:" vs "Agent:")
- [ ] Custom system prompts
- [ ] Tone/personality selection

### Phase 3: Advanced Deepgram Features (📅 NEXT)

- [ ] Implement profanity filter
- [ ] Add custom vocabulary input
- [ ] Enable sentiment analysis
- [ ] Add entity extraction (emails, phones)
- [ ] Multi-language support UI

### Phase 4: Model Enhancement (📅 PLANNED)

- [ ] Fine-tune Gemini for voice agency
- [ ] Add multiple LLM providers (Claude, GPT-4, Llama)
- [ ] Implement prompt templates UI
- [ ] Add conversation context window

### Phase 5: Monetization (🎯 FUTURE)

- [ ] Implement usage tracking
- [ ] Create pricing tiers
- [ ] Add Stripe payment integration
- [ ] Usage dashboard for users
- [ ] Credits/token system

### Phase 6: Scaling (🚀 ADVANCED)

- [ ] Database optimization (indexes, caching)
- [ ] Redis for caching (reduce API calls)
- [ ] Load balancing
- [ ] Analytics dashboard
- [ ] Admin panel for moderation

---

## Quick Reference Commands

### Test Deepgram Connection

```bash
curl -X POST \
  -H "Authorization: Token YOUR_DEEPGRAM_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @audio.wav \
  "https://api.deepgram.com/v1/listen?model=nova-2-phonecall"
```

### Check Database

```bash
# If using Django
python manage.py shell
>>> from Chat.models import ChatMessage
>>> ChatMessage.objects.all().count()  # Total messages
>>> ChatMessage.objects.filter(role='user').count()  # User messages
```

### Monitor API Costs

```
Deepgram Dashboard: https://console.deepgram.com/billing
Google Cloud: https://console.cloud.google.com/billing
```

---

## Troubleshooting

### Problem: Messages not saving to database

**Solution:**

1. Check `saveMessage()` is being called
2. Verify `activeSession` is set (not null)
3. Check authentication token is valid
4. Look at browser console for errors

### Problem: Slow voice transcription

**Solution:**

1. Decrease audio chunk size in `useVoiceWebSocket.js`
2. Switch model from `nova-2` to `nova-2-general`
3. Check network latency
4. Reduce other browser tabs (CPU)

### Problem: High API costs

**Solution:**

1. Implement message deduplication
2. Add Redis caching layer
3. Use cheaper model (`nova-2-general` vs `nova-2-phonecall`)
4. Implement request batching

---

## Next Steps

1. **Run in Production**: Deploy to Render/Vercel
2. **Monitor Usage**: Set up analytics
3. **Gather Feedback**: What features users want
4. **Scale First Bottleneck**: Usually database or API costs
5. **Monetize**: Add free tier limits
6. **Expand**: Multi-language, more LLMs, more features

---

**Created**: February 26, 2026  
**Status**: Production Ready  
**Version**: 1.0  
**Contact**: [Your contact info]
