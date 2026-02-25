/**
 * Voice Chat Service - Enhanced Multi-LLM Support
 * 
 * This service provides a clean interface to the backend voice agent API
 * with multi-LLM support, session management, and streaming responses.
 */

const API_BASE = process.env.REACT_APP_API_URL || "https://wispr-flows-3adt.onrender.com/api";

/**
 * Get available LLM models
 */
export const getAvailableLLMModels = async () => {
  try {
    const response = await fetch(`${API_BASE}/chat/models/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching LLM models:", error);
    throw error;
  }
};

/**
 * Get all chat sessions for the logged-in user
 */
export const getChatSessions = async (token) => {
  try {
    const response = await fetch(`${API_BASE}/chat/history/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      throw new Error(`Failed to fetch chat sessions: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    throw error;
  }
};

/**
 * Create a new chat session
 */
export const createChatSession = async (token, title = "New Chat", llmModel = "gemini-flash-lite") => {
  try {
    const response = await fetch(`${API_BASE}/chat/session/create/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        llm_model: llmModel,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      throw new Error(`Failed to create chat session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating chat session:", error);
    throw error;
  }
};

/**
 * Load a specific chat session with all messages
 */
export const loadChatSession = async (token, sessionId) => {
  try {
    const response = await fetch(`${API_BASE}/chat/session/${sessionId}/`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      if (response.status === 404) {
        throw new Error("Chat session not found");
      }
      throw new Error(`Failed to load chat session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error loading chat session:", error);
    throw error;
  }
};

/**
 * Send message and get streaming response
 */
export const sendMessage = async (token, sessionId, message, onChunk) => {
  try {
    const response = await fetch(`${API_BASE}/chat/session/${sessionId}/message/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      if (response.status === 404) {
        throw new Error("Chat session not found");
      }
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const text = line.slice(6);
          fullResponse += text;

          // Call callback with each chunk for real-time UI updates
          if (onChunk && text) {
            onChunk(text);
          }
        }
      }
    }

    return fullResponse;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Update chat session (title, model)
 */
export const updateChatSession = async (token, sessionId, updates) => {
  try {
    const response = await fetch(
      `${API_BASE}/chat/session/${sessionId}/update/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      if (response.status === 404) {
        throw new Error("Chat session not found");
      }
      throw new Error(`Failed to update chat session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating chat session:", error);
    throw error;
  }
};

/**
 * Delete a chat session
 */
export const deleteChatSession = async (token, sessionId) => {
  try {
    const response = await fetch(
      `${API_BASE}/chat/session/${sessionId}/delete/`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Unauthorized - Please login again");
      }
      if (response.status === 404) {
        throw new Error("Chat session not found");
      }
      throw new Error(`Failed to delete chat session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting chat session:", error);
    throw error;
  }
};

/**
 * Legacy: Send message to voice agent without session management
 */
export const sendVoiceAgentMessage = async (
  message,
  llmModel = "gemini-flash-lite",
  conversationHistory = []
) => {
  try {
    const response = await fetch(`${API_BASE}/chat/voice-agent/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        llm_model: llmModel,
        conversation_history: conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get voice agent response: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending voice agent message:", error);
    throw error;
  }
};

/**
 * Convert text to speech using Deepgram
 */
export const synthesizeSpeech = async (text, language = "en") => {
  try {
    const deepgramApiKey = process.env.REACT_APP_DEEPGRAM_API_KEY;

    if (!deepgramApiKey) {
      throw new Error("Deepgram API key not configured");
    }

    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=aura-asteria&encoding=linear16`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${deepgramApiKey}`,
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      throw new Error(`Deepgram TTS error: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error synthesizing speech:", error);
    throw error;
  }
};

export default {
  getAvailableLLMModels,
  getChatSessions,
  createChatSession,
  loadChatSession,
  sendMessage,
  updateChatSession,
  deleteChatSession,
  sendVoiceAgentMessage,
  synthesizeSpeech,
};
