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
from .premium_views import (
    SubscriptionStatusView,
    CreateCheckoutSessionView,
    CancelSubscriptionView,
    UpdatePaymentMethodView,
    StartTrialView,
    ModelSelectionView,
    VoiceToneView,
    stripe_webhook,
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
    
    # Premium/Monetization endpoints
    path("subscription/status/", SubscriptionStatusView.as_view(), name="subscription_status"),
    path("subscription/checkout/", CreateCheckoutSessionView.as_view(), name="create_checkout"),
    path("subscription/cancel/", CancelSubscriptionView.as_view(), name="cancel_subscription"),
    path("subscription/payment-method/", UpdatePaymentMethodView.as_view(), name="update_payment"),
    path("subscription/trial/", StartTrialView.as_view(), name="start_trial"),
    
    # Model and Voice Tone selection
    path("models/", ModelSelectionView.as_view(), name="model_selection"),
    path("voice-tone/", VoiceToneView.as_view(), name="voice_tone"),
    
    # Stripe webhook
    path("stripe/webhook/", stripe_webhook, name="stripe_webhook"),
]
