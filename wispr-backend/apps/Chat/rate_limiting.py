"""
Rate limiting utilities for API endpoints
Tracks usage and enforces limits based on subscription tier
"""

from functools import wraps
from django.http import JsonResponse
from django.utils import timezone
from datetime import timedelta
import time
from .models import UsageTracking


class RateLimitExceeded(Exception):
    """Raised when user exceeds rate limit"""
    def __init__(self, message, retry_after=None):
        self.message = message
        self.retry_after = retry_after
        super().__init__(self.message)


def rate_limit_required(usage_type="api_calls"):
    """
    Decorator to enforce rate limits on API endpoints
    
    Args:
        usage_type: "voice_messages", "text_messages", "api_calls", or "tokens"
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse(
                    {"error": "Authentication required"},
                    status=401
                )
            
            try:
                usage = UsageTracking.objects.get(user=request.user)
            except UsageTracking.DoesNotExist:
                # Create default tracking for new users
                usage = UsageTracking.objects.create(user=request.user, tier="free")
            
            # Check if within limits
            if not usage.is_within_limits(usage_type):
                # Get limit info
                limit_field = f"{usage_type}_limit"
                limit = getattr(usage, limit_field, 0)
                return JsonResponse(
                    {
                        "error": f"Rate limit exceeded for {usage_type}",
                        "limit": limit,
                        "reset_date": usage.last_reset + timedelta(days=30),
                        "upgrade_url": "/premium"
                    },
                    status=429  # Too Many Requests
                )
            
            try:
                # Process the request
                response = view_func(request, *args, **kwargs)
                
                # Increment usage after successful request
                usage.increment_usage(usage_type, amount=1)
                
                return response
            except Exception as e:
                return JsonResponse(
                    {"error": str(e)},
                    status=500
                )
        
        return wrapper
    return decorator


def track_token_usage(token_amount):
    """
    Decorator to track token usage (for LLM calls)
    
    Args:
        token_amount: Number of tokens to track
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if request.user.is_authenticated:
                try:
                    usage = UsageTracking.objects.get(user=request.user)
                    
                    # Check token limit
                    if not usage.is_within_limits("tokens"):
                        return JsonResponse(
                            {
                                "error": "Token limit exceeded",
                                "limit": usage.tokens_limit,
                                "used": usage.tokens_used
                            },
                            status=429
                        )
                except UsageTracking.DoesNotExist:
                    usage = UsageTracking.objects.create(user=request.user)
            
            # Process request
            response = view_func(request, *args, **kwargs)
            
            # Track tokens after successful response
            if request.user.is_authenticated:
                usage.increment_usage("tokens", amount=token_amount)
            
            return response
        
        return wrapper
    return decorator


class RateLimitMiddleware:
    """
    Middleware to enforce per-minute request rate limits
    """
    def __init__(self, get_response):
        self.get_response = get_response
        # In-memory request tracking (in production, use Redis)
        self.request_log = {}

    def __call__(self, request):
        if request.user.is_authenticated:
            user_id = request.user.id
            current_minute = timezone.now().replace(second=0, microsecond=0)
            key = f"{user_id}:{current_minute}"
            
            # Initialize or increment request count
            if key not in self.request_log:
                self.request_log[key] = 0
            
            self.request_log[key] += 1
            
            # Get user's limit
            try:
                usage = UsageTracking.objects.get(user=request.user)
                limit = usage.voice_messages_limit  # Use messages limit as default
            except UsageTracking.DoesNotExist:
                limit = 10  # Default free tier limit
            
            # Check if exceeds per-minute rate
            if self.request_log[key] > limit:
                return JsonResponse(
                    {
                        "error": "Rate limit exceeded",
                        "retry_after": 60,
                        "message": f"Maximum {limit} requests per minute"
                    },
                    status=429
                )
            
            # Cleanup old entries (older than 1 hour)
            cutoff = current_minute - timedelta(hours=1)
            self.request_log = {
                k: v for k, v in self.request_log.items()
                if k.split(":")[1] > str(cutoff)
            }
        
        response = self.get_response(request)
        return response
