import { useState, useRef, useEffect } from "react";
import { Mic, X, Loader, Volume2, Languages } from "lucide-react";
import { getVoiceAgentResponse } from "../../services/voice-agent.service";
import { textToSpeech } from "../../services/tts.service";
import { useVoiceWebSocket } from "../../hooks/useVoiceWebSocket";

// Animated waveform component
function AnimatedWaveform({ isActive = false }) {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 bg-gradient-to-t from-blue-400 to-blue-600 rounded-full transition-all ${
            isActive ? "shadow-lg shadow-blue-400" : ""
          }`}
          style={{
            height: isActive ? Math.random() * 20 + 6 + "px" : "4px",
            animation: isActive ? `wave 600ms ease-in-out infinite` : "none",
            animationDelay: i * 100 + "ms"
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceAgentButton({ 
  onAddMessage, 
  messages = [],
  isVoiceAgentActive = false,
  onToggleVoiceAgent 
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

  // Deepgram WebSocket hook
  const ws = useVoiceWebSocket((data) => {
    if (!data) return;

    const payload = typeof data === "string"
      ? { text: data, is_final: true, speech_final: true }
      : data;

    if (!payload.text) return;

    const finalText = finalTranscriptRef.current.trim();
    let incoming = payload.text.trim();

    if (finalText && incoming.startsWith(finalText)) {
      incoming = incoming.slice(finalText.length).trimStart();
    }

    if (payload.is_final || payload.speech_final) {
      if (incoming) {
        finalTranscriptRef.current = finalText ? `${finalText} ${incoming}` : incoming;
      }
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      
      // Auto-send to agent
      if (finalTranscriptRef.current) {
        handleSendVoiceToAgent();
      }
    } else {
      interimTranscriptRef.current = incoming;
      setInterimTranscript(incoming);
    }

    setTranscript(finalTranscriptRef.current);
  }, { path: "voice-agent", maxReconnectAttempts: 3, reconnectDelay: 2000 });

  const handleSendVoiceToAgent = async (customText = null) => {
    const textToSend = customText || finalTranscriptRef.current;
    
    if (!textToSend || textToSend.trim().length === 0) return;

    setIsProcessing(true);
    setError("");

    try {
      // Add user message to main chat
      if (onAddMessage) {
        onAddMessage({
          text: textToSend,
          from: "user",
          timestamp: new Date().toISOString()
        });
      }

      // Get agent response
      const response = await getVoiceAgentResponse(textToSend);
      
      // Add agent response to main chat
      if (onAddMessage) {
        onAddMessage({
          text: response.text,
          from: "agent",
          timestamp: new Date().toISOString(),
          isVoiceAgent: true
        });
      }

      // Convert to speech with language and speed
      const audioUrl = await textToSpeech(response.text, selectedLanguage);
      
      // Auto-play response
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = voiceSpeed;
        audioRef.current.play().catch(err => 
          console.error("[Voice Agent] Playback error:", err)
        );
      }

      // Reset for next input
      finalTranscriptRef.current = "";
      setTranscript("");

    } catch (error) {
      console.error("[Voice Agent] Error:", error);
      setError(error.message);
      if (onAddMessage) {
        onAddMessage({
          text: "⚠️ " + error.message,
          from: "error",
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartListening = async () => {
    try {
      setIsListening(true);
      setError("");
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      setTranscript("");
      setInterimTranscript("");

      ws.connect();
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!ws.connected) {
        throw new Error("Failed to connect to voice service");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const nativeSampleRate = audioContext.sampleRate;
      const targetSampleRate = 16000;
      const downsampleFactor = Math.round(nativeSampleRate / targetSampleRate);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        try {
          const inputChannelData = event.inputBuffer.getChannelData(0);

          if (!inputChannelData?.length) return;

          const downsampled = new Float32Array(
            Math.ceil(inputChannelData.length / downsampleFactor)
          );
          let idx = 0;

          for (let i = 0; i < inputChannelData.length; i += downsampleFactor) {
            downsampled[idx++] = inputChannelData[i];
          }

          const pcm16 = new Int16Array(idx);
          for (let i = 0; i < idx; i++) {
            const s = Math.max(-1, Math.min(1, downsampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          ws.sendAudio(new Uint8Array(pcm16.buffer));

        } catch (err) {
          console.error("[Voice Agent] Audio error:", err);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      workletNodeRef.current = { processor, source, audioContext };

    } catch (error) {
      console.error("[Voice Agent] Start error:", error);
      setError(error.message);
      setIsListening(false);
      handleStopListening();
    }
  };

  const handleStopListening = async () => {
    setIsListening(false);

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.source?.disconnect();
        workletNodeRef.current.processor?.disconnect();
        await workletNodeRef.current.audioContext?.close();
      } catch (e) {
        console.warn("[Voice Agent] Cleanup error:", e);
      }
      workletNodeRef.current = null;
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    ws.disconnect();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        handleStopListening();
      }
    };
  }, []);

  if (!isVoiceAgentActive) {
    return (
      <button
        onClick={onToggleVoiceAgent}
        className="group relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white hover:shadow-2xl hover:shadow-blue-500/50 active:scale-95 overflow-hidden shadow-lg"
        title="Enable Voice Agent"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl"></div>
        <Mic className="w-5 h-5 relative z-10" />
        <span className="relative z-10 text-sm">Voice Agent</span>
        <span className="absolute top-0 right-0 flex h-2.5 w-2.5 z-20">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-lg shadow-green-500/50"></span>
        </span>
      </button>
    );
  }

  return (
    <div className="w-full animate-in fade-in overflow-hidden flex flex-col">
      <style>{`
        @keyframes wave {
          0%, 60%, 100% { transform: scaleY(0.5); }
          30% { transform: scaleY(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-in {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Voice Agent Settings - Horizontal Compact Layout */}
      <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-blue-900/20 rounded-xl p-2 border border-blue-200 dark:border-blue-700/30 space-y-2 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <h3 className="font-semibold text-xs text-gray-900 dark:text-white flex items-center gap-1">
            <Mic className="w-3 h-3 text-blue-600" />
            Voice Agent
          </h3>
          <button
            onClick={onToggleVoiceAgent}
            className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
          >
            <X className="w-3 h-3 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Speed & Language - Horizontal Compact Row */}
        <div className="flex gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap items-center">
          {/* Speed Buttons */}
          <div className="flex gap-1 flex-shrink-0">
            {[0.5, 1.0, 1.5, 2.0].map((speed) => (
              <button
                key={speed}
                onClick={() => setVoiceSpeed(speed)}
                title={`${speed}x speed`}
                className={`py-1 px-1.5 rounded text-[9px] font-bold transition-all duration-200 flex-shrink-0 ${
                  voiceSpeed === speed
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="px-2 py-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-200 dark:border-blue-700 rounded text-[9px] font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer flex-shrink-0 min-w-fit"
          >
            <option value="en">EN</option>
            <option value="en-GB">EN-GB</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="de">DE</option>
            <option value="it">IT</option>
            <option value="pt">PT</option>
            <option value="ja">JA</option>
            <option value="ko">KO</option>
            <option value="zh">ZH</option>
          </select>

          {/* Listen/Stop Button */}
          <button
            onClick={isListening ? handleStopListening : handleStartListening}
            disabled={isProcessing}
            title={isListening ? "Stop listening" : "Start listening"}
            className={`py-1 px-2 rounded font-semibold transition-all duration-300 flex items-center gap-1 text-white text-[9px] flex-shrink-0 whitespace-nowrap ${
              isListening
                ? "bg-gradient-to-r from-red-600 to-red-500 hover:shadow-md hover:scale-105"
                : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-md hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <>
                <Loader className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">...</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3" />
                <span className="hidden sm:inline">{isListening ? "Stop" : "Listen"}</span>
              </>
            )}
          </button>
        </div>

        {/* Transcript - Minimal Display */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-1">
          {transcript && (
            <div className="p-1.5 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded text-[9px]">
              <p className="font-semibold text-green-700 dark:text-green-300">✓ {transcript}</p>
            </div>
          )}

          {interimTranscript && !transcript && (
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded text-[9px]">
              <p className="font-semibold text-blue-700 dark:text-blue-300">🎤 {interimTranscript}</p>
            </div>
          )}

          {isListening && (
            <div className="p-1">
              <AnimatedWaveform isActive={true} />
            </div>
          )}

          {error && (
            <div className="p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-[9px]">
              <p className="text-red-600 dark:text-red-400">⚠️ {error}</p>
            </div>
          )}
        </div>
      </div>

      <audio ref={audioRef} />
    </div>
  );
}

