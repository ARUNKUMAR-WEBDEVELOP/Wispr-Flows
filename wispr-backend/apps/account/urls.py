# apps/auth/urls.py
from django.urls import path
from .views import google_login, me
from .cors_test import cors_test

urlpatterns = [
    path("google/", google_login, name="google-login"),
    path("me/", me, name="me"),
    path("cors-test/", cors_test, name="cors-test"),  # CORS debugging endpoint
]
