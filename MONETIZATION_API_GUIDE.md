# Wispr Flow Monetization - API Integration Guide

## Quick Start for Testing

### 1. Authenticate First

All premium endpoints require authentication. Get a token:

```bash
curl -X POST http://localhost:8000/api/account/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Response:
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 2. Check Subscription Status

```bash
curl -X GET http://localhost:8000/api/chat/subscription/status/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
{
  "tier": "free",
  "status": "free",
  "is_active": false,
  "days_remaining": 0,
  "usage": {
    "voice_messages": {
      "used": 0,
      "limit": 10,
      "percentage": 0
    },
    "text_messages": {
      "used": 0,
      "limit": 50,
      "percentage": 0
    },
    "api_calls": {
      "used": 0,
      "limit": 100,
      "percentage": 0
    },
    "tokens": {
      "used": 0,
      "limit": 10000,
      "percentage": 0
    }
  }
}
```

### 3. Get Available Models

```bash
curl -X GET http://localhost:8000/api/chat/models/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
{
  "models": [
    {
      "id": "gemini-2.0-flash",
      "name": "Gemini 2.0 Flash",
      "description": "Fastest Gemini model",
      "tier": "free",
      "latency": "200ms",
      "available": true
    },
    {
      "id": "gemini-1.5-pro",
      "name": "Gemini 1.5 Pro",
      "description": "Most capable Gemini model",
      "tier": "premium",
      "latency": "500ms",
      "available": false
    }
  ],
  "current_model": "gemini-2.0-flash",
  "tier": "free"
}
```

### 4. Select an LLM Model

```bash
curl -X POST http://localhost:8000/api/chat/models/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "gemini-2.0-flash",
    "session_id": 123
  }'

# Response:
{
  "success": true,
  "message": "Model selected successfully",
  "model": "gemini-2.0-flash",
  "session_id": 123
}
```

### 5. Get Voice Tone Settings

```bash
curl -X GET http://localhost:8000/api/chat/voice-tone/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
{
  "tone": "neutral",
  "speaking_rate": 1.0,
  "pitch": 1.0,
  "custom_system_prompt": "",
  "available_tones": [
    "neutral",
    "friendly",
    "professional",
    "casual",
    "formal",
    "enthusiastic",
    "empathetic"
  ]
}
```

### 6. Update Voice Tone Settings

```bash
curl -X POST http://localhost:8000/api/chat/voice-tone/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tone": "friendly",
    "speaking_rate": 1.2,
    "pitch": 1.1,
    "custom_system_prompt": "Be more conversational and helpful"
  }'

# Response:
{
  "success": true,
  "message": "Voice settings updated",
  "tone": "friendly",
  "speaking_rate": 1.2,
  "pitch": 1.1,
  "custom_system_prompt": "Be more conversational and helpful"
}
```

### 7. Start Premium Trial

```bash
curl -X POST http://localhost:8000/api/chat/subscription/trial/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "days": 7
  }'

# Response:
{
  "success": true,
  "message": "Trial started",
  "tier": "premium",
  "trial_ends_at": "2024-02-20T10:30:00Z"
}
```

### 8. Create Checkout Session for Premium

```bash
curl -X POST http://localhost:8000/api/chat/subscription/checkout/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "premium"
  }'

# Response:
{
  "success": true,
  "session_id": "cs_test_...",
  "client_secret": "pi_test_...",
  "tier": "premium",
  "amount": 999  # cents
}
```

### 9. Update Payment Method

```bash
curl -X POST http://localhost:8000/api/chat/subscription/payment-method/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method_id": "pm_test_123456"
  }'

# Response:
{
  "success": true,
  "message": "Payment method updated"
}
```

### 10. Cancel Subscription

```bash
curl -X POST http://localhost:8000/api/chat/subscription/cancel/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Response:
{
  "success": true,
  "message": "Subscription cancelled",
  "tier": "free"
}
```

---

## Rate Limiting Behavior

The system automatically enforces rate limits. When exceeded:

```bash
# Request that exceeds limit returns:
HTTP/1.1 429 Too Many Requests

{
  "error": "Rate limit exceeded",
  "retry_after": 3600,
  "limit": 10,
  "remaining": 0,
  "reset_at": "2024-02-16T12:00:00Z"
}
```

---

## Frontend Integration Example

```javascript
// In React component
import { useEffect, useState } from "react";
import ModelSelector from "./components/ModelSelector";
import VoiceToneCustomizer from "./components/VoiceToneCustomizer";
import SubscriptionStatus from "./components/SubscriptionStatus";

