from django.db import models
from django.contrib.auth.models import User


class ChatSession(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True)
    is_voice_agent = models.BooleanField(default=False)  # Track voice agent conversations
    marked_for_training = models.BooleanField(default=False)  # For model training
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    message_count = models.IntegerField(default=0)  # Track conversation length

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['is_voice_agent']),
            models.Index(fields=['marked_for_training']),
        ]

    def __str__(self):
        return f"ChatSession({self.id}) - {self.title or 'Untitled'}"


class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ("user", "User"),
        ("assistant", "Assistant"),
        ("voice_agent", "Voice Agent"),
        ("error", "Error"),
    )

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    is_voice_input = models.BooleanField(default=False)  # Track voice inputs
    confidence_score = models.FloatField(null=True, blank=True)  # Deepgram confidence
    tokens_used = models.IntegerField(default=0)  # For API usage tracking
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
            models.Index(fields=['is_voice_input']),
        ]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class VoiceAgentTrainingData(models.Model):
    """Store conversations for model training"""
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="training_data"
    )
    session = models.ForeignKey(
        ChatSession, on_delete=models.SET_NULL, null=True, blank=True
    )
    user_input = models.TextField()
    agent_response = models.TextField()
    user_rating = models.IntegerField(
        choices=[(i, str(i)) for i in range(1, 6)],
        null=True,
        blank=True
    )  # 1-5 rating
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at']),
        ]

    def __str__(self):
        return f"Training Data - {self.user.username}"

