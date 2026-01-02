from django.urls import path
from . import views

urlpatterns = [
    # REST endpoint for text-to-speech
    path("tts/", views.text_to_speech, name="text_to_speech"),
    # REST endpoint for speech-to-text (transcription)
    path("transcribe/", views.transcribe_audio, name="transcribe_audio"),
]

# WebSocket endpoint is defined in ASGI config (config/asgi.py)
# ws/speech/ route handled by SpeechConsumer
