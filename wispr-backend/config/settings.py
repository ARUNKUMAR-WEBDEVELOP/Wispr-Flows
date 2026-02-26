from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv
from corsheaders.defaults import default_headers, default_methods

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / ".env")

# --------------------
# SECURITY
# --------------------
SECRET_KEY = "dev-secret-key-change-in-prod"
DEBUG = True

ALLOWED_HOSTS = [
    "wispr-flows-3adt.onrender.com",
    ".onrender.com","localhost", "127.0.0.1"]

# --------------------
# INSTALLED APPS
# --------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third-party
    "rest_framework",
    "corsheaders",
    "channels",

    # Local apps
    "apps.account",
    "apps.Chat",
    "apps.speech",
]

# --------------------
# MIDDLEWARE
# --------------------
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "apps.Chat.rate_limiting.RateLimitMiddleware",
]

# --------------------
# CORS (Frontend Access)
# --------------------
# In production, use specific origins
# In development, can be more permissive
import os

ENV = os.getenv("ENV", "development")

if ENV == "production":
    CORS_ALLOWED_ORIGINS = [
        "https://arunkumar-webdevelop.github.io",
        "https://wispr-flows-3adt.onrender.com",
    ]
else:
    # Development: allow localhost and all standard ports
    CORS_ALLOWED_ORIGINS = [
        "https://arunkumar-webdevelop.github.io",
        "https://wispr-flows-3adt.onrender.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

CORS_ALLOW_CREDENTIALS = True

# Comprehensive headers list
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "accept-language",
    "authorization",
    "cache-control",
    "content-length",
    "content-type",
    "dnt",
    "origin",
    "pragma",
    "referer",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "HEAD",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

CORS_EXPOSE_HEADERS = [
    "Content-Length",
    "Content-Type",
    "X-CSRFToken",
    "Authorization",
]

# Preflight cache time
CORS_PREFLIGHT_MAX_AGE = 3600

CSRF_TRUSTED_ORIGINS = [
    "https://arunkumar-webdevelop.github.io",
    "https://wispr-flows-3adt.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Allow Google OAuth popup
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin-allow-popups"

# Session security - relax for cross-origin
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"


# --------------------
# URL / WSGI / ASGI
# --------------------
ROOT_URLCONF = "config.urls"

ASGI_APPLICATION = "config.asgi.application"

# --------------------
# CHANNELS (WebSockets)
# --------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

# --------------------
# DATABASE
# --------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# --------------------
# AUTH / JWT
# --------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
    "EXCEPTION_HANDLER": "rest_framework.views.exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Disable login redirect for REST API
LOGIN_URL = None
LOGIN_REDIRECT_URL = "/"

# --------------------
# TEMPLATES
# --------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --------------------
# STATIC FILES
# --------------------
STATIC_URL = "/static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------
# API KEYS (ENV BASED)
# --------------------
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# --------------------
# STRIPE PAYMENT CONFIGURATION
# --------------------
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_dummy")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_dummy")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy")

# Stripe Price IDs (created in Stripe Dashboard)
STRIPE_PREMIUM_PRICE_ID = os.getenv("STRIPE_PREMIUM_PRICE_ID", "price_dummy_premium")
STRIPE_PROFESSIONAL_PRICE_ID = os.getenv("STRIPE_PROFESSIONAL_PRICE_ID", "price_dummy_pro")

# --------------------
# LOGGING
# --------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{levelname}] {asctime} {name} - {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO",
    },
    "loggers": {
        "config.cors_middleware": {
            "level": "DEBUG",
            "handlers": ["console"],
            "propagate": False,
        },
        "apps.account.views": {
            "level": "DEBUG",
            "handlers": ["console"],
            "propagate": False,
        },
    },
}