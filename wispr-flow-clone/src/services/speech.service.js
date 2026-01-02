const API_BASE = "http://localhost:8000/api";

export async function speechToText(audioBlob) {
  const token = localStorage.getItem("access_token");

  if (!token) {
    throw new Error("Not authenticated. Please log in first.");
  }

  const formData = new FormData();
  formData.append("audio", audioBlob, "audio.wav");

  try {
    const res = await fetch(`${API_BASE}/speech/transcribe/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Speech transcription failed");
    }

    return await res.json();
    // { text: "...", language: "en" }
  } catch (err) {
    console.error("Speech Service Error:", err);
    throw err;
  }
}
