"""
Stripe payment integration for Wispr Flow premium subscriptions
Handles customer creation, payment methods, and subscription management
"""

import stripe
import logging
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class StripeService:
    """Service for managing Stripe payments and subscriptions"""

    PRICING_TIERS = {
        "premium": {
            "price_id": settings.STRIPE_PREMIUM_PRICE_ID,
            "amount": 999,  # $9.99 in cents
            "currency": "usd",
            "interval": "month",
            "voice_messages_limit": 100,
            "text_messages_limit": 500,
            "api_calls_limit": 1000,
        },
        "professional": {
            "price_id": settings.STRIPE_PROFESSIONAL_PRICE_ID,
            "amount": 2999,  # $29.99 in cents
            "currency": "usd",
            "interval": "month",
            "voice_messages_limit": 1000,
            "text_messages_limit": 5000,
            "api_calls_limit": 10000,
        },
    }

    @staticmethod
    def create_customer(user):
        """Create or retrieve Stripe customer for user"""
        from .models import PremiumSubscription

        try:
            subscription = PremiumSubscription.objects.get(user=user)
            if subscription.stripe_customer_id:
                return subscription.stripe_customer_id
        except PremiumSubscription.DoesNotExist:
            pass

        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.get_full_name() or user.username,
                metadata={"user_id": user.id},
            )
            
            # Save customer ID
            subscription, _ = PremiumSubscription.objects.get_or_create(user=user)
            subscription.stripe_customer_id = customer.id
            subscription.save()
            
            return customer.id
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {str(e)}")
            raise

    @staticmethod
    def create_payment_intent(user, amount, tier="premium"):
        """Create payment intent for one-time purchase"""
        customer_id = StripeService.create_customer(user)
        
        try:
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency="usd",
                customer=customer_id,
                metadata={
                    "user_id": user.id,
                    "tier": tier,
                },
            )
            return intent
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create payment intent: {str(e)}")
            raise

    @staticmethod
    def create_subscription(user, tier="premium"):
        """Create Stripe subscription for user"""
        from .models import PremiumSubscription, UsageTracking

        if tier not in StripeService.PRICING_TIERS:
            raise ValueError(f"Invalid tier: {tier}")

        pricing = StripeService.PRICING_TIERS[tier]
        customer_id = StripeService.create_customer(user)

        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": pricing["price_id"]}],
                metadata={
                    "user_id": user.id,
                    "tier": tier,
                },
                payment_settings={
                    "save_default_payment_method": "on_subscription",
                },
            )

            # Update premium subscription record
            prem_sub, _ = PremiumSubscription.objects.get_or_create(user=user)
            prem_sub.stripe_subscription_id = subscription.id
            prem_sub.status = "active"
            prem_sub.tier = tier
            prem_sub.started_at = timezone.now()
            prem_sub.current_period_end = timezone.now() + timedelta(days=30)
            prem_sub.next_billing_date = prem_sub.current_period_end
            prem_sub.save()

            # Update usage tracking with new limits
            usage, _ = UsageTracking.objects.get_or_create(user=user)
            usage.tier = tier
            usage.voice_messages_limit = pricing["voice_messages_limit"]
            usage.text_messages_limit = pricing["text_messages_limit"]
            usage.api_calls_limit = pricing["api_calls_limit"]
            usage.save()

            logger.info(
                f"Subscription created for user {user.id} - tier: {tier}"
            )
            return subscription

        except stripe.error.StripeError as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            raise

    @staticmethod
    def cancel_subscription(user, immediate=False):
        """Cancel user's subscription"""
        from .models import PremiumSubscription

        try:
            subscription = PremiumSubscription.objects.get(user=user)
            if not subscription.stripe_subscription_id:
                return False

            stripe.Subscription.delete(subscription.stripe_subscription_id)

            # Update record
            subscription.status = "cancelled"
            subscription.cancelled_at = timezone.now()
            subscription.save()

            logger.info(f"Subscription cancelled for user {user.id}")
            return True

        except PremiumSubscription.DoesNotExist:
            return False
        except stripe.error.StripeError as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            raise

    @staticmethod
    def update_payment_method(user, payment_method_id):
        """Update user's default payment method"""
        from .models import PremiumSubscription

        try:
            subscription = PremiumSubscription.objects.get(user=user)
            if not subscription.stripe_customer_id:
                return False

            # Attach payment method to customer
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=subscription.stripe_customer_id,
            )

            # Set as default
            stripe.Customer.modify(
                subscription.stripe_customer_id,
                invoice_settings={"default_payment_method": payment_method_id},
            )

            subscription.stripe_payment_method_id = payment_method_id
            subscription.save()

            return True

        except PremiumSubscription.DoesNotExist:
            return False
        except stripe.error.StripeError as e:
            logger.error(f"Failed to update payment method: {str(e)}")
            raise

    @staticmethod
    def handle_webhook(event):
        """Handle Stripe webhook events"""
        from .models import PremiumSubscription

        event_type = event["type"]

        if event_type == "customer.subscription.updated":
            data = event["data"]["object"]
            user_id = data["metadata"].get("user_id")
            
            if user_id:
                try:
                    subscription = PremiumSubscription.objects.get(user_id=user_id)
                    subscription.stripe_subscription_id = data["id"]
                    subscription.current_period_end = timezone.datetime.fromtimestamp(
                        data["current_period_end"]
                    )
                    subscription.save()
                except PremiumSubscription.DoesNotExist:
                    pass

        elif event_type == "customer.subscription.deleted":
            data = event["data"]["object"]
            user_id = data["metadata"].get("user_id")
            
            if user_id:
                try:
                    subscription = PremiumSubscription.objects.get(user_id=user_id)
                    subscription.status = "cancelled"
                    subscription.cancelled_at = timezone.now()
                    subscription.save()
                except PremiumSubscription.DoesNotExist:
                    pass

        elif event_type == "invoice.payment_succeeded":
            data = event["data"]["object"]
            customer_id = data["customer"]
            
            try:
                subscription = PremiumSubscription.objects.get(
                    stripe_customer_id=customer_id
                )
                subscription.status = "active"
                subscription.next_billing_date = timezone.datetime.fromtimestamp(
                    data["next_payment_attempt"]
                    if data.get("next_payment_attempt")
                    else timezone.now().timestamp() + (30 * 24 * 60 * 60)
                )
                subscription.save()
            except PremiumSubscription.DoesNotExist:
                pass

        elif event_type == "invoice.payment_failed":
            data = event["data"]["object"]
            customer_id = data["customer"]
            
            try:
                subscription = PremiumSubscription.objects.get(
                    stripe_customer_id=customer_id
                )
                subscription.status = "paused"
                subscription.save()
                logger.warning(
                    f"Payment failed for subscription {subscription.id}"
                )
            except PremiumSubscription.DoesNotExist:
                pass

    @staticmethod
    def get_subscription_status(user):
        """Get current subscription status for user"""
        from .models import PremiumSubscription

        try:
            subscription = PremiumSubscription.objects.get(user=user)
            return {
                "tier": subscription.tier,
                "status": subscription.status,
                "is_active": subscription.is_active(),
                "days_remaining": subscription.days_remaining(),
                "started_at": subscription.started_at,
                "next_billing_date": subscription.next_billing_date,
            }
        except PremiumSubscription.DoesNotExist:
            return {
                "tier": "free",
                "status": "free",
                "is_active": False,
                "days_remaining": None,
            }

    @staticmethod
    def start_trial(user, days=7):
        """Start free trial for user"""
        from .models import PremiumSubscription

        try:
            subscription, _ = PremiumSubscription.objects.get_or_create(user=user)
            subscription.status = "trial"
            subscription.trial_ends_at = timezone.now() + timedelta(days=days)
            subscription.started_at = timezone.now()
            subscription.save()
            return subscription
        except Exception as e:
            logger.error(f"Failed to start trial: {str(e)}")
            raise
