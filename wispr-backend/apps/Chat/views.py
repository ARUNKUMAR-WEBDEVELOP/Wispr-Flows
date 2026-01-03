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

from .models import ChatSession, ChatMessage
from .streaming import stream_ai_response


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
