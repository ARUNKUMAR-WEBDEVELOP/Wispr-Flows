import { useState, useRef } from "react";

// Modern browser-native speech-to-text hook (no backend, no WebSocket)
export function useSpeechRecognition({ lang = "en-US", interimResults = true } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (recognitionRef.current && recognitionRef.current._isRunning) {
      // Already running, do not start again
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = interimResults;
    recognition.continuous = true;
    recognition._isRunning = false;
    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };
    recognition.onstart = () => {
      recognition._isRunning = true;
    };
    recognition.onend = () => {
      recognition._isRunning = false;
      if (recognitionRef.current && recognitionRef.current._keepAlive) {
        try {
          recognition.start(); // auto-restart
        } catch (e) {}
      } else {
        setListening(false);
      }
    };
    recognition.onerror = () => {
      recognition._isRunning = false;
      if (recognitionRef.current && recognitionRef.current._keepAlive) {
        try {
          recognition.start(); // auto-restart on error
        } catch (e) {}
      } else {
        setListening(false);
      }
    };
    recognition._keepAlive = true;
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current._keepAlive = false;
      recognitionRef.current.stop();
      recognitionRef.current._isRunning = false;
    }
    setListening(false);
  };

  return { transcript, listening, startListening, stopListening };
}
