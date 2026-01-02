import requests
from django.conf import settings

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"

def text_to_speech(text, language="en"):
    """
    Converts text → speech audio bytes using Deepgram API.
    Handles long text by splitting into chunks (<2000 chars).
    Returns full audio bytes.
    """
    
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")
    
    if not settings.DEEPGRAM_API_KEY:
        raise ValueError("DEEPGRAM_API_KEY not configured")

    # Split long text into <=2000 character chunks
    def chunk_text(text, max_length=2000):
        chunks = []
        start = 0
        while start < len(text):
            end = start + max_length
            chunks.append(text[start:end])
            start = end
        return chunks

    audio_bytes = b""  # initialize empty bytes

    headers = {
        "Authorization": f"Token {settings.DEEPGRAM_API_KEY}",
        "Content-Type": "application/json"
    }

    # Query parameters
    params = {
        "model": "aura-asteria-en",
        "encoding": "linear16",
        "sample_rate": 16000,
    }

    try:
        for chunk in chunk_text(text):
            payload = {"text": chunk.strip()}

            response = requests.post(
                DEEPGRAM_TTS_URL,
                headers=headers,
                json=payload,
                params=params,
                timeout=30
            )

            if response.status_code != 200:
                raise Exception(f"Deepgram API error ({response.status_code}): {response.text}")

            # Concatenate audio bytes
            audio_bytes += response.content

        return audio_bytes  # ✅ always return bytes

    except requests.exceptions.Timeout:
        raise Exception("Deepgram API request timed out")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error calling Deepgram: {str(e)}")
