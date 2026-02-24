import json
import asyncio
import websockets
from django.conf import settings

DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?encoding=opus"
    "&punctuate=true"
    "&interim_results=true"
    "&language=auto"
)

async def deepgram_stream(audio_queue, send_transcript):
    """
    Streams microphone audio to Deepgram (STT)
    """

    api_key = getattr(settings, 'DEEPGRAM_API_KEY', None)
    print(f"[Deepgram Debug] Using API key: {api_key}")
    if not api_key:
        print("[Deepgram Debug] ERROR: DEEPGRAM_API_KEY is missing!")
    headers = {
        "Authorization": f"Token {api_key}"
    }

    try:
        async with websockets.connect(
            DEEPGRAM_WS_URL,
            extra_headers=headers
        ) as ws:
            async def send_audio():
                while True:
                    audio = await audio_queue.get()
                    if audio is None:
                        break
                    print(f"[Deepgram Debug] Sending audio chunk: type={type(audio)}, size={len(audio) if hasattr(audio, '__len__') else 'unknown'}")
                    await ws.send(audio)

            async def receive_text():
                async for message in ws:
                    data = json.loads(message)
                    if "channel" in data:
                        alts = data["channel"]["alternatives"]
                        if alts and alts[0]["transcript"]:
                            await send_transcript(alts[0]["transcript"])

            await asyncio.gather(send_audio(), receive_text())
    except Exception as e:
        print(f"[Deepgram Debug] ERROR: {e}")
        # Enhanced error logging for HTTP 400 and other errors
        import traceback
        traceback.print_exc()
        if hasattr(e, 'args') and e.args:
            print(f"[Deepgram Debug] Exception args: {e.args}")
        # Try to get more info if it's a websockets InvalidStatusCode exception
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_body = await e.response.text()
                print(f"[Deepgram Debug] Error response body: {error_body}")
            except Exception as ex:
                print(f"[Deepgram Debug] Could not read error response body: {ex}")
