"""
API views for premium features, subscriptions, and monetization
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import json
import logging

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.utils import timezone
from django.conf import settings

from .models import (
    ChatSession,
    UsageTracking,
    PremiumSubscription,
    VoiceToneCustomization,
    RateLimitPolicy,
)
from .stripe_service import StripeService
from .rate_limiting import rate_limit_required

logger = logging.getLogger(__name__)


class SubscriptionStatusView(APIView):
    """Get current subscription status for user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get subscription status and usage"""
        status_info = StripeService.get_subscription_status(request.user)
        
        try:
            usage = UsageTracking.objects.get(user=request.user)
            status_info["usage"] = {
                "voice_messages": {
                    "used": usage.voice_messages_used,
                    "limit": usage.voice_messages_limit,
                    "percentage": (usage.voice_messages_used / usage.voice_messages_limit * 100
                                   if usage.voice_messages_limit > 0 else 0),
                },
                "text_messages": {
                    "used": usage.text_messages_used,
                    "limit": usage.text_messages_limit,
                    "percentage": (usage.text_messages_used / usage.text_messages_limit * 100
                                   if usage.text_messages_limit > 0 else 0),
                },
                "api_calls": {
                    "used": usage.api_calls_used,
                    "limit": usage.api_calls_limit,
                    "percentage": (usage.api_calls_used / usage.api_calls_limit * 100
                                   if usage.api_calls_limit > 0 else 0),
                },
                "tokens": {
                    "used": usage.tokens_used,
                    "limit": usage.tokens_limit,
                    "percentage": (usage.tokens_used / usage.tokens_limit * 100
                                   if usage.tokens_limit > 0 else 0),
                },
                "reset_date": usage.last_reset.isoformat(),
            }
        except UsageTracking.DoesNotExist:
            usage = UsageTracking.objects.create(user=request.user, tier="free")
            status_info["usage"] = {
                "voice_messages": {"used": 0, "limit": 10, "percentage": 0},
                "text_messages": {"used": 0, "limit": 50, "percentage": 0},
                "api_calls": {"used": 0, "limit": 100, "percentage": 0},
                "tokens": {"used": 0, "limit": 10000, "percentage": 0},
                "reset_date": usage.last_reset.isoformat(),
            }

        return Response(status_info)


class CreateCheckoutSessionView(APIView):
    """Create Stripe checkout session for subscription"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create checkout session"""
        tier = request.data.get("tier", "premium")
        
        if tier not in ["premium", "professional"]:
            return Response(
                {"error": "Invalid tier"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # In production, use stripe.checkout.Session.create()
            # For now, create subscription directly
            subscription = StripeService.create_subscription(request.user, tier=tier)
            
            return Response(
                {
                    "status": "success",
                    "subscription_id": subscription.id,
                    "tier": tier,
                    "message": "Subscription created successfully",
                }
            )
        except Exception as e:
            logger.error(f"Checkout error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class CancelSubscriptionView(APIView):
    """Cancel user's subscription"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Cancel subscription"""
        try:
            success = StripeService.cancel_subscription(request.user)
            
            if success:
                # Reset to free tier
                usage = UsageTracking.objects.get(user=request.user)
                usage.tier = "free"
                usage.voice_messages_limit = 10
                usage.text_messages_limit = 50
                usage.api_calls_limit = 100
                usage.tokens_limit = 10000
                usage.save()
                
                return Response(
                    {
                        "status": "success",
                        "message": "Subscription cancelled",
                    }
                )
            else:
                return Response(
                    {"error": "No active subscription"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.error(f"Cancellation error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class UpdatePaymentMethodView(APIView):
    """Update payment method for subscription"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Update payment method"""
        payment_method_id = request.data.get("payment_method_id")
        
        if not payment_method_id:
            return Response(
                {"error": "payment_method_id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            success = StripeService.update_payment_method(request.user, payment_method_id)
            
            if success:
                return Response(
                    {
                        "status": "success",
                        "message": "Payment method updated",
                    }
                )
            else:
                return Response(
                    {"error": "Failed to update payment method"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception as e:
            logger.error(f"Payment method update error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class StartTrialView(APIView):
    """Start free trial for user"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Start trial"""
        days = request.data.get("days", 7)
        
        try:
            subscription = StripeService.start_trial(request.user, days=days)
            
            return Response(
                {
                    "status": "success",
                    "tier": "premium",
                    "trial_ends_at": subscription.trial_ends_at.isoformat(),
                    "message": f"Trial started for {days} days",
                }
            )
        except Exception as e:
            logger.error(f"Trial start error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ModelSelectionView(APIView):
    """Get available LLM models and select default"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get available models based on subscription tier"""
        try:
            subscription = StripeService.get_subscription_status(request.user)
            is_premium = subscription.get("is_active", False)
            
            models = [
                {
                    "id": "gemini-2.0-flash",
                    "name": "Gemini 2.0 Flash",
                    "description": "Fast, efficient model for quick responses",
                    "tier": "free",
                    "category": "fast",
                    "latency": "~2s",
                },
                {
                    "id": "gemini-1.5-pro",
                    "name": "Gemini 1.5 Pro",
                    "description": "Advanced reasoning with better accuracy",
                    "tier": "premium",
                    "category": "advanced",
                    "latency": "~5s",
                    "available": is_premium,
                },
                {
                    "id": "gpt-4-turbo",
                    "name": "GPT-4 Turbo",
                    "description": "Premium model for complex tasks",
                    "tier": "professional",
                    "category": "professional",
                    "latency": "~8s",
                    "available": is_premium,
                },
            ]
            
            # Filter based on tier
            if not is_premium:
                models = [m for m in models if m["tier"] == "free"]
            
            # Get user's current selection
            try:
                current_session = ChatSession.objects.filter(
                    user=request.user
                ).latest("created_at")
                current_model = current_session.llm_model
            except ChatSession.DoesNotExist:
                current_model = "gemini-2.0-flash"
            
            return Response(
                {
                    "models": models,
                    "current_model": current_model,
                    "tier": subscription.get("tier"),
                }
            )
        except Exception as e:
            logger.error(f"Model selection error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def post(self, request):
        """Select LLM model for session"""
        model_id = request.data.get("model_id")
        session_id = request.data.get("session_id")
        
        if not model_id:
            return Response(
                {"error": "model_id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_models = ["gemini-2.0-flash", "gemini-1.5-pro", "gpt-4-turbo"]
        if model_id not in valid_models:
            return Response(
                {"error": "Invalid model"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if session_id:
                session = ChatSession.objects.get(id=session_id, user=request.user)
                session.llm_model = model_id
                session.save()
            
            return Response(
                {
                    "status": "success",
                    "model": model_id,
                    "message": "Model selected",
                }
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )


class VoiceToneView(APIView):
    """Manage voice tone customization"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current voice tone settings"""
        try:
            tone = VoiceToneCustomization.objects.get(user=request.user)
        except VoiceToneCustomization.DoesNotExist:
            tone = VoiceToneCustomization.objects.create(user=request.user)
        
        return Response(
            {
                "tone": tone.tone,
                "speaking_rate": tone.speaking_rate,
                "pitch": tone.pitch,
                "custom_system_prompt": tone.custom_system_prompt,
                "available_tones": [
                    "neutral",
                    "friendly",
                    "professional",
                    "casual",
                    "formal",
                    "enthusiastic",
                    "empathetic",
                ],
            }
        )

    def post(self, request):
        """Update voice tone settings"""
        try:
            tone, _ = VoiceToneCustomization.objects.get_or_create(user=request.user)
            
            # Update fields
            if "tone" in request.data:
                tone.tone = request.data["tone"]
            if "speaking_rate" in request.data:
                tone.speaking_rate = request.data["speaking_rate"]
            if "pitch" in request.data:
                tone.pitch = request.data["pitch"]
            if "custom_system_prompt" in request.data:
                tone.custom_system_prompt = request.data["custom_system_prompt"]
            
            tone.save()
            
            return Response(
                {
                    "status": "success",
                    "tone": tone.tone,
                    "speaking_rate": tone.speaking_rate,
                    "pitch": tone.pitch,
                }
            )
        except Exception as e:
            logger.error(f"Voice tone update error: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


@csrf_exempt
def stripe_webhook(request):
    """Handle Stripe webhook events"""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        payload = request.body
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")
        
        import stripe
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            settings.STRIPE_WEBHOOK_SECRET,
        )
        
        # Handle event
        StripeService.handle_webhook(event)
        
        return JsonResponse({"status": "success"})
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        return JsonResponse(
            {"error": str(e)},
            status=400,
        )
