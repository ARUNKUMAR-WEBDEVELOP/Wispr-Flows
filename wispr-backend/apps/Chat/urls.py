from django.urls import path
from .views import (
    CreateChatSessionView,
    SendMessageView,
    StreamAIResponseView,
    ask_ai,
    ChatHistoryView,
    voice_agent_response
)

urlpatterns = [
    path("ask/", ask_ai, name="ask"),
    path("voice-agent/", voice_agent_response, name="voice_agent"),
