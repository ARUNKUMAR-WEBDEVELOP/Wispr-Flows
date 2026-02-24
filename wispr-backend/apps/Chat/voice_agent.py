"""
Real-time Voice Agent with LLM streaming support.
Handles continuous speech-to-text-to-LLM pipeline.
"""

import json
import asyncio
from django.conf import settings
from channels.db import database_sync_to_async
import google.generativeai as genai
from .models import ChatSession, Message


class VoiceAgent:
    def __init__(self, user, session_id):
        self.user = user
        self.session_id = session_id
        self.conversation_history = []
        self.llm_buffer = ""
        self.is_first_exchange = True
        
    @database_sync_to_async
    def load_session(self):
        """Load existing session or create new one"""
        try:
            session = ChatSession.objects.get(
                id=self.session_id,
                user=self.user
            )
            # Load message history
            messages = Message.objects.filter(session=session).order_by('created_at')
            self.conversation_history = [
                {
                    "role": "user" if m.role == "user" else "assistant",
                    "content": m.content
                }
                for m in messages
            ]
            self.is_first_exchange = len(messages) == 0
            return session
        except ChatSession.DoesNotExist:
            return None

    async def process_transcript(self, transcript, send_response):
        """
        Process user transcript and stream LLM response.
        
        Args:
            transcript: User's spoken text
            send_response: Async callback to send response chunks
        """
        # Save user message
        await self.save_message("user", transcript)
        self.conversation_history.append({
            "role": "user",
            "content": transcript
        })
        
        # Stream LLM response
        full_response = ""
        
        try:
            # Try OpenAI GPT-4 first (GPT-5.2 not yet available publicly)
            print(f"[VoiceAgent] Trying OpenAI...")
            response_stream = self.stream_openai_response(transcript)
            async for chunk in response_stream:
                full_response += chunk
                self.llm_buffer += chunk
                await send_response({
                    "type": "llm_chunk",
                    "text": chunk,
                    "is_final": False
                })
        except Exception as e:
            print(f"[VoiceAgent] OpenAI failed: {e}, trying Gemini...")
            # Fallback to Gemini
            try:
                response_stream = self.stream_gemini_response(transcript)
                async for chunk in response_stream:
                    full_response += chunk
                    self.llm_buffer += chunk
                    await send_response({
                        "type": "llm_chunk",
                        "text": chunk,
                        "is_final": False
                    })
            except Exception as e2:
                print(f"[VoiceAgent] Gemini also failed: {e2}")
                error_msg = "Could not generate response. Please try again."
                await send_response({
                    "type": "llm_chunk",
                    "text": error_msg,
                    "is_final": True
                })
                full_response = error_msg
        
        # Save assistant response
        await self.save_message("assistant", full_response)
        self.conversation_history.append({
            "role": "assistant",
            "content": full_response
        })
        
        # Generate title if first exchange
        if self.is_first_exchange and full_response:
            await self.generate_and_save_title(transcript)
            self.is_first_exchange = False
        
        # Signal completion
        await send_response({
            "type": "llm_chunk",
            "text": "",
            "is_final": True
        })
        
        self.llm_buffer = ""

    async def stream_openai_response(self, user_message):
        """Stream response from OpenAI GPT-4"""
        try:
            import openai
        except ImportError:
            raise ValueError("openai package not installed")
        
        api_key = getattr(settings, "OPENAI_API_KEY", None)
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        
        client = openai.OpenAI(api_key=api_key)
        
        # Format conversation for OpenAI
        messages = [
            {"role": "system", "content": "You are a helpful voice assistant. Keep responses concise and conversational."}
        ]
        messages.extend(self.conversation_history)
        
        # Stream response
        with client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=messages,
            stream=True,
            temperature=0.7,
            max_tokens=500
        ) as response:
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

    async def stream_gemini_response(self, user_message):
        """Stream response from Google Gemini"""
        api_key = getattr(settings, "GEMINI_API_KEY", None)
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")
        
        genai.configure(api_key=api_key)
        
        # Create message history for Gemini
        system_instruction = "You are a helpful voice assistant. Keep responses concise and conversational."
        
        model = genai.GenerativeModel(
            model_name="gemini-pro",
            system_instruction=system_instruction
        )
        
        # Build request with recent context
        recent_messages = self.conversation_history[-4:] if self.conversation_history else []
        
        # Format for Gemini
        contents = []
        for msg in recent_messages:
            contents.append({
                "role": "user" if msg["role"] == "user" else "model",
                "parts": [msg["content"]]
            })
        
        # Stream response
        response = model.generate_content(
            contents,
            stream=True,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=500,
                temperature=0.7,
            )
        )
        
        for chunk in response:
            if chunk.text:
                yield chunk.text

    @database_sync_to_async
    def save_message(self, role, content):
        """Save message to database"""
        try:
            session = ChatSession.objects.get(id=self.session_id, user=self.user)
            Message.objects.create(
                session=session,
                role=role,
                content=content
            )
        except ChatSession.DoesNotExist:
            print(f"[VoiceAgent] Session {self.session_id} not found")

    async def generate_and_save_title(self, first_user_message):
        """Generate title from first user message and save to session"""
        # Simple title generation from first message
        words = first_user_message.split()[:5]
        title = " ".join(words) + ("..." if len(first_user_message.split()) > 5 else "")
        
        if len(title) > 100:
            title = title[:97] + "..."
        
        await self._update_session_title(title)

    @database_sync_to_async
    def _update_session_title(self, title):
        """Update session title in DB"""
        try:
            session = ChatSession.objects.get(id=self.session_id, user=self.user)
            session.title = title
            session.save()
        except ChatSession.DoesNotExist:
            pass
