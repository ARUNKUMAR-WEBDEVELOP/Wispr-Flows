import axios from "axios";

const API_BASE = "https://wispr-flows-3adt.onrender.com/api";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchChatHistory() {
  const response = await axios.get(`${API_BASE}/chat/history/`, {
    headers: getAuthHeaders(),
  });
  return response.data && Array.isArray(response.data.sessions) ? response.data.sessions : [];
}

export async function createChatSession(title = "") {
  const response = await axios.post(
    `${API_BASE}/chat/session/`,
    { title },
    { headers: getAuthHeaders() }
  );
  return response.data;
}

// Fetch all messages for a specific session
export async function fetchSessionMessages(sessionId) {
  const response = await axios.get(`${API_BASE}/chat/message/${sessionId}/`, {
    headers: getAuthHeaders(),
  });
  return response.data && Array.isArray(response.data.messages) ? response.data.messages : [];
}
// Save a new message to a session (both user and assistant messages)
export async function saveMessage(sessionId, content, role = "user", metadata = {}) {
  try {
    const response = await axios.post(
      `${API_BASE}/chat/message/`,
      {
        session_id: sessionId,
        content: content,
        role: role, // "user" or "assistant"
        ...metadata
      },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Error saving message:", error);
    // Return locally created message object if API fails
    return {
      id: Date.now(),
      session_id: sessionId,
      content: content,
      role: role,
      timestamp: new Date().toISOString(),
      ...metadata
    };
  }
}

// Update session title
export async function updateSessionTitle(sessionId, title) {
  try {
    const response = await axios.patch(
      `${API_BASE}/chat/session/${sessionId}/`,
      { title },
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating session title:", error);
    return null;
  }
}