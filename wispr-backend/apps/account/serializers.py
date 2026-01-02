# apps/account/serializers.py
from rest_framework import serializers


class GoogleAuthSerializer(serializers.Serializer):
    token = serializers.CharField(required=True, min_length=10)
    
    def validate_token(self, value):
        """Validate that token is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Token cannot be empty")
        return value
