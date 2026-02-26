# Deepgram Integration & Model Enhancement Guide

## Overview

Your application uses **Deepgram Speech-to-Text API** via WebSocket for real-time voice transcription. This guide explains how it works and how to enhance model capabilities.

---

## Current Architecture

### Frontend Flow (Voice Recording)

1. **Microphone Access** → User grants audio permission
2. **Audio Capture** → Web Audio API collects PCM audio data at native sample rate
3. **Downsampling** → 48kHz → 16kHz PCM format (Deepgram standard)
4. **WebSocket Connection** → Connects to backend speech endpoint
5. **Audio Streaming** → PCM data sent continuously to Deepgram
6. **Transcript Receive** → Real-time transcripts returned as JSON

### Backend Flow (Django WebSocket)

```
User Audio (16kHz PCM)
    ↓
Django WebSocket Consumer
    ↓
Deepgram API (via WebSocket)
    ↓
Real-time Transcripts
    ↓
Return to Frontend via WebSocket
```

### Current Deepgram Settings

**File**: `wispr-flow-clone/src/hooks/useVoiceWebSocket.js`

```javascript
// WebSocket connects to backend speech endpoint
const wsUrl = "ws://localhost:8000/ws/speech/"; // Development
const wsUrl = "wss://wispr-flows-3adt.onrender.com/ws/speech/"; // Production
```

---

## How Deepgram Works

### 1. **Audio Processing**

- Accepts **16-bit PCM audio** at **16kHz sample rate**
- Your app downsamples from device native rate (usually 48kHz)
- Sends audio chunks (~4KB per 100ms)

### 2. **Transcription Models**

Deepgram offers multiple models with different accuracy/speed tradeoffs:

| Model              | Use Case                         | Accuracy   | Speed      | Cost     |
| ------------------ | -------------------------------- | ---------- | ---------- | -------- |
| `nova-2`           | **DEFAULT** - Best for most apps | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Standard |
| `nova-2-general`   | General conversation             | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | Lower    |
| `nova-2-phonecall` | Phone conversations              | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Standard |
| `nova-2-finance`   | Financial domain                 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Standard |
| `nova-2-meeting`   | Multi-speaker meetings           | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | Standard |
| `nova-2-medical`   | Medical terminology              | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | Premium  |
| `nova-2-voicemail` | Voicemail extraction             | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | Standard |

### 3. **Key Features**

**Punctuation & Capitalization**

```
Raw: "hello how are you today"
With Smart Formatting: "Hello, how are you today?"
```

**Speaker Diarization** (who said what)

```
Speaker 0: "How can I help you?"
Speaker 1: "I need information about your services."
```

**Language Detection**

```
Automatically detects language without specifying
```

**Keywords & Entities**

```
Highlights: email addresses, phone numbers, URLs, amounts
```

---

## How to Integrate Better Deepgram Models

### Step 1: Update Backend WebSocket Consumer

**File**: `wispr-backend/apps/Chat/consumers.py` (or similar)

```python
import json
from channels.generic.websocket import AsyncWebsocketConsumer
import aiohttp
from django.conf import settings

class SpeechConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

        # Initialize Deepgram WebSocket with enhanced model
        self.deepgram_ws = None
        self.deepgram_url = (
            f"wss://api.deepgram.com/v1/listen?"
            f"model=nova-2-phonecall"  # ← Change model here
            f"&encoding=linear16"
            f"&sample_rate=16000"
            f"&punctuate=true"  # ← Add punctuation
            f"&diarize=true"  # ← Detect multiple speakers
            f"&smart_format=true"  # ← Format numbers, dates
            f"&language=en"  # ← Specific language
        )

    async def receive(self, bytes_data):
        """Receive audio chunk from frontend"""
        if not self.deepgram_ws:
            await self.connect_deepgram()

        # Send PCM audio to Deepgram
        await self.deepgram_ws.send_bytes(bytes_data)

    async def connect_deepgram(self):
        """Connect to Deepgram API"""
        headers = {
            "Authorization": f"Token {settings.DEEPGRAM_API_KEY}"
        }
        self.deepgram_ws = await aiohttp.ClientSession().ws_connect(
            self.deepgram_url,
            headers=headers
        )
        # Start listening for transcripts
        asyncio.create_task(self.listen_deepgram())

    async def listen_deepgram(self):
        """Listen for Deepgram transcripts"""
        async for msg in self.deepgram_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                transcript_data = json.loads(msg.data)

                # Extract transcript
                transcript = transcript_data.get('channel', {})
                                            .get('alternatives', [{}])[0]
                                            .get('transcript', '')
                is_final = transcript_data.get('is_final', False)

                # Send back to frontend
                await self.send(json.dumps({
                    "type": "transcript",
                    "text": transcript,
                    "is_final": is_final,
                    "confidence": transcript_data.get('channel', {})
                                                   .get('alternatives', [{}])[0]
                                                   .get('confidence', 0)
                }))
```

### Step 2: Update Frontend Deepgram Configuration

**File**: `wispr-flow-clone/src/hooks/useVoiceWebSocket.js`

