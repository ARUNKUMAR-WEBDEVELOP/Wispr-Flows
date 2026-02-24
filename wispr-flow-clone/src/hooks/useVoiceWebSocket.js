import { useRef, useState, useCallback } from "react";

export function useVoiceWebSocket(onTranscript) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      console.log("[WebSocket] Already connected");
      return;
    }
    
    // Support both localhost and production URLs
    const wsUrl = process.env.NODE_ENV === "development" 
      ? "ws://localhost:8000/ws/speech/"
      : "wss://wispr-flows-3adt.onrender.com/ws/speech/";
    
    console.log(`[WebSocket] Connecting to ${wsUrl}`);
    
    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = "arraybuffer";
    
    wsRef.current.onopen = () => {
      console.log("[WebSocket] Connected to STT");
      setConnected(true);
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    wsRef.current.onclose = () => {
      console.log("[WebSocket] Disconnected from STT");
      setConnected(false);
    };
    
    wsRef.current.onerror = (error) => {
      console.error("[WebSocket] WebSocket error:", error);
      setConnected(false);
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && onTranscript) {
          console.log(`[WebSocket] Transcript (final=${data.is_final}): ${data.text}`);
          onTranscript(data.text);
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
      }
    };
  }, [onTranscript]);

  const sendAudio = useCallback((audio) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(audio);
    } else {
      console.warn(`[WebSocket] Cannot send audio. Connection state: ${wsRef.current?.readyState || 'null'}`);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log("[WebSocket] Attempting to disconnect from STT");
    if (wsRef.current) {
      try {
        // Send a signal to backend that recording is complete
        wsRef.current.send(new Uint8Array([0])); // Single null byte to signal end
      } catch (e) {
        console.warn("[WebSocket] Could not send end signal:", e);
      }
      
      // Give backend time to process the end signal
      setTimeout(() => {
        try {
          wsRef.current.close();
        } catch (e) {
          console.warn("[WebSocket] Error closing connection:", e);
        }
      }, 100);
    }
  }, []);

  return { connect, sendAudio, disconnect, connected };
}
