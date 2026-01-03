from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from .tts import text_to_speech as tts_convert


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def text_to_speech(request):
    """
    REST endpoint for text-to-speech conversion.
    Expects JSON payload with 'text' and optional 'language'.
    
    Example:
    {
        "text": "Hello world",
        "language": "en"
    }
    """
    try:
        text = request.data.get("text")
        language = request.data.get("language", "en")
        
        if not text or not text.strip():
            return Response(
                {"error": "Text field is required and cannot be empty"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Call Deepgram TTS
        try:
            audio_bytes = tts_convert(text.strip(), language)
        except Exception as tts_err:
            print(f"TTS conversion error: {tts_err}")
            return Response(
                {"error": f"TTS conversion failed: {str(tts_err)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        if not audio_bytes:
            return Response(
                {"error": "No audio data generated"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            "audio": audio_bytes.hex(),
            "text": text,
            "language": language
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        print(f"TTS endpoint error: {e}")
        import traceback
        traceback.print_exc()
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def transcribe_audio(request):
    """
    REST endpoint for speech-to-text transcription.
    Expects multipart/form-data with 'audio' file.
    
    This is a REST fallback. For real-time streaming, use WebSocket at ws/speech/
    """
    try:
        audio_file = request.FILES.get("audio")
        
        if not audio_file:
            return Response(
                {"error": "Audio file is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Read audio bytes
        audio_bytes = audio_file.read()
        
        # TODO: Implement actual transcription logic using Deepgram
        # For now, return a placeholder
        
        return Response({
            "text": "Transcription placeholder",
            "language": "en",
            "audio_size": len(audio_bytes)
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
