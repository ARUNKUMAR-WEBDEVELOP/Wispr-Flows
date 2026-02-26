from django.urls import path
from .views import (
    CreateChatSessionView,
    SendMessageView,
    StreamAIResponseView,
    ask_ai,
    ChatHistoryView,
    voice_agent_response,
    CreateVoiceAgentSessionView,
    VoiceAgentSessionsView,
    RateVoiceAgentResponseView,
    TrainingDataStatsView
)

urlpatterns = [
    path("ask/", ask_ai, name="ask"),
    path("voice-agent/", voice_agent_response, name="voice_agent"),
    path("history/", ChatHistoryView.as_view(), name="chat_history"),
    path("session/", CreateChatSessionView.as_view(), name="create_session"),
    path("message/<int:session_id>/", SendMessageView.as_view(), name="session_messages"),
    
    # Voice Agent Session endpoints for unlimited chats
    path("voice-sessions/", VoiceAgentSessionsView.as_view(), name="voice_sessions"),
    path("voice-sessions/create/", CreateVoiceAgentSessionView.as_view(), name="create_voice_session"),
    
    # Training endpoints for model improvement
    path("rate/<int:training_data_id>/", RateVoiceAgentResponseView.as_view(), name="rate_response"),
    path("training-stats/", TrainingDataStatsView.as_view(), name="training_stats"),
]
