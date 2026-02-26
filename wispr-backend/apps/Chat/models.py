from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta


class ChatSession(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=255, blank=True)
    is_voice_agent = models.BooleanField(default=False)  # Track voice agent conversations
    marked_for_training = models.BooleanField(default=False)  # For model training
    llm_model = models.CharField(
        max_length=50,
        default="gemini-2.0-flash",
        choices=[
            ("gemini-2.0-flash", "Gemini 2.0 Flash (Fast)"),
            ("gemini-1.5-pro", "Gemini 1.5 Pro (Advanced)"),
            ("gpt-4-turbo", "GPT-4 Turbo (Premium)"),
        ]
    )  # LLM model selection
    voice_tone = models.CharField(
        max_length=50,
        default="neutral",
        choices=[
            ("neutral", "Neutral"),
            ("friendly", "Friendly"),
            ("professional", "Professional"),
            ("casual", "Casual"),
            ("formal", "Formal"),
            ("enthusiastic", "Enthusiastic"),
            ("empathetic", "Empathetic"),
        ]
    )  # Voice tone for agent
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


class UsageTracking(models.Model):
    """Track API usage for rate limiting and billing"""
    USER_TYPES = [
        ("free", "Free Tier"),
        ("premium", "Premium"),
        ("professional", "Professional"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="usage_tracking"
    )
    tier = models.CharField(max_length=20, choices=USER_TYPES, default="free")
    
    # Monthly limits (reset monthly)
    voice_messages_used = models.IntegerField(default=0)
    text_messages_used = models.IntegerField(default=0)
    api_calls_used = models.IntegerField(default=0)
    tokens_used = models.IntegerField(default=0)
    
    # Limits per tier
    voice_messages_limit = models.IntegerField(default=10)
    text_messages_limit = models.IntegerField(default=50)
    api_calls_limit = models.IntegerField(default=100)
    tokens_limit = models.IntegerField(default=10000)
    
    # Timestamps
    last_reset = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Usage Tracking"

    def reset_monthly_limits(self):
        """Reset limits if month has passed"""
        now = timezone.now()
        if (now - self.last_reset).days >= 30:
            self.voice_messages_used = 0
            self.text_messages_used = 0
            self.api_calls_used = 0
            self.tokens_used = 0
            self.last_reset = now
            self.save()

    def is_within_limits(self, usage_type="voice_messages"):
        """Check if user is within rate limits"""
        self.reset_monthly_limits()
        
        limits = {
            "voice_messages": (self.voice_messages_used, self.voice_messages_limit),
            "text_messages": (self.text_messages_used, self.text_messages_limit),
            "api_calls": (self.api_calls_used, self.api_calls_limit),
            "tokens": (self.tokens_used, self.tokens_limit),
        }
        
        if usage_type in limits:
            used, limit = limits[usage_type]
            return used < limit
        return False

    def increment_usage(self, usage_type="voice_messages", amount=1):
        """Increment usage counter"""
        self.reset_monthly_limits()
        
        mapping = {
            "voice_messages": "voice_messages_used",
            "text_messages": "text_messages_used",
            "api_calls": "api_calls_used",
            "tokens": "tokens_used",
        }
        
        if usage_type in mapping:
            field = mapping[usage_type]
            setattr(self, field, getattr(self, field) + amount)
            self.save()

    def __str__(self):
        return f"UsageTracking - {self.user.username} ({self.tier})"


class PremiumSubscription(models.Model):
    """Stripe subscription management"""
    SUBSCRIPTION_STATUS = [
        ("free", "Free"),
        ("trial", "Trial"),
        ("active", "Active"),
        ("paused", "Paused"),
        ("cancelled", "Cancelled"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="premium_subscription"
    )
    status = models.CharField(
        max_length=20, choices=SUBSCRIPTION_STATUS, default="free"
    )
    tier = models.CharField(
        max_length=20,
        choices=[
            ("free", "Free"),
            ("premium", "Premium ($9.99/mo)"),
            ("professional", "Professional ($29.99/mo)"),
        ],
        default="free"
    )
    
    # Stripe information
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_subscription_id = models.CharField(max_length=255, blank=True, null=True)
    stripe_payment_method_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Subscription dates
    started_at = models.DateTimeField(null=True, blank=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    
    # Billing
    next_billing_date = models.DateTimeField(null=True, blank=True)
    auto_renew = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Premium Subscriptions"

    def is_active(self):
        """Check if subscription is currently active"""
        if self.status == "free":
            return False
        if self.status == "trial":
            return self.trial_ends_at and self.trial_ends_at > timezone.now()
        return self.status == "active"

    def days_remaining(self):
        """Get days remaining in current period"""
        if not self.current_period_end:
            return None
        delta = self.current_period_end - timezone.now()
        return max(0, delta.days)

    def __str__(self):
        return f"Subscription - {self.user.username} ({self.tier})"


class VoiceToneCustomization(models.Model):
    """Store custom voice tone settings per user"""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="voice_tone_customization"
    )
    
    # Voice properties
    tone = models.CharField(
        max_length=50,
        default="neutral",
        choices=[
            ("neutral", "Neutral"),
            ("friendly", "Friendly"),
            ("professional", "Professional"),
            ("casual", "Casual"),
            ("formal", "Formal"),
            ("enthusiastic", "Enthusiastic"),
            ("empathetic", "Empathetic"),
        ]
    )
    
    # Voice customization
    speaking_rate = models.FloatField(default=1.0)  # 0.5 to 2.0
    pitch = models.FloatField(default=1.0)  # 0.8 to 1.2
    
    # System prompt customization
    custom_system_prompt = models.TextField(
        blank=True,
        help_text="Custom system prompt for voice agent"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Voice Tone Customizations"

    def __str__(self):
        return f"Voice Tone - {self.user.username}"


class RateLimitPolicy(models.Model):
    """Define rate limits per subscription tier"""
    tier = models.CharField(
        max_length=20,
        unique=True,
        choices=[
            ("free", "Free"),
            ("premium", "Premium"),
            ("professional", "Professional"),
        ]
    )
    
    # Monthly limits
    voice_messages_per_month = models.IntegerField(default=10)
    text_messages_per_month = models.IntegerField(default=50)
    api_calls_per_day = models.IntegerField(default=100)
    max_tokens_per_month = models.IntegerField(default=10000)
    
    # Request rate limiting (per minute)
    requests_per_minute = models.IntegerField(default=10)
    
    # Features
    can_use_voice_agent = models.BooleanField(default=True)
    can_use_premium_models = models.BooleanField(default=False)
    can_export_data = models.BooleanField(default=False)
    priority_support = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Rate Limit Policies"

    def __str__(self):
        return f"Policy - {self.tier}"
