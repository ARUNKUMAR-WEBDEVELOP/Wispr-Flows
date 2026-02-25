"""
Custom CORS middleware to supplement django-cors-headers.
This is a fallback for edge cases where CORS headers might not be sent.
"""

from django.conf import settings


class CustomCORSMiddleware:
    """
    Add CORS headers to all responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])

    def __call__(self, request):
        # Get the origin from the request
        origin = request.META.get("HTTP_ORIGIN", "")

        # Check if origin is allowed
        is_allowed = origin in self.allowed_origins

        # Get the response from the next middleware/view
        response = self.get_response(request)

        # Add CORS headers if origin is allowed
        if is_allowed and origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = (
                "accept, accept-encoding, authorization, content-type, dnt, "
                "origin, user-agent, x-csrftoken, x-requested-with"
            )
            response["Access-Control-Expose-Headers"] = "Content-Type, X-CSRFToken, Authorization"
            response["Access-Control-Max-Age"] = "3600"

        # Always allow OPTIONS requests
        if request.method == "OPTIONS" and is_allowed:
            response.status_code = 200
            response["Content-Length"] = "0"

        return response


