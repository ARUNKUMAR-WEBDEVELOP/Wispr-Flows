from django.urls import path
from .views import (
    CreateChatSessionView,
    SendMessageView,
    StreamAIResponseView,
    ask_ai,
    ChatHistoryView
)

urlpatterns = [
    path("ask/", ask_ai, name="ask"),
    path("session/", CreateChatSessionView.as_view()),
    path("message/<int:session_id>/", SendMessageView.as_view()),
    path("stream/<int:session_id>/", StreamAIResponseView.as_view()),
    path("history/", ChatHistoryView.as_view()),
]
