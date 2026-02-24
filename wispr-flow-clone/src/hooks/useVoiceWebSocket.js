import { useRef, useState } from "react";

export function useVoiceWebSocket(onTranscript) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = () => {
    // Support both localhost and production URLs
    const wsUrl = process.env.NODE_ENV === "development" 
      ? "ws://localhost:8000/ws/speech/"
      : "wss://wispr-flows-3adt.onrender.com/ws/speech/";
    
    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = "arraybuffer";
    
    wsRef.current.onopen = () => {
      console.log("[WebSocket] Connected to STT");
      setConnected(true);
    };
    
    wsRef.current.onclose = () => {
      console.log("[WebSocket] Disconnected from STT");
      setConnected(false);
    };
    
    wsRef.current.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
      setConnected(false);
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && onTranscript) {
          // Support both interim and final results
          console.log(`[WebSocket] Transcript (final=${data.is_final}): ${data.text}`);
          onTranscript(data.text);
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    };
  };

  const sendAudio = (audio) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(audio);
    } else {
      console.warn("[WebSocket] Not connected, cannot send audio");
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      console.log("[WebSocket] Disconnecting from STT");
    }
  };

  return { connect, sendAudio, disconnect, connected };
}
