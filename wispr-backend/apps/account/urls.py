# apps/auth/urls.py
from django.urls import path
from .views import google_login, me

urlpatterns = [
    path("google/", google_login, name="google-login"),
    path("me/", me, name="me"),
]
