from django.urls import path
from .views import (
    create_chat_session,
    get_chat_history,
    get_session_messages,
    process_voice_transcript,
    delete_session,
)

urlpatterns = [
    # Chat session management
    path("session/create/", create_chat_session, name="create_session"),
    path("session/<int:session_id>/delete/", delete_session, name="delete_session"),
    path("session/<int:session_id>/messages/", get_session_messages, name="get_messages"),
    
    # History and voice agent
    path("history/", get_chat_history, name="history"),
    path("session/<int:session_id>/transcript/", process_voice_transcript, name="process_transcript"),
]
