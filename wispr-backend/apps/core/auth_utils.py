from django.contrib.auth.models import User
from django.conf import settings
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken


def verify_google_token(token: str):
    """
    Verifies Google ID token and returns user info.
    """

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )

        return {
            "email": idinfo.get("email"),
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "google_id": idinfo.get("sub"),
        }

    except Exception:
        return None


def get_or_create_user(user_data: dict):
    """
    Creates or fetches Django user from Google account.
    """

    email = user_data["email"]

    user, created = User.objects.get_or_create(
        username=email,
        defaults={
            "email": email,
            "first_name": user_data.get("name", ""),
        }
    )

    return user


def generate_jwt_tokens(user: User):
    """
    Generates JWT access + refresh tokens.
    """

    refresh = RefreshToken.for_user(user)

    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }
