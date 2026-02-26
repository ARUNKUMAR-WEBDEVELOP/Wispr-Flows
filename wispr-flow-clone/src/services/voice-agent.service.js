const API_BASE = "https://wispr-flows-3adt.onrender.com/api";

export async function getVoiceAgentResponse(message, options = {}) {
  const token = localStorage.getItem("access_token");

  if (!message || message.trim().length === 0) {
    throw new Error("Message cannot be empty");
  }

  try {
    const requestBody = {
      message: message.trim(),
      session_id: options.sessionId || null,
      confidence: options.confidence || 0.95, // Default confidence from Deepgram
      is_voice: options.isVoiceInput || false,
    };

    const res = await fetch(`${API_BASE}/chat/voice-agent/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Voice agent request failed");
    }

    // Response now includes: text, agent_type, session_id, message_saved
    return await res.json();
  } catch (err) {
    console.error("Voice Agent Service Error:", err);
    throw err;
  }
}

// Create a new voice agent session
export async function createVoiceAgentSession() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Must be authenticated to create voice sessions");
  }

  try {
    const res = await fetch(`${API_BASE}/chat/voice-sessions/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: `Voice Chat - ${new Date().toLocaleString()}`,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create voice session");
    }

    return await res.json();
  } catch (err) {
    console.error("Voice Session Creation Error:", err);
    throw err;
  }
}

// Get all voice agent sessions for current user
export async function getVoiceAgentSessions() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return []; // Return empty for guests
  }

  try {
    const res = await fetch(`${API_BASE}/chat/voice-sessions/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch voice sessions");
    }

    return await res.json();
  } catch (err) {
    console.error("Voice Sessions Fetch Error:", err);
    return [];
  }
}

// Rate a voice agent response (1-5 stars) for model training
export async function rateVoiceAgentResponse(trainingDataId, rating) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Must be authenticated to rate responses");
  }

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error("Rating must be integer between 1 and 5");
  }

  try {
    const res = await fetch(`${API_BASE}/chat/rate/${trainingDataId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rating }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to rate response");
    }

    return await res.json();
  } catch (err) {
    console.error("Voice Rating Error:", err);
    throw err;
  }
}

// Get training statistics for model improvement
export async function getTrainingStats() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    return null; // No stats for guests
  }

  try {
    const res = await fetch(`${API_BASE}/chat/training-stats/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Failed to fetch training stats");
    }

    return await res.json();
  } catch (err) {
    console.error("Training Stats Fetch Error:", err);
    return null;
  }
}
