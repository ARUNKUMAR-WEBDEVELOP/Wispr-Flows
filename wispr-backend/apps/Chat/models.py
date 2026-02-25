from django.db import models
from django.contrib.auth.models import User


class ChatSession(models.Model):
    """User chat session with persistent conversation history."""
    
    LLM_CHOICES = (
        ("gemini-flash-lite", "Gemini Flash Lite (Fastest)"),
        ("gemini-1.5-flash", "Gemini 1.5 Flash (Fast)"),
        ("gemini-1.5-pro", "Gemini 1.5 Pro (Balanced)"),
        ("gpt-4-turbo", "GPT-4 Turbo (Powerful)"),
        ("gpt-4-mini", "GPT-4 Mini (Cost-Effective)"),
    )
    
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True, default="New Chat")
    llm_model = models.CharField(
        max_length=50,
        choices=LLM_CHOICES,
        default="gemini-flash-lite",
        help_text="Selected LLM for this session"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
        ]

    def __str__(self):
        return f"{self.title} ({self.user.username})"
    
    def get_conversation_history(self, limit=50):
        """Get recent conversation history for context."""
        return list(
            self.messages.order_by('created_at').values(
                'role', 'content', 'created_at'
            )[-limit:]
        )
    
    def save_title_from_first_message(self):
        """Auto-generate title from first user message."""
        first_message = self.messages.filter(role='user').first()
        if first_message and not self.title.startswith("Chat"):
            # Take first 50 chars of first message
            title = first_message.content[:50]
            if len(first_message.content) > 50:
                title += "..."
            self.title = title
            self.save()


class ChatMessage(models.Model):
    """Individual message in a chat session."""
    
    ROLE_CHOICES = (
        ("user", "User"),
        ("assistant", "Assistant"),
        ("system", "System"),
    )

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    tokens_used = models.IntegerField(default=0, help_text="Tokens used for this message")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session', 'created_at']),
        ]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"