```javascript
// Add model selection parameter
export function useVoiceWebSocket(onTranscript, options = {}) {
  const wsRef = useRef(null);

  // ... existing code ...

  const connect = useCallback(() => {
    // Support model selection
    const model = options.model || "nova-2-phonecall"; // Default to phonecall
    const language = options.language || "en";

    const wsUrl =
      process.env.NODE_ENV === "development"
        ? `ws://localhost:8000/ws/speech/?model=${model}&language=${language}`
        : `wss://wispr-flows-3adt.onrender.com/ws/speech/?model=${model}&language=${language}`;

    // ... rest of connection code ...
  }, [options, reconnectAttempts, maxReconnectAttempts]);

  return {
    connect,
    disconnect,
    sendAudio,
    connected,
    error,
  };
}
```

### Step 3: Add Model Selection UI

**File**: `wispr-flow-clone/src/components/voice/VoiceAgentButton.jsx`

```jsx
const [selectedModel, setSelectedModel] = useState("nova-2-phonecall");

// In the settings panel, add model selector
<select
  value={selectedModel}
  onChange={(e) => setSelectedModel(e.target.value)}
  className="px-2 py-1 bg-white/80 dark:bg-gray-800/80 rounded text-[9px]"
>
  <option value="nova-2-phonecall">Phone Call (best)</option>
  <option value="nova-2">General (default)</option>
  <option value="nova-2-meeting">Meeting</option>
  <option value="nova-2-finance">Finance</option>
  <option value="nova-2-medical">Medical</option>
</select>;

// Pass to WebSocket hook
const ws = useVoiceWebSocket(onTranscript, {
  model: selectedModel,
  path: "voice-agent",
});
```

---

## Advanced Deepgram Features

### 1. **Profanity Filter**

```
Removes or masks profanity in transcripts
?profanity_filter=true
```

### 2. **Numbers as Digits**

```
"twenty three" → "23"
?numerals=true
```

### 3. **Paragraph Detection**

```
Groups sentences into paragraphs automatically
?paragraphs=true
```

### 4. **Topic Detection**

```
Identifies topics being discussed
Returns: topics[], confidence score
```

### 5. **Sentiment Analysis**

```
Analyzes emotional tone (positive/negative/neutral)
Returns: sentiment score per utterance
```

### 6. **Custom Vocabulary**

```
Add domain-specific terms that aren't in standard dictionary
?search=term1,term2,term3
```

---

## Complete Enhanced Configuration

```python
# Best practice Deepgram URL for production
deepgram_url = (
    "wss://api.deepgram.com/v1/listen?"
    "model=nova-2-phonecall"      # Use phonecall for voice
    "&encoding=linear16"           # PCM 16-bit
    "&sample_rate=16000"           # 16kHz
    "&punctuate=true"              # Add punctuation
    "&smart_format=true"           # Format: "123 Main Street" not "one two three"
    "&diarize=true"                # Who said what
    "&numerals=true"               # Numbers as digits
    "&language=en"                 # English
    "&interim_results=true"        # Real-time transcripts
    "&endpointing=true"            # Detect speech endings
    "&version=latest"              # Always use latest
)
```

---

## Environment Setup

### 1. Get Deepgram API Key

- Sign up at https://console.deepgram.com
- Create API key in dashboard
- Copy key to `.env`

### 2. Set Environment Variables

**`.env` (Backend)**

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

**`.env.local` (Frontend - if needed)**

```
VITE_DEEPGRAM_MODEL=nova-2-phonecall
VITE_DEEPGRAM_LANGUAGE=en
```

---

## Pricing Comparison

| Model            | Cost per minute | Accuracy | Best For                   |
| ---------------- | --------------- | -------- | -------------------------- |
| nova-2-general   | $0.0059         | 95%      | General conversation       |
| nova-2-phonecall | $0.0069         | 98%      | Phone, voice (RECOMMENDED) |
| nova-2-meeting   | $0.0089         | 99%      | Meetings, multi-speaker    |
| nova-2-medical   | $0.0129         | 99.5%    | Medical terminology        |

**Your app uses**: ~10 seconds per request = ~$0.001 per request (phonecall)

---

## Troubleshooting

### Issue: Empty Transcripts

**Solution**: Ensure audio is 16kHz PCM 16-bit mono

```javascript
// Verify in useVoiceWebSocket.js
const downsampleFactor = Math.round(nativeSampleRate / 16000);
```

### Issue: Slow Real-time Response

**Solution**: Use faster model

```
Change from: nova-2 (200ms latency)
Change to: nova-2-general (100ms latency)
```

### Issue: Technical Jargon Not Recognized

**Solution**: Add custom vocabulary

```
?search=API,microservice,WebSocket,blockchain
```

### Issue: High Costs

**Solution**: Use built-in endpoint detection

```
?endpointing=true  # Stops transcription on silence
```

---

## Testing Deepgram Integration

### Test WebSocket Connection

```javascript
// In browser console
const ws = new WebSocket(
  "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000",
);
ws.onopen = () => console.log("Connected");
ws.onerror = (e) => console.error("Error:", e);
```

### Test with Audio File

```bash
curl -X POST \
  -H "Authorization: Token YOUR_DEEPGRAM_API_KEY" \
  -H "Content-Type: audio/wav" \
  --data-binary @audio.wav \
  "https://api.deepgram.com/v1/listen?model=nova-2-phonecall"
```

---

## Next Steps

1. **Implement Model Selection** → Let users choose best model for their use case
2. **Add Speaker Detection** → Show "User:" vs "Assistant:" labels
3. **Implement Custom Vocabulary** → For domain-specific terms
4. **Add Confidence Scores** → Show transcription confidence (0-1)
5. **Add Language Selection** → Support multiple languages
6. **Monitor Usage** → Track API calls and costs

---

## References

- **Deepgram Docs**: https://developers.deepgram.com/reference
- **Models**: https://developers.deepgram.com/docs/models
- **Features**: https://developers.deepgram.com/docs/features
- **Pricing**: https://deepgram.com/pricing
