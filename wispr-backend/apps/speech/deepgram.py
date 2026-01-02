import json
import asyncio
import websockets
from django.conf import settings

DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?punctuate=true"
    "&interim_results=true"
    "&language=auto"
)

async def deepgram_stream(audio_queue, send_transcript):
    """
    Streams microphone audio to Deepgram (STT)
    """

    headers = {
        "Authorization": f"Token {settings.DEEPGRAM_API_KEY}"
    }

    async with websockets.connect(
        DEEPGRAM_WS_URL,
        extra_headers=headers
    ) as ws:

        async def send_audio():
            while True:
                audio = await audio_queue.get()
                if audio is None:
                    break
                await ws.send(audio)

        async def receive_text():
            async for message in ws:
                data = json.loads(message)

                if "channel" in data:
                    alts = data["channel"]["alternatives"]
                    if alts and alts[0]["transcript"]:
                        await send_transcript(alts[0]["transcript"])

        await asyncio.gather(send_audio(), receive_text())
