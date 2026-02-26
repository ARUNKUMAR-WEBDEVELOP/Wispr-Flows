from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import ChatSession, ChatMessage

# ...existing code...

# New: Chat history view for logged-in users
class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        data = []
        for session in sessions:
            messages = session.messages.order_by('created_at').values('role', 'content', 'created_at')
            data.append({
                'session_id': session.id,
                'title': session.title,
                'created_at': session.created_at,
                'messages': list(messages)
            })
        return Response({'sessions': data})
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.http import StreamingHttpResponse
from django.db.models import Q

from .models import ChatSession, ChatMessage, VoiceAgentTrainingData
from .streaming import stream_ai_response
from .voice_agent import stream_voice_agent_response


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    print(f"[Chat Debug] Authorization header: {request.headers.get('Authorization')}")
    """
    Simple endpoint to ask AI a question.
    Expects: { "message": "...", "language": "auto" }
    """
    try:
        message = request.data.get("message")
        language = request.data.get("language", "auto")
        
        if not message:
            return Response(
                {"error": "Message is required"},
                status=400
            )
        
        # Stream AI response
        response_text = ""
        for chunk in stream_ai_response(message):
            response_text += chunk
        
        return Response({
            "text": response_text,
            "language": language
        })
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=500
        )


class CreateChatSessionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        session = ChatSession.objects.create(user=request.user)
        return Response({
            "session_id": session.id
        })



class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        content = request.data.get("message")

        session = ChatSession.objects.get(id=session_id, user=request.user)

        ChatMessage.objects.create(
            session=session,
            role="user",
            content=content
        )

        return Response({"status": "message_saved"})

    def get(self, request, session_id):
        session = ChatSession.objects.get(id=session_id, user=request.user)
        messages = session.messages.order_by('created_at').values('role', 'content', 'created_at')
        return Response({
            "session_id": session.id,
            "title": session.title,
            "created_at": session.created_at,
            "messages": list(messages)
        })


class StreamAIResponseView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        session = ChatSession.objects.get(id=session_id, user=request.user)

        last_user_msg = session.messages.filter(
            role="user"
        ).last()

        def event_stream():
            full_text = ""

            for chunk in stream_ai_response(last_user_msg.content):
                full_text += chunk
                yield f"data: {chunk}\n\n"

            ChatMessage.objects.create(
                session=session,
                role="assistant",
                content=full_text
            )

        return StreamingHttpResponse(
            event_stream(),
            content_type="text/event-stream"
        )

@api_view(["POST"])
@permission_classes([AllowAny])
def voice_agent_response(request):
    """
    Enhanced voice agent endpoint with persistence.
    Saves conversation to database for both authenticated and guest users.
    Tracks conversations for model training.
    
    Expects: {
        "message": "...",
        "session_id": "...",  # optional, auto-create if not provided
        "confidence": 0.95,    # optional, from Deepgram
        "is_voice": true       # optional, track voice inputs
    }
    """
    try:
        message = request.data.get("message")
        session_id = request.data.get("session_id")
        confidence = request.data.get("confidence", None)
        is_voice = request.data.get("is_voice", False)
        
        if not message:
            return Response(
                {"error": "Message is required"},
                status=400
            )
        
        # Authenticated users: use their session
        if request.user.is_authenticated:
            if session_id:
                try:
                    session = ChatSession.objects.get(
                        id=session_id, 
                        user=request.user,
                        is_voice_agent=True
                    )
                except ChatSession.DoesNotExist:
                    return Response(
                        {"error": "Session not found"},
                        status=404
                    )
            else:
                # Create new voice agent session
                session = ChatSession.objects.create(
                    user=request.user,
                    title=f"Voice Chat - {message[:50]}",
                    is_voice_agent=True
                )
            
            # Save user message
            user_msg = ChatMessage.objects.create(
                session=session,
                role="user",
                content=message,
                is_voice_input=is_voice,
                confidence_score=confidence
            )
            
            # Generate voice agent response
            response_text = ""
            for chunk in stream_voice_agent_response(message):
                response_text += chunk
            
            # Save agent response
            agent_msg = ChatMessage.objects.create(
                session=session,
                role="voice_agent",
                content=response_text
            )
            
            # Update session metadata
            session.message_count = session.messages.count()
            session.save()
            
            # Save training data
            VoiceAgentTrainingData.objects.create(
                user=request.user,
                session=session,
                user_input=message,
                agent_response=response_text
            )
            
            return Response({
                "text": response_text,
                "agent_type": "voice_agent",
                "session_id": session.id,
                "message_saved": True
            })
        
        else:
            # Guest users: use temporary session
            # Response without database persistence
            response_text = ""
            for chunk in stream_voice_agent_response(message):
                response_text += chunk
            
            return Response({
                "text": response_text,
                "agent_type": "voice_agent",
                "message_saved": False,
                "note": "Guest session: save localStorage only"
            })
            
    except Exception as e:
        print(f"[Voice Agent Error] {str(e)}")
        return Response(
            {"error": str(e)},
            status=500
        )


class CreateVoiceAgentSessionView(APIView):
    """Create a new voice agent session"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        title = request.data.get("title", "Voice Chat")
        session = ChatSession.objects.create(
            user=request.user,
            title=title,
            is_voice_agent=True
        )
        return Response({
            "session_id": session.id,
            "title": session.title,
            "created_at": session.created_at
        })


class VoiceAgentSessionsView(APIView):
    """Get all voice agent sessions for user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sessions = ChatSession.objects.filter(
            user=request.user,
            is_voice_agent=True
        ).order_by('-created_at')
        
        data = []
        for session in sessions:
            messages = session.messages.order_by('created_at')
            data.append({
                'session_id': session.id,
                'title': session.title,
                'message_count': session.message_count,
                'created_at': session.created_at,
                'updated_at': session.updated_at,
                'messages': [
                    {
                        'role': m.role,
                        'content': m.content,
                        'is_voice_input': m.is_voice_input,
                        'confidence': m.confidence_score,
                        'created_at': m.created_at
                    }
                    for m in messages
                ]
            })
        return Response({'sessions': data})


class RateVoiceAgentResponseView(APIView):
    """Rate voice agent response for model training"""
    permission_classes = [IsAuthenticated]

    def post(self, request, training_data_id):
        rating = request.data.get("rating")  # 1-5
        
        if not rating or rating < 1 or rating > 5:
            return Response(
                {"error": "Rating must be between 1 and 5"},
                status=400
            )
        
        try:
            training_data = VoiceAgentTrainingData.objects.get(
                id=training_data_id,
                user=request.user
            )
            training_data.user_rating = rating
            training_data.save()
            
            return Response({
                "status": "rated",
                "rating": rating,
                "training_data_id": training_data_id
            })
        except VoiceAgentTrainingData.DoesNotExist:
            return Response(
                {"error": "Training data not found"},
                status=404
            )


class TrainingDataStatsView(APIView):
    """Get training data statistics for model improvement"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        training_data = VoiceAgentTrainingData.objects.filter(
            user=request.user
        )
        
        total_conversations = training_data.count()
        rated_conversations = training_data.filter(
            user_rating__isnull=False
        ).count()
        
        avg_rating = 0
        if rated_conversations > 0:
            from django.db.models import Avg
            avg_rating = training_data.aggregate(
                avg=Avg('user_rating')
            )['avg'] or 0
        
        return Response({
            "total_conversations": total_conversations,
            "rated_conversations": rated_conversations,
            "average_rating": round(avg_rating, 2),
            "training_readiness": "ready" if total_conversations >= 10 else "collecting_data"
        })