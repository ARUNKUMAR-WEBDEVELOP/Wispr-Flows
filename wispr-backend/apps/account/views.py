# apps/account/views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.conf import settings

from google.oauth2 import id_token
from google.auth.transport import requests
from google.auth.exceptions import GoogleAuthError

from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import GoogleAuthSerializer

def get_tokens_for_user(user):
    """Generate JWT tokens for authenticated user"""
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }

@api_view(["POST"])
@permission_classes([AllowAny])
def google_login(request):
    """
    Google OAuth login endpoint.
    Expects: { "token": "google_id_token" }
    """
    try:
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data["token"]

        # Verify Google ID token
        try:
            idinfo = id_token.verify_oauth2_token(
                token,
                requests.Request()
            )
        except ValueError as e:
            # Token verification failed
            print(f"Token verification error: {e}")
            return Response(
                {"error": f"Invalid Google token: {str(e)}"},
                status=401
            )

        # Get user information from token
        email = idinfo.get("email")
        name = idinfo.get("name", "")
        picture = idinfo.get("picture", "")
        
        # Validate required fields
        if not email:
            return Response(
                {"error": "Email not provided by Google"},
                status=400
            )

        # Create or get user
        try:
            user, created = User.objects.get_or_create(
                username=email,
                defaults={
                    "email": email,
                    "first_name": name,
                    "is_active": True
                }
            )
            
            # Update user info if it changed
            if not created:
                user.first_name = name
                user.save()

        except Exception as e:
            print(f"User creation error: {e}")
            return Response(
                {"error": f"Failed to create/update user: {str(e)}"},
                status=500
            )

        # Generate tokens
        tokens = get_tokens_for_user(user)

        return Response({
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.first_name,
                "avatar": picture
            },
            "tokens": tokens
        }, status=200)
        
    except Exception as e:
        print(f"Unexpected error in google_login: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": f"Server error: {str(e)}"},
            status=500
        )

    try:
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": name,
                "is_active": True
            }
        )
        
        # Update user info if it changed
        if not created:
            user.first_name = name
            user.save()

    except Exception as e:
        return Response(
            {"error": f"Failed to create/update user: {str(e)}"},
            status=500
        )

    tokens = get_tokens_for_user(user)

    return Response({
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.first_name,
            "avatar": picture
        },
        "tokens": tokens
    }, status=200)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Get current authenticated user profile"""
    user = request.user
    return Response({
        "id": user.id,
        "email": user.email,
        "name": user.first_name,
        "is_authenticated": True
    }, status=200)
