import google.generativeai as genai
from django.conf import settings
import os
from typing import Generator, Optional


# System prompt for voice agent role
VOICE_AGENT_SYSTEM_PROMPT = """You are a general-purpose virtual assistant speaking to users over the phone. Your task is to help them find accurate, helpful information across a wide range of everyday topics.

General Guidelines:
- Be warm, friendly, and professional.
- Speak clearly and naturally in plain language.
- Keep most responses to 1–2 sentences and under 120 characters unless the caller asks for more detail (max: 300 characters).
- Do not use markdown formatting, like code blocks, quotes, bold, links, or italics.
- Use line breaks in lists only when necessary.
- Use varied phrasing; avoid repetition.
- If unclear, ask for clarification.
- If the user's message is empty, respond with an empty message.
- If asked about your well-being, respond briefly and kindly.

Voice-Specific Instructions:
- Speak in a conversational tone—your responses will be spoken aloud.
- Pause after questions to allow for replies.
- Confirm what the customer said if uncertain.
- Never interrupt.

Style:
- Use active listening cues.
- Be warm and understanding, but concise.
- Use simple words unless the caller uses technical terms.

Call Flow Objective:
- Greet the caller and introduce yourself: "Hi there, I'm your virtual assistant—how can I help today?"
- Your primary goal is to help users quickly find the information they're looking for. This may include:
  - Quick facts: "The capital of Japan is Tokyo."
  - Weather: "It's currently 68 degrees and cloudy in Seattle."
  - Local info: "There's a pharmacy nearby open until 9 PM."
  - Basic how-to guidance: "To restart your phone, hold the power button for 5 seconds."
  - FAQs: "Most returns are accepted within 30 days with a receipt."
  - Navigation help: "Can you tell me the address or place you're trying to reach?"
- If the request is unclear: "Just to confirm, did you mean…?" or "Can you tell me a bit more?"
- If the request is out of scope (e.g legal, financial, or medical advice): "I'm not able to provide advice on that, but I can help you find someone who can."

Off-Scope Questions:
- If asked about sensitive topics like health, legal, or financial matters: "I'm not qualified to answer that, but I recommend reaching out to a licensed professional."

User Considerations:
- Callers may be in a rush, distracted, or unsure how to phrase their question. Stay calm, helpful, and clear—especially when the user seems stressed, confused, or overwhelmed.

Closing:
- Always ask: "Is there anything else I can help you with today?"
- Then thank them warmly and say: "Thanks for calling. Take care and have a great day!\""""


def stream_voice_agent_response(
    user_message: str,
    llm_model: str = "gemini-flash-lite",
    conversation_history: list = None
) -> Generator[str, None, None]:
    """
    Stream voice agent response with multiple LLM support.
    
    Args:
        user_message: User's input message
        llm_model: LLM to use (gemini-flash-lite, gemini-1.5-pro, gpt-4, etc.)
        conversation_history: List of previous messages for context
    
    Yields:
        Text chunks from the LLM response
    """
    if conversation_history is None:
        conversation_history = []
    
    try:
        if llm_model.startswith("gemini"):
            yield from _gemini_response(user_message, llm_model, conversation_history)
        elif llm_model.startswith("gpt"):
            yield from _gpt_response(user_message, llm_model, conversation_history)
        else:
            yield "Unsupported model. Please use gemini or gpt models."
    
    except Exception as e:
        yield f"I encountered an error. Please try again."


def _gemini_response(
    user_message: str,
    model_name: str = "gemini-flash-lite-latest",
    history: list = None
) -> Generator[str, None, None]:
    """Stream response from Google Gemini."""
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        model = genai.GenerativeModel(
            model_name,
            system_instruction=VOICE_AGENT_SYSTEM_PROMPT
        )
        
        # Build messages with conversation history
        messages = []
        if history:
            for msg in history[-10:]:  # Keep last 10 messages for context
                messages.append({
                    "role": msg.get("role", "user"),
                    "parts": [{"text": msg.get("content", "")}]
                })
        
        # Add current message
        messages.append({
            "role": "user",
            "parts": [{"text": user_message}]
        })
        
        # Start chat session for multi-turn conversation
        chat = model.start_chat(history=messages[:-1] if len(messages) > 1 else [])
        response = chat.send_message(user_message, stream=True)
        
        for chunk in response:
            if chunk.text:
                yield chunk.text
    
    except Exception as e:
        raise


def _gpt_response(
    user_message: str,
    model_name: str = "gpt-4-turbo",
    history: list = None
) -> Generator[str, None, None]:
    """Stream response from OpenAI GPT."""
    try:
        # Try to import OpenAI SDK (optional dependency)
        from openai import OpenAI
        
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Build messages with conversation history
        messages = [
            {"role": "system", "content": VOICE_AGENT_SYSTEM_PROMPT}
        ]
        
        if history:
            for msg in history[-10:]:  # Keep last 10 messages
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
        
        # Add current message
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Stream from OpenAI
        with client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=True
        ) as response:
            for chunk in response:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
    
    except ImportError:
        raise Exception("OpenAI SDK not installed. Install with: pip install openai")
    except Exception as e:
        raise


# Available LLM Models with their characteristics
AVAILABLE_MODELS = {
    "gemini-flash-lite": {
        "provider": "Google",
        "full_name": "Gemini Flash Lite (Fastest)",
        "speed": "fastest",
        "cost": "low",
        "context": 100000,
    },
    "gemini-1.5-flash": {
        "provider": "Google",
        "full_name": "Gemini 1.5 Flash (Fast)",
        "speed": "fast",
        "cost": "low",
        "context": 1000000,
    },
    "gemini-1.5-pro": {
        "provider": "Google",
        "full_name": "Gemini 1.5 Pro (Balanced)",
        "speed": "balanced",
        "cost": "medium",
        "context": 1000000,
    },
    "gpt-4-turbo": {
        "provider": "OpenAI",
        "full_name": "GPT-4 Turbo (Powerful)",
        "speed": "balanced",
        "cost": "high",
        "context": 128000,
    },
    "gpt-4-mini": {
        "provider": "OpenAI",
        "full_name": "GPT-4 Mini (Cost-Effective)",
        "speed": "fast",
        "cost": "low",
        "context": 128000,
    },
}


def get_available_models():
    """Get list of available LLM models."""
    return AVAILABLE_MODELS


def get_model_info(model_name: str):
    """Get information about a specific LLM model."""
    return AVAILABLE_MODELS.get(model_name, None)
