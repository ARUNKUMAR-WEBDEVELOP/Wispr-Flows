import { useState, useRef, useEffect } from "react";
import { Mic, X, Loader, Volume2, Languages } from "lucide-react";
import { getVoiceAgentResponse } from "../../services/voice-agent.service";
import { textToSpeech } from "../../services/tts.service";
import { useVoiceWebSocket } from "../../hooks/useVoiceWebSocket";

// Animated waveform component
function AnimatedWaveform({ isActive = false }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-gradient-to-t from-blue-400 to-blue-600 rounded-full transition-all ${
            isActive ? "shadow-lg shadow-blue-400" : ""
          }`}
          style={{
            height: isActive ? Math.random() * 32 + 12 + "px" : "8px",
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
    <div className="w-full space-y-4 animate-in fade-in">
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
      `}</style>

      {/* Voice Agent Settings */}
      <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700/30 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-blue-600" />
            Voice Agent Mode
          </h3>
          <button
            onClick={onToggleVoiceAgent}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Settings Panel */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5" />
                Voice Speed
              </span>
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-mono">{voiceSpeed.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${(voiceSpeed - 0.5) / 1.5 * 100}%, rgb(226, 232, 240) ${(voiceSpeed - 0.5) / 1.5 * 100}%, rgb(226, 232, 240) 100%)`
              }}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-2">
              <Languages className="w-3.5 h-3.5" />
              Language
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-200 dark:border-blue-700 rounded-lg text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="en">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
        </div>

        {/* Voice Control Button */}
        <button
          onClick={isListening ? handleStopListening : handleStartListening}
          disabled={isProcessing}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-white ${
            isListening
              ? "bg-gradient-to-r from-red-600 to-red-500 hover:shadow-lg hover:shadow-red-500/50 hover:scale-105"
              : "bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/50 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>{isListening ? "Listening... Click to Stop" : "Start Listening"}</span>
            </>
          )}
        </button>

        {/* Transcript Display */}
        {transcript && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg">
            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">TRANSCRIPT</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{transcript}</p>
          </div>
        )}

        {interimTranscript && !transcript && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">LISTENING...</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{interimTranscript}</p>
          </div>
        )}

        {isListening && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <AnimatedWaveform isActive={true} />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">⚠️ {error}</p>
          </div>
        )}
      </div>

      <audio ref={audioRef} />
    </div>
  );
}

