import { useRef, useState } from "react";

export function useVoiceRecorder() {
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    mediaRecorderRef.current = new MediaRecorder(stream);
    chunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.start();
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
