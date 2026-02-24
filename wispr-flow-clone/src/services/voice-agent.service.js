const API_BASE = "https://wispr-flows-3adt.onrender.com/api";

export async function getVoiceAgentResponse(message) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Not authenticated. Please log in first.");
  }

  if (!message || message.trim().length === 0) {
    throw new Error("Message cannot be empty");
  }

  try {
    const res = await fetch(`${API_BASE}/chat/voice-agent/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: message.trim(),
      }),
    });

    if (!res.ok) {
      let errorMessage = "Voice agent request failed";
      try {
        const error = await res.json();
        errorMessage = error.error || errorMessage;
      } catch (parseError) {
        const text = await res.text();
        if (text) {
          errorMessage = text;
        }
      }
      throw new Error(errorMessage);
    }

    return await res.json();
    // { text: "...", agent_type: "voice_agent" }
  } catch (err) {
    console.error("Voice Agent Service Error:", err);
    throw err;
  }
}
