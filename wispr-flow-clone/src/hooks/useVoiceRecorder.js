
import { useRef, useState } from "react";

/**
 * useVoiceRecorder
 * @param {function} [onData] - Optional callback to handle each audio chunk (e.g., for live streaming to WebSocket)
 * @returns {object} { recording, startRecording, stopRecording }
 */
export function useVoiceRecorder(onData) {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorderRef.current = new MediaRecorder(stream);
    chunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        if (typeof onData === "function") {
          onData(e.data); // Stream chunk to callback (e.g., WebSocket)
        }
      }
    };

    mediaRecorderRef.current.start(250); // 250ms chunks for low latency
    setRecording(true);
  };

  const stopRecording = () =>
    new Promise((resolve) => {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecording(false);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });

  return { recording, startRecording, stopRecording };
}
