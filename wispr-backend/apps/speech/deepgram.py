import json
import asyncio
from django.conf import settings
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
)


async def deepgram_stream(audio_queue, send_transcript):
    """
    Streams microphone audio to Deepgram (STT) using Deepgram SDK.
    Supports unlimited voice conversations with live transcription.
    """

    api_key = getattr(settings, 'DEEPGRAM_API_KEY', None)
    if not api_key:
        print("[Deepgram Debug] ERROR: DEEPGRAM_API_KEY is missing!")
        return

    print(f"[Deepgram Debug] Using API key: {api_key[:10]}...")

    try:
        # Initialize Deepgram client with options
        config = DeepgramClientOptions(options={"keepalive": "true"})
        dg_client = DeepgramClient(api_key, config)

        # Create live connection
        dg_connection = dg_client.listen.live.v("1")

        # Queue to handle callback-to-async bridge
        transcript_queue = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def on_message(self, result, **kwargs):
            """Callback when Deepgram sends transcript"""
            try:
                if result.channel.alternatives:
                    sentence = result.channel.alternatives[0].transcript
                    if sentence:
                        payload = {
                            "type": "transcript",
                            "text": sentence,
                            "is_final": result.is_final,  # False = interim, True = final
                            "speech_final": result.speech_final  # Speaker paused
                        }
                        print(f"[Deepgram Debug] Transcript: {sentence} (final={result.is_final})")
                        asyncio.run_coroutine_threadsafe(
                            transcript_queue.put(json.dumps(payload)), 
                            loop
                        )
            except Exception as e:
                print(f"[Deepgram Debug] Error in callback: {e}")

        # Register callback for transcript events
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)

        # Configure live transcription options
        options = LiveOptions(
            model="nova-3",           # Latest model with superior accuracy
            language="en-US",         # Change to "ta" for Tamil or other language
            smart_format=True,        # Enable punctuation and formatting
            interim_results=True,     # Get results while user is speaking
            encoding="linear16",      # PCM 16-bit linear
            channels=1,              # Mono audio
            sample_rate=16000,       # 16kHz sample rate
            endpointing=300,         # 300ms silence = end of speech
        )

        # Start connection
        if not dg_connection.start(options):
            print("[Deepgram Debug] ERROR: Failed to start Deepgram connection")
            return

        print("[Deepgram Debug] Connection established successfully")

        async def send_transcripts_to_ui():
            """Push transcripts from Deepgram to frontend"""
            while True:
                try:
                    msg = await transcript_queue.get()
                    await send_transcript(json.loads(msg)["text"])
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    print(f"[Deepgram Debug] Error sending transcript: {e}")

        async def receive_audio():
            """Receive audio from frontend and send to Deepgram"""
            while True:
                try:
                    audio = await audio_queue.get()
                    if audio is None:
                        print("[Deepgram Debug] Audio stream ended")
                        break
                    dg_connection.send(audio)
                    print(f"[Deepgram Debug] Sent {len(audio)} bytes to Deepgram")
                except asyncio.CancelledError:
                    break
                except Exception as e:
                    print(f"[Deepgram Debug] Error sending audio: {e}")

        # Run both tasks concurrently
        send_task = asyncio.create_task(send_transcripts_to_ui())
        receive_task = asyncio.create_task(receive_audio())

        await asyncio.gather(send_task, receive_task)

    except Exception as e:
        print(f"[Deepgram Debug] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        try:
            if dg_connection:
                dg_connection.finish()
                print("[Deepgram Debug] Connection closed gracefully")
        except Exception as e:
            print(f"[Deepgram Debug] Error closing connection: {e}")
