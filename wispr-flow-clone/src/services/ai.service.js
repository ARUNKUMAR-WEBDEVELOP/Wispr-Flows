const API_BASE = "https://wispr-flows-3adt.onrender.com/api";

export async function sendMessageToAI(message, language = "auto") {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Not authenticated. Please log in first.");
  }

  try {
    const res = await fetch(`${API_BASE}/chat/ask/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        language,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "AI request failed");
    }

    return await res.json();
    // { text: "...", language: "en" }
  } catch (err) {
    console.error("AI Service Error:", err);
    throw err;
  }
}
