import { useRef, useState } from "react";

export function useVoiceWebSocket(onTranscript) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = () => {
    wsRef.current = new WebSocket("ws://localhost:8000/ws/speech/");
    wsRef.current.binaryType = "arraybuffer";
    wsRef.current.onopen = () => setConnected(true);
    wsRef.current.onclose = () => setConnected(false);
    wsRef.current.onerror = () => setConnected(false);
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript" && onTranscript) {
          onTranscript(data.text);
        }
      } catch {}
    };
  };

  const sendAudio = (audio) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(audio);
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
  };

  return { connect, sendAudio, disconnect, connected };
}
