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
