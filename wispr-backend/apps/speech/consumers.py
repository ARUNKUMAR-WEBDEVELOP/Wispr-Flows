import asyncio
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .deepgram import deepgram_stream


class SpeechConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        print("[SpeechConsumer Debug] WebSocket connected.")
        print("[SpeechConsumer] connect called")
        await self.accept()

        self.audio_queue = asyncio.Queue()

        self.dg_task = asyncio.create_task(
            deepgram_stream(
                self.audio_queue,
                self.send_transcript
            )
        )

    async def disconnect(self, close_code):
        print(f"[SpeechConsumer Debug] WebSocket disconnected. Code: {close_code}")
        print("[SpeechConsumer] disconnect called")
        await self.audio_queue.put(None)
        self.dg_task.cancel()

    async def receive(self, text_data=None, bytes_data=None):
        print("[SpeechConsumer] receive called")
        if bytes_data:
            print(f"[SpeechConsumer Debug] Received audio chunk: {len(bytes_data)} bytes")
            await self.audio_queue.put(bytes_data)
        else:
            print(f"[SpeechConsumer Debug] Received non-audio data: {text_data}")

    async def send_transcript(self, text):
        print(f"[SpeechConsumer Debug] Sending transcript: {text}")
        await self.send(text_data=json.dumps({
            "type": "transcript",
            "text": text
        }))
