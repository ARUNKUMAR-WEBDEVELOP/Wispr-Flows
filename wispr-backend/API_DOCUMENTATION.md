# Wispr-Flow Voice Agent - Enhanced API Documentation

## Overview

The enhanced voice agent now supports:
- ✅ **Multiple LLM Models** (Gemini Flash/Pro, GPT-4/Mini, etc.)
- ✅ **Chat Session Management** with persistent history
- ✅ **User Login-Based Storage** for conversation continuity
- ✅ **Real ChatGPT/Gemini-like Experience** with conversation context
- ✅ **Deepgram STT/TTS Integration** for fast communication
- ✅ **Streaming Responses** for real-time feedback

---

## Backend Endpoints

### 1. **Get Available LLM Models**
```
GET /api/chat/models/
```

**Response:**
```json
{
  "models": {
    "gemini-flash-lite": {
      "provider": "Google",
      "full_name": "Gemini Flash Lite (Fastest)",
      "speed": "fastest",
      "cost": "low",
      "context": 100000
    },
    "gemini-1.5-flash": {...},
    "gemini-1.5-pro": {...},
    "gpt-4-turbo": {...},
    "gpt-4-mini": {...}
  },
  "default_model": "gemini-flash-lite"
}
```

---

### 2. **Get All Chat Sessions (History)**
```
GET /api/chat/history/
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "sessions": [
    {
      "session_id": 1,
      "title": "How do I reset my password?...",
      "llm_model": "gemini-flash-lite",
      "model_info": {...},
      "created_at": "2026-02-25T10:30:00Z",
      "updated_at": "2026-02-25T10:35:00Z",
      "message_count": 5,
      "preview": "How do I reset my password?"
    }
  ],
  "total_sessions": 10
}
```

---

### 3. **Create New Chat Session**
```
POST /api/chat/session/create/
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "title": "My First Chat",
  "llm_model": "gemini-flash-lite"
}
```

**Response:**
```json
{
  "session_id": 42,
  "title": "My First Chat",
  "llm_model": "gemini-flash-lite",
  "model_info": {...},
  "created_at": "2026-02-25T10:30:00Z"
}
```

---

### 4. **Load Full Chat Session**
```
GET /api/chat/session/{session_id}/
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "session_id": 42,
  "title": "How do I reset my password?",
  "llm_model": "gemini-flash-lite",
  "model_info": {...},
  "created_at": "2026-02-25T10:30:00Z",
  "updated_at": "2026-02-25T10:35:00Z",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "How do I reset my password?",
      "created_at": "2026-02-25T10:30:00Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "To reset your password, visit the login page...",
      "created_at": "2026-02-25T10:30:05Z"
    }
  ]
}
```

---

