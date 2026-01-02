export function useSpeechRecognition(onResult) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("Speech Recognition not supported");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US"; // Use specific language instead of auto

  recognition.onstart = () => {
    console.log("Speech recognition started");
  };

  recognition.onresult = (event) => {
    let transcript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }

    if (transcript.trim()) {
      onResult(transcript.trim());
    }
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    
    // Provide user-friendly error messages
    let errorMsg = "Speech recognition failed";
    switch (e.error) {
      case "network":
        errorMsg = "Network error - please check your internet connection";
        break;
      case "no-speech":
        errorMsg = "No speech detected - please try again";
        break;
      case "audio-capture":
        errorMsg = "Microphone not found - please check permissions";
        break;
      case "not-allowed":
        errorMsg = "Microphone access denied - please allow microphone permissions";
        break;
      default:
        errorMsg = `Speech error: ${e.error}`;
    }
    
    console.warn(errorMsg);
  };

  recognition.onend = () => {
    console.log("Speech recognition ended");
  };

  return recognition;
}
