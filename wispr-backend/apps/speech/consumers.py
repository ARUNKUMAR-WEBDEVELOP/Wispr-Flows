import asyncio
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from .deepgram import deepgram_stream


class SpeechConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

        self.audio_queue = asyncio.Queue()

        self.dg_task = asyncio.create_task(
            deepgram_stream(
                self.audio_queue,
                self.send_transcript
            )
        )

    async def disconnect(self, close_code):
        await self.audio_queue.put(None)
        self.dg_task.cancel()

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data:
            await self.audio_queue.put(bytes_data)

    async def send_transcript(self, text):
        await self.send(text_data=json.dumps({
            "type": "transcript",
            "text": text
        }))
