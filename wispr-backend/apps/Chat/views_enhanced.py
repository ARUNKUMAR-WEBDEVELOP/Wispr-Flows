"""
Enhanced Chat Views with Multi-LLM Support and Session Management
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from django.http import StreamingHttpResponse
from rest_framework import status

from .models import ChatSession, ChatMessage
from .streaming import stream_ai_response
from .voice_agent import (
    stream_voice_agent_response,
    get_available_models,
    get_model_info
)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_available_llm_models(request):
    """
    Get list of available LLM models.
    Returns: List of model options with metadata
    """
    try:
        models = get_available_models()
        return Response({
            "models": models,
            "default_model": "gemini-flash-lite"
        })
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class ChatHistoryView(APIView):
    """Get all chat sessions for the logged-in user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sessions = ChatSession.objects.filter(
                user=request.user,
                is_active=True
            ).order_by('-updated_at')
            
            data = []
            for session in sessions:
                messages = session.messages.order_by('created_at').values(
                    'id', 'role', 'content', 'created_at'
                )
                data.append({
                    'session_id': session.id,
                    'title': session.title,
                    'llm_model': session.llm_model,
                    'model_info': get_model_info(session.llm_model),
                    'created_at': session.created_at,
                    'updated_at': session.updated_at,
                    'message_count': session.messages.count(),
                    'preview': session.messages.filter(role='user').last().content[:100] if session.messages.exists() else ""
                })
            
            return Response({
                'sessions': data,
                'total_sessions': len(data)
            })
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CreateChatSessionView(APIView):
    """Create a new chat session with selected LLM model."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            llm_model = request.data.get("llm_model", "gemini-flash-lite")
            title = request.data.get("title", "New Chat")
            
            # Validate model
            available_models = get_available_models()
            if llm_model not in available_models:
                return Response(
                    {"error": f"Invalid model. Available: {list(available_models.keys())}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            session = ChatSession.objects.create(
                user=request.user,
                llm_model=llm_model,
                title=title
            )
            
            return Response({
                'session_id': session.id,
                'title': session.title,
                'llm_model': session.llm_model,
                'model_info': get_model_info(session.llm_model),
                'created_at': session.created_at
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LoadChatSessionView(APIView):
    """Load full chat session with conversation history."""
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            messages = session.messages.order_by('created_at').values(
                'id', 'role', 'content', 'created_at'
            )
            
            return Response({
                'session_id': session.id,
                'title': session.title,
                'llm_model': session.llm_model,
                'model_info': get_model_info(session.llm_model),
                'created_at': session.created_at,
                'updated_at': session.updated_at,
                'messages': list(messages)
            })
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SendMessageToSessionView(APIView):
    """Send message and get AI response with streaming."""
    permission_classes = [IsAuthenticated]

    def post(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            user_message = request.data.get("message")
            
            if not user_message:
                return Response(
                    {"error": "Message is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Save user message
            user_msg_obj = ChatMessage.objects.create(
                session=session,
                role="user",
                content=user_message
            )
            
            # Get conversation history for context
            history = session.get_conversation_history(limit=10)
            
            # Stream AI response
            def stream_response():
                full_response = ""
                try:
                    for chunk in stream_voice_agent_response(
                        user_message,
                        llm_model=session.llm_model,
                        conversation_history=history
                    ):
                        full_response += chunk
                        yield f"data: {chunk}\n\n"
                    
                    # Save assistant message after complete response
                    ChatMessage.objects.create(
                        session=session,
                        role="assistant",
                        content=full_response,
                        tokens_used=0  # TODO: Track token usage
                    )
                    
                    # Update session title from first message if needed
                    if session.messages.filter(role='user').count() == 1:
                        session.save_title_from_first_message()
                    
                    session.save()  # Update timestamp
                    
                except Exception as e:
                    yield f"data: [ERROR] {str(e)}\n\n"
            
            return StreamingHttpResponse(
                stream_response(),
                content_type="text/event-stream"
            )
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DeleteChatSessionView(APIView):
    """Soft delete (deactivate) a chat session."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            session.is_active = False
            session.save()
            
            return Response({
                'message': 'Session deleted successfully',
                'session_id': session.id
            })
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateChatSessionView(APIView):
    """Update chat session (title, model)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            
            # Update title if provided
            if 'title' in request.data:
                session.title = request.data['title']
            
            # Allow model change for future messages
            if 'llm_model' in request.data:
                new_model = request.data['llm_model']
                available_models = get_available_models()
                if new_model not in available_models:
                    return Response(
                        {"error": f"Invalid model. Available: {list(available_models.keys())}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                session.llm_model = new_model
            
            session.save()
            
            return Response({
                'session_id': session.id,
                'title': session.title,
                'llm_model': session.llm_model,
                'updated_at': session.updated_at
            })
        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Session not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Legacy endpoints (for backwards compatibility)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    """
    Legacy endpoint to ask AI a question.
    Expects: { "message": "...", "language": "auto" }
    """
    try:
        message = request.data.get("message")
        language = request.data.get("language", "auto")
        
        if not message:
            return Response(
                {"error": "Message is required"},
                status=status.HTTP_400_BAD_REQUEST
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
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([AllowAny])
def voice_agent_response(request):
    """
    Voice agent endpoint - no session management.
    Takes transcribed user message and returns AI voice agent response.
    Expects: { "message": "..." }
    
    Optional:
    - llm_model: Override default model (gemini-flash-lite)
    - conversation_history: Previous messages for context
    """
    try:
        message = request.data.get("message")
        llm_model = request.data.get("llm_model", "gemini-flash-lite")
        history = request.data.get("conversation_history", [])
        
        if not message:
            return Response(
                {"error": "Message is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate model
        available_models = get_available_models()
        if llm_model not in available_models:
            return Response(
                {"error": f"Invalid model. Available: {list(available_models.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Stream voice agent response
        response_text = ""
        for chunk in stream_voice_agent_response(
            message,
            llm_model=llm_model,
            conversation_history=history
        ):
            response_text += chunk
        
        return Response({
            "text": response_text,
            "agent_type": "voice_agent",
            "llm_model": llm_model,
            "model_info": get_model_info(llm_model)
        })
    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
