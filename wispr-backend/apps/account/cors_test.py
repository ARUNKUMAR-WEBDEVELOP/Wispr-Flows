from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET", "OPTIONS"])
@permission_classes([AllowAny])
def cors_test(request):
    """
    Test endpoint to verify CORS headers are being sent correctly.
    Useful for debugging CORS issues.
    """
    if request.method == "OPTIONS":
        return Response(status=200)

    # Get request details
    cors_info = {
        "request_origin": request.META.get("HTTP_ORIGIN", "not provided"),
        "request_method": request.method,
        "allowed_origins": [
            "https://arunkumar-webdevelop.github.io",
            "https://wispr-flows-3adt.onrender.com",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
        "message": "If your origin is in allowed_origins, CORS headers should be sent in the response headers.",
        "test_instructions": {
            "step_1": "Open DevTools (F12)",
            "step_2": "Go to Network tab",
            "step_3": "Make a request to this endpoint",
            "step_4": "Check the Response Headers for 'Access-Control-Allow-Origin'",
        },
    }

    return Response(cors_info, status=200)
