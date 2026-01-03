const API_BASE = "http://localhost:8000/api";

export async function textToSpeech(text, language = "en") {
  const token = localStorage.getItem("access_token");

  // Allow guests: don't require token

  // Validate text
  if (!text || text.trim().length === 0) {
    throw new Error("Cannot generate speech from empty text");
  }

  try {
    const res = await fetch(`${API_BASE}/speech/tts/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: text.trim(),
        language,
      }),
    });

    if (!res.ok) {
      let errorMsg = "TTS failed";
      try {
        const error = await res.json();
        errorMsg = error.error || errorMsg;
      } catch (e) {
        const text = await res.text();
        console.error("Backend error response:", text);
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    
    // Backend returns hex-encoded audio
    if (data.audio) {
      try {
        // Decode hex string to binary
        const hexString = data.audio;
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        const blob = new Blob([bytes], { type: "audio/wav" });
        return URL.createObjectURL(blob);
      } catch (decodeErr) {
        console.error("Failed to decode audio:", decodeErr);
        throw new Error("Failed to decode audio data");
      }
    }
    
    throw new Error("No audio data in response");
  } catch (err) {
    console.error("TTS Service Error:", err);
    throw err;
  }
}