### 5. **Send Message & Get Response (Streaming)**
```
POST /api/chat/session/{session_id}/message/
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request:**
```json
{
  "message": "What is the weather today?"
}
```

**Response Type:** Server-Sent Events (SSE)
```
data: The
data: weather
data: today
data: is
data: sunny
data: with
data: 72°F.
```

**Backend Processing:**
- ✅ Saves user message to database
- ✅ Retrieves conversation history (last 10 messages)
- ✅ Sends context to LLM with system prompt
- ✅ Streams response chunks in real-time
- ✅ Saves complete assistant response to database
- ✅ Updates session title from first message
- ✅ Updates session timestamp

---

### 6. **Update Chat Session**
```
PATCH /api/chat/session/{session_id}/update/
Authorization: Bearer <JWT_TOKEN>
```

**Request:**
```json
{
  "title": "Weather Questions",
  "llm_model": "gemini-1.5-pro"
}
```

**Response:**
```json
{
  "session_id": 42,
  "title": "Weather Questions",
  "llm_model": "gemini-1.5-pro",
  "updated_at": "2026-02-25T10:40:00Z"
}
```

---

### 7. **Delete Chat Session**
```
DELETE /api/chat/session/{session_id}/delete/
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "message": "Session deleted successfully",
  "session_id": 42
}
```

---

## Legacy Endpoints (Backwards Compatible)

### Voice Agent without Session Management
```
POST /api/chat/voice-agent/
Content-Type: application/json
```

**Request:**
```json
{
  "message": "Tell me a joke",
  "llm_model": "gemini-flash-lite",
  "conversation_history": [
    {
      "role": "user",
      "content": "Hello"
    },
    {
      "role": "assistant", 
      "content": "Hi there! How can I help?"
    }
  ]
}
```

**Response:**
```json
{
  "text": "Why did the programmer quit his job?",
  "agent_type": "voice_agent",
  "llm_model": "gemini-flash-lite",
  "model_info": {...}
}
```

---

## Frontend Integration Guide

### Step 1: Login & Get JWT Token
```javascript
// Already implemented in auth.service.js
const token = localStorage.getItem('access_token');
```

### Step 2: Create New Chat Session
```javascript
const createSession = async (title, llmModel = 'gemini-flash-lite') => {
  const response = await fetch('https://api.example.com/api/chat/session/create/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      llm_model: llmModel
    })
  });
  
  const data = await response.json();
  return data.session_id;
};
```

### Step 3: Load Chat History
```javascript
const loadChatHistory = async () => {
  const response = await fetch('https://api.example.com/api/chat/history/', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.sessions;  // List of all user's chat sessions
};
```

### Step 4: Load Specific Session
```javascript
const loadSession = async (sessionId) => {
  const response = await fetch(
    `https://api.example.com/api/chat/session/${sessionId}/`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  return data;  // Full session with all messages
};
```

### Step 5: Send Message & Stream Response
```javascript
const sendMessage = async (sessionId, message) => {
  const response = await fetch(
    `https://api.example.com/api/chat/session/${sessionId}/message/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    }
  );
  
  // Handle streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const text = line.slice(6);
        fullResponse += text;
        // Update UI with streaming text in real-time
        console.log('Streaming:', text);
      }
    }
  }
  
  return fullResponse;
};
```

### Step 6: Change LLM Model
```javascript
const switchModel = async (sessionId, newModel) => {
  const response = await fetch(
    `https://api.example.com/api/chat/session/${sessionId}/update/`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ llm_model: newModel })
    }
  );
  
  return await response.json();
};
```

---

## Available LLM Models

| Model | Provider | Speed | Cost | Context | Best For |
|-------|----------|-------|------|---------|----------|
| `gemini-flash-lite` | Google | 🟢 Fastest | Low | 100K | Voice agent, quick responses |
| `gemini-1.5-flash` | Google | 🟡 Fast | Low | 1M | General purpose, fast |
| `gemini-1.5-pro` | Google | 🟠 Balanced | Medium | 1M | Best quality responses |
| `gpt-4-mini` | OpenAI | 🟡 Fast | Low | 128K | Cost-effective, capable |
| `gpt-4-turbo` | OpenAI | 🟠 Balanced | High | 128K | Best reasoning, most powerful |

---

## Deepgram Integration

### STT (Speech-to-Text) → Message
```javascript
// 1. Record audio with Deepgram
const deepgramApiKey = 'YOUR_DEEPGRAM_API_KEY';
const transcription = await recordAndTranscribe(audioBlob);

// 2. Send transcription as message
await sendMessage(sessionId, transcription);
```

### TTS (Text-to-Speech) ← Response
```javascript
// 1. Get AI response (streamed)
const aiResponse = await sendMessage(sessionId, message);

// 2. Convert response to speech
const audioBuffer = await synthesizeSpeech(aiResponse);

// 3. Play audio
const audio = new Audio(URL.createObjectURL(audioBuffer));
audio.play();
```

---

## Error Handling

### Common Errors & Solutions

**401 Unauthorized:**
```
Error: {"detail":"Invalid token"}
Solution: Refresh JWT token or re-login
```

**404 Not Found:**
```
Error: {"error":"Session not found"}
Solution: Session deleted or invalid session_id
```

**400 Bad Request:**
```
Error: {"error":"Invalid model. Available: [...]"}
Solution: Use valid model from available models list
```

**500 Server Error:**
```
Error: {"error":"OpenAI SDK not installed"}
Solution: Install openai package: pip install openai
```

---

## Database Schema

### ChatSession
- `id` (int) - Unique session ID
- `user` (FK) - Linked to User model
- `title` (str) - Session title
- `llm_model` (str) - Selected LLM model
- `is_active` (bool) - Soft delete flag
- `created_at` (datetime) - Creation timestamp
- `updated_at` (datetime) - Last updated timestamp

### ChatMessage
- `id` (int) - Unique message ID
- `session` (FK) - Linked to ChatSession
- `role` (str) - "user" or "assistant"
- `content` (text) - Message content
- `tokens_used` (int) - Token count (for billing)
- `created_at` (datetime) - Timestamp

---

## Environment Setup

Add to `.env` for OpenAI support:
```
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DEEPGRAM_API_KEY=...
```

Install OpenAI SDK (optional but needed for GPT models):
```bash
pip install openai
```

---

## Performance Notes

- **Streaming:** Use SSE for real-time response updates
- **Context Window:** Max 10 previous messages sent for context
- **Caching:** Session history is persisted in database
- **Token Limit:** Monitor tokens_used field for billing

---

## Next Features (Planned)

- 🔄 Token usage tracking & analytics
- 🎯 Model-specific fine-tuning parameters
- 📊 Conversation analytics & insights
- 🔐 End-to-end encryption for messages
- 🌐 Multi-language support
- 👥 Shared chat sessions & collaboration

