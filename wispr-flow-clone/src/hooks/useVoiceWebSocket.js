import { useRef, useState, useCallback } from "react";

export function useVoiceWebSocket(onTranscript, options = {}) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef(null);
  const maxReconnectAttempts = options.maxReconnectAttempts || 5;
  const reconnectDelay = options.reconnectDelay || 2000;
  const wsPath = options.path || "speech";

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      console.log("[WebSocket] Already connected");
      return;
    }
    
    // Check if max reconnect attempts exceeded
    if (reconnectAttempts >= maxReconnectAttempts) {
      const errorMsg = "Maximum reconnection attempts exceeded. Please try again later.";
      console.error("[WebSocket]", errorMsg);
      setError(errorMsg);
      return;
    }
    
    // Support both localhost and production URLs
    const wsUrl = process.env.NODE_ENV === "development" 
      ? `ws://localhost:8000/ws/${wsPath}/`
      : `wss://wispr-flows-3adt.onrender.com/ws/${wsPath}/`;
    
    console.log(`[WebSocket] Connecting to ${wsUrl} (Attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
    setError(null);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";
    } catch (err) {
      console.error("[WebSocket] Connection error:", err);
      setError(`Connection failed: ${err.message}`);
      attemptReconnect();
      return;
    }
    
    wsRef.current.onopen = () => {
      console.log(`[WebSocket] Connected to ${wsPath}`);
      setConnected(true);
      setError(null);
      setReconnectAttempts(0); // Reset on successful connection
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    
    wsRef.current.onclose = (event) => {
      console.log(`[WebSocket] Disconnected from ${wsPath}`, event.code, event.reason);
      setConnected(false);
      
      // Don't reconnect if it was a clean close (user initiated)
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        attemptReconnect();
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error("[WebSocket] WebSocket error:", error);
      setConnected(false);
      setError("WebSocket connection error occurred");
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && onTranscript) {
          console.log(`[WebSocket] Transcript (final=${data.is_final}): ${data.text}`);
          onTranscript(data);
        } else if (data.type === "error") {
          console.error("[WebSocket] Server error:", data.message);
          setError(data.message || "Server error occurred");
        }
      } catch (error) {
        console.error("[WebSocket] Error parsing message:", error);
        setError("Failed to parse server message");
      }
    };
  }, [onTranscript, reconnectAttempts, maxReconnectAttempts]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnection attempts reached");
      setError("Connection failed. Please refresh and try again.");
      return;
    }

    setReconnectAttempts(prev => prev + 1);
    console.log(`[WebSocket] Reconnecting in ${reconnectDelay}ms...`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  }, [reconnectAttempts, maxReconnectAttempts, reconnectDelay, connect]);

  const sendAudio = useCallback((audio) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(audio);
    } else {
      console.warn(`[WebSocket] Cannot send audio. Connection state: ${wsRef.current?.readyState || 'null'}`);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log("[WebSocket] Attempting to disconnect from STT");
    
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setReconnectAttempts(0); // Reset reconnect counter
    
    if (wsRef.current) {
      try {
        // Send a signal to backend that recording is complete
        if (wsRef.current.readyState === 1) {
          wsRef.current.send(new Uint8Array([0])); // Single null byte to signal end
        }
      } catch (e) {
        console.warn("[WebSocket] Could not send end signal:", e);
      }
      
      // Give backend time to process the end signal
      setTimeout(() => {
        try {
          if (wsRef.current) {
            wsRef.current.close(1000, "User disconnected"); // Clean close
          }
        } catch (e) {
          console.warn("[WebSocket] Error closing connection:", e);
        }
        wsRef.current = null;
      }, 100);
    }
    
    setConnected(false);
    setError(null);
  }, []);

  const resetConnection = useCallback(() => {
    disconnect();
    setReconnectAttempts(0);
    setError(null);
  }, [disconnect]);

  return { connect, sendAudio, disconnect, resetConnection, connected, error, reconnectAttempts };
}
