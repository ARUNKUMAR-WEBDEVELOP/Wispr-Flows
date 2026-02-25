"""
Custom CORS middleware to ensure CORS headers are properly sent.
This supplements django-cors-headers for edge cases (like Render.com proxies).
"""

from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class CustomCORSMiddleware:
    """
    Add CORS headers to all responses, especially important for preflight OPTIONS requests.
    Works in conjunction with django-cors-headers middleware.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
        logger.info(f"[CORS Middleware] Initialized with allowed origins: {self.allowed_origins}")

    def __call__(self, request):
        # Get the origin from the request
        origin = request.META.get("HTTP_ORIGIN", "")
        
        # Log all requests for debugging
        if origin:
            logger.debug(f"[CORS Middleware] Request from origin: {origin}")

        # Check if origin is allowed
        is_allowed = origin in self.allowed_origins

        if not is_allowed and origin:
            logger.warning(f"[CORS Middleware] Origin not allowed: {origin}")

        response = self.get_response(request)

        # Add CORS headers if origin is allowed
        if is_allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response["Access-Control-Allow-Headers"] = (
                "accept, accept-encoding, authorization, content-type, dnt, "
                "origin, user-agent, x-csrftoken, x-requested-with"
            )
            response["Access-Control-Expose-Headers"] = "Content-Type, X-CSRFToken, Authorization"
            response["Access-Control-Max-Age"] = "3600"
            
            logger.debug(f"[CORS Middleware] CORS headers added for origin: {origin}")

        # Handle preflight OPTIONS requests
        if request.method == "OPTIONS" and is_allowed:
            response.status_code = 200
            response["Content-Length"] = "0"
            logger.debug(f"[CORS Middleware] Handled preflight OPTIONS request from {origin}")

        return response

