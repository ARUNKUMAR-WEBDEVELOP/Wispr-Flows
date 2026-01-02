import google.generativeai as genai
from django.conf import settings


def stream_ai_response(prompt: str):
    """
    Stream AI response using Google Gemini API.
    """
    try:
        genai.configure(api_key=settings.GEMINI_API_KEY)

        # ✅ CORRECT MODEL
        model = genai.GenerativeModel("gemini-flash-lite-latest")

        response = model.generate_content(
            prompt,
            stream=True
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text

    except Exception as e:
        yield f"⚠️ AI Error: {str(e)}"
