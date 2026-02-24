import { useState, useRef } from "react";
import { MessageCircle, Loader, Mic } from "lucide-react";
import { getVoiceAgentResponse } from "../../services/voice-agent.service";
import { textToSpeech } from "../../services/tts.service";
import { useVoiceWebSocket } from "../../hooks/useVoiceWebSocket";

export default function VoiceAgentButton({ onResponseReceived }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

  // WebSocket for Deepgram streaming
  const ws = useVoiceWebSocket((data) => {
    if (!data) return;

    const payload = typeof data === "string"
      ? { text: data, is_final: true, speech_final: true }
      : data;

    if (!payload.text) return;

    const finalText = finalTranscriptRef.current.trim();
    let incoming = payload.text.trim();

    // Avoid duplication
    if (finalText && incoming.startsWith(finalText)) {
      incoming = incoming.slice(finalText.length).trimStart();
    }

    if (payload.is_final || payload.speech_final) {
      if (incoming) {
        finalTranscriptRef.current = finalText ? `${finalText} ${incoming}` : incoming;
      }
      interimTranscriptRef.current = "";
      
      // Auto-send to voice agent when speech ends
      handleSendToAgent(finalTranscriptRef.current);
    } else {
      interimTranscriptRef.current = incoming;
    }

    const combined = [
      finalTranscriptRef.current,
      interimTranscriptRef.current
    ].filter(Boolean).join(" ").trim();

    setTranscript(combined);
  });

  const handleSendToAgent = async (text) => {
    if (!text || text.trim().length === 0) return;

    setIsProcessing(true);
    setError("");
    try {
      console.log("[Voice Agent] Sending transcript:", text);
      
      // Get LLM response
      const response = await getVoiceAgentResponse(text);
      console.log("[Voice Agent] Received response:", response.text);
      
      setAgentResponse(response.text);
      
      // Convert response to speech
      const audioUrl = await textToSpeech(response.text, "en");
      console.log("[Voice Agent] Audio URL:", audioUrl);
      
      // Play audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(err => 
          console.error("[Voice Agent] Audio playback error:", err)
        );
      }
      
      // Notify parent component
      if (onResponseReceived) {
        onResponseReceived(response.text);
      }
    } catch (error) {
      console.error("[Voice Agent] Error:", error.message);
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartLiveAgent = async () => {
    try {
      setIsListening(true);
      setTranscript("");
      setAgentResponse("");
      setError("");
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      
      console.log("[Voice Agent] Starting live agent listening...");
      
      // Connect to websocket
      ws.connect();
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      const nativeSampleRate = audioContext.sampleRate;
      const targetSampleRate = 16000;
      const downsampleFactor = Math.round(nativeSampleRate / targetSampleRate);
      
      console.log(`[Voice Agent] Using sample rate: ${nativeSampleRate}Hz, downsampling to ${targetSampleRate}Hz`);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        try {
          const inputChannelData = event.inputBuffer.getChannelData(0);
          
          if (!inputChannelData || inputChannelData.length === 0) {
            return;
          }
          
          // Downsample
          const downsampled = new Float32Array(Math.ceil(inputChannelData.length / downsampleFactor));
          let downsampledIndex = 0;
          
          for (let i = 0; i < inputChannelData.length; i += downsampleFactor) {
            downsampled[downsampledIndex++] = inputChannelData[i];
          }
          
          // Convert to PCM16
          const pcm16 = new Int16Array(downsampledIndex);
          for (let i = 0; i < downsampledIndex; i++) {
            const s = Math.max(-1, Math.min(1, downsampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          const uint8 = new Uint8Array(pcm16.buffer);
          ws.sendAudio(uint8);
          
        } catch (error) {
          console.error("[Voice Agent] Audio processing error:", error);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      workletNodeRef.current = { 
        processor, 
        source, 
        audioContext
      };
      
      console.log("[Voice Agent] Live agent listening started");
      
    } catch (error) {
      console.error("[Voice Agent] Error starting:", error);
      setError(error.message);
      setIsListening(false);
      handleStopLiveAgent();
    }
  };

  const handleStopLiveAgent = async () => {
    try {
      console.log("[Voice Agent] Stopping live agent...");
      setIsListening(false);
      
      // Disconnect audio
      if (workletNodeRef.current) {
        try {
          if (workletNodeRef.current.processor) {
            workletNodeRef.current.source.disconnect();
            workletNodeRef.current.processor.disconnect();
          }
          if (workletNodeRef.current.audioContext) {
            await workletNodeRef.current.audioContext.close();
          }
        } catch (e) {
          console.warn("[Voice Agent] Error closing audio:", e);
        }
        workletNodeRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      ws.disconnect();
      
      console.log("[Voice Agent] Live agent stopped");
      
    } catch (error) {
      console.error("[Voice Agent] Error stopping:", error);
    }
  };

  return (
    <div className="voice-agent-container flex flex-col gap-2">
      <button
        onClick={isListening ? handleStopLiveAgent : handleStartLiveAgent}
        disabled={isProcessing}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all flex-1 sm:flex-none ${
          isListening
            ? "bg-red-600 text-white hover:bg-red-700"
            : isProcessing
            ? "bg-gray-400 text-white cursor-not-allowed"
            : "bg-purple-600 text-white hover:bg-purple-700"
        }`}
        title="Start live voice agent conversation"
      >
        {isProcessing ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            <span className="hidden sm:inline">Processing...</span>
          </>
        ) : isListening ? (
          <>
            <Mic className="w-5 h-5 animate-pulse" />
            <span className="hidden sm:inline">Stop Agent</span>
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            <span className="hidden sm:inline">Voice Agent</span>
          </>
        )}
      </button>
      
      {transcript && (
        <div className="text-xs sm:text-sm p-2 bg-purple-900 rounded text-purple-100">
          <p className="font-semibold">You: {transcript}</p>
        </div>
      )}
      
      {agentResponse && (
        <div className="text-xs sm:text-sm p-2 bg-purple-800 rounded text-purple-50">
          <p className="font-semibold">Agent: {agentResponse}</p>
        </div>
      )}
      
      {error && (
        <div className="text-xs sm:text-sm p-2 bg-red-900 rounded text-red-100">
          Error: {error}
        </div>
      )}
      
      <audio ref={audioRef} />
    </div>
  );
}
