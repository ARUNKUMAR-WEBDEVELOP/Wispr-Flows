from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from django.http import StreamingHttpResponse, JsonResponse
import json
import asyncio
from asgiref.sync import sync_to_async, async_to_sync

from .models import ChatSession, ChatMessage, Message
from .voice_agent import VoiceAgent


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_chat_session(request):
    """Create a new chat session for the user"""
    try:
        session = ChatSession.objects.create(
            user=request.user,
            title="New Conversation"
        )
        return Response({
            "session_id": session.id,
            "created_at": session.created_at
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_chat_history(request):
    """Get all chat sessions and messages for the user"""
    try:
        sessions = ChatSession.objects.filter(user=request.user).order_by('-created_at')
        data = []
        for session in sessions:
            messages = session.messages.order_by('created_at').values('role', 'content', 'created_at')
            data.append({
                'session_id': session.id,
                'title': session.title,
                'created_at': session.created_at.isoformat(),
                'message_count': session.messages.count(),
                'messages': list(messages)
            })
        return Response({'sessions': data})
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session_messages(request, session_id):
    """Get all messages in a specific session"""
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        messages = session.messages.order_by('created_at').values('role', 'content', 'created_at')
        return Response({
            'session_id': session.id,
            'title': session.title,
            'created_at': session.created_at.isoformat(),
            'messages': list(messages)
        })
    except ChatSession.DoesNotExist:
        return Response({"error": "Session not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def process_voice_transcript(request, session_id):
    """
    Process user transcript and stream LLM response.
    
    Expects: { "transcript": "...", "is_final": true }
    Returns: Server-sent events with LLM response chunks
    """
    try:
        transcript = request.data.get("transcript", "").strip()
        is_final = request.data.get("is_final", True)
        
        if not transcript or not is_final:
            return JsonResponse({"error": "Only final transcripts are processed"}, status=400)
        
        # Get or create session
        session = ChatSession.objects.get(id=session_id, user=request.user)
        
        # Initialize voice agent
        agent = VoiceAgent(request.user, session_id)
        
        # Load session history synchronously
        try:
            agent.load_session()
        except:
            pass
        
        def event_generator():
            # Run async code in sync context
            async def process():
                async def send_chunk(chunk_data):
                    yield f"data: {json.dumps(chunk_data)}\n\n"
                
                # Process transcript and stream response
                async_gen = send_chunk  # Placeholder
                
                response_chunks = []
                
                async def collect_response(chunk_data):
                    response_chunks.append(f"data: {json.dumps(chunk_data)}\n\n")
                
                await agent.process_transcript(transcript, collect_response)
                return response_chunks
            
            # Get event loop and run async code
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                chunks = loop.run_until_complete(process())
                for chunk in chunks:
                    yield chunk
            finally:
                loop.close()
        
        return StreamingHttpResponse(
            event_generator(),
            content_type="text/event-stream"
        )
    
    except ChatSession.DoesNotExist:
        return JsonResponse({"error": "Session not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_session(request, session_id):
    """Delete a chat session"""
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        session.delete()
        return Response({"status": "deleted"})
    except ChatSession.DoesNotExist:
        return Response({"error": "Session not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