export default function PremiumFeatures() {
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    // Fetch subscription status on mount
    fetch("http://localhost:8000/api/chat/subscription/status/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    })
      .then((r) => r.json())
      .then((data) => setSubscription(data))
      .catch((err) => console.error("Failed to load subscription:", err));
  }, []);

  return (
    <div className="premium-features">
      <SubscriptionStatus subscription={subscription} />
      <ModelSelector />
      <VoiceToneCustomizer />
    </div>
  );
}
```

---

## Error Handling

Common errors and solutions:

| Error                 | Reason               | Solution                       |
| --------------------- | -------------------- | ------------------------------ |
| 401 Unauthorized      | No token or expired  | Re-login to get fresh token    |
| 429 Too Many Requests | Rate limit exceeded  | Wait for reset time            |
| 402 Payment Required  | Subscription expired | Renew subscription             |
| 422 Unprocessable     | Invalid model tier   | Check user's subscription tier |
| 500 Internal Server   | Stripe API error     | Check Stripe keys in .env      |

---

## Testing with Stripe Test Mode

Use these test card numbers:

```
✅ Successful Payment:
  Card: 4242 4242 4242 4242
  Expiry: Any future date
  CVC: Any 3 digits
  ZIP: Any 5 digits

❌ Declined Payment:
  Card: 4000 0000 0000 0002
  Expiry: Any future date
  CVC: Any 3 digits

🔐 Requires Authentication:
  Card: 4000 0025 0000 3155
  Expiry: Any future date
  CVC: Any 3 digits
  2FA Code: 123456
```

---

## Webhook Testing (Local)

To test webhooks locally, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/api/chat/stripe/webhook/

# Trigger test event
stripe trigger customer.subscription.updated
```

---

## Database Queries

### Check User's Subscription

```python
from django.contrib.auth.models import User
from apps.Chat.models import PremiumSubscription, UsageTracking

user = User.objects.get(pk=1)

# Get subscription
sub = PremiumSubscription.objects.get(user=user)
print(f"Tier: {sub.tier}, Status: {sub.status}")

# Get usage
usage = UsageTracking.objects.get(user=user)
print(f"Voice messages: {usage.voice_messages_used}/{usage.voice_messages_limit}")
```

### Reset User to Free Trial

```python
from apps.Chat.models import PremiumSubscription, UsageTracking

user = User.objects.get(pk=1)
sub = PremiumSubscription.objects.get(user=user)
sub.tier = 'free'
sub.status = 'free'
sub.save()

usage = UsageTracking.objects.get(user=user)
usage.tier = 'free'
usage.voice_messages_limit = 10
usage.text_messages_limit = 50
usage.api_calls_limit = 100
usage.tokens_limit = 10000
usage.save()
```

---

## Monitoring

### Check Rate Limiting

```bash
# Monitor rate limit hits
grep "Rate limit" /var/log/django.log | tail -20

# Real-time monitoring
tail -f /var/log/django.log | grep -i rate
```

### Check Stripe Events

```python
from apps.Chat.models import PremiumSubscription
import json

# Find recent Stripe events
subs = PremiumSubscription.objects.filter(
    updated_at__gte=datetime.now() - timedelta(hours=1)
)

for sub in subs:
    print(f"User: {sub.user.username}, Tier: {sub.tier}, Status: {sub.status}")
```

---

## Production Checklist

- [ ] Replace STRIPE_SECRET_KEY with production key
- [ ] Replace STRIPE_PUBLIC_KEY with production key
- [ ] Update STRIPE_WEBHOOK_SECRET for production
- [ ] Enable HTTPS for all endpoints
- [ ] Allowlist Stripe IP addresses for webhooks
- [ ] Set DEBUG = False in settings.py
- [ ] Enable CSRF protection on all endpoints
- [ ] Test payment flow end-to-end
- [ ] Set up monitoring/logging
- [ ] Configure email notifications for billing events
- [ ] Create backup/restore procedures
- [ ] Document all pricing changes

---

## Support

For issues or questions:

1. Check rate_limiting.py for rate limit implementation
2. Check stripe_service.py for Stripe integration details
3. Check premium_views.py for API endpoint implementation
4. Review Stripe documentation: https://stripe.com/docs
