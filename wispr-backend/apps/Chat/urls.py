from django.urls import path
from .views import ask_ai, voice_agent_response
from .views_enhanced import (
    ChatHistoryView,
    CreateChatSessionView,
    LoadChatSessionView,
    SendMessageToSessionView,
    DeleteChatSessionView,
    UpdateChatSessionView,
    get_available_llm_models,
)

urlpatterns = [
    # Legacy endpoints (backwards compatibility)
    path("ask/", ask_ai, name="ask"),
    path("voice-agent/", voice_agent_response, name="voice_agent"),
    
    # Enhanced session-based endpoints
    path("models/", get_available_llm_models, name="available_models"),
    path("history/", ChatHistoryView.as_view(), name="chat_history"),
    path("session/create/", CreateChatSessionView.as_view(), name="create_session"),
    path("session/<int:session_id>/", LoadChatSessionView.as_view(), name="load_session"),
    path("session/<int:session_id>/message/", SendMessageToSessionView.as_view(), name="send_message"),
    path("session/<int:session_id>/update/", UpdateChatSessionView.as_view(), name="update_session"),
    path("session/<int:session_id>/delete/", DeleteChatSessionView.as_view(), name="delete_session"),
]
