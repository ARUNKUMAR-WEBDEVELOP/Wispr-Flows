import { useState, useRef, useEffect } from "react";
import { MessageCircle, Mic, X, Send, Loader, Volume2, Copy, Download, Pause, Play, RotateCcw, Settings, Languages } from "lucide-react";
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
          className={`w-1 bg-gradient-to-t from-purple-400 to-purple-600 rounded-full transition-all ${
            isActive ? "shadow-lg shadow-purple-400" : ""
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

function VoiceRing({ isActive = false }) {
  return (
    <div className="relative flex items-center justify-center">
      <div className={`voice-ring ${isActive ? "voice-ring-active" : ""}`} />
      <div className={`voice-ring-core ${isActive ? "voice-ring-core-active" : ""}`}>
        <Mic className="w-6 h-6 text-white/90" />
      </div>
    </div>
  );
}

// Modern message component
function Message({ role, content, isTyping = false }) {
  const isUser = role === "user";
  
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
          isUser
            ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-br-none"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none"
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>
        {isTyping && (
          <span className="inline-block w-2 h-4 ml-1 bg-current opacity-75 animate-pulse" />
        )}
      </div>
    </div>
  );
}

// Loading indicator
function LoadingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-none">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Voice transcript display
function TranscriptDisplay({ text, isInterim = false }) {
  if (!text) return null;
  
  return (
    <div className={`mb-4 p-3 rounded-lg ${
      isInterim
        ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700"
        : "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700"
    }`}>
      <p className={`text-xs font-semibold mb-1 ${isInterim ? "text-purple-600 dark:text-purple-400" : "text-green-600 dark:text-green-400"}`}>
        {isInterim ? "LISTENING..." : "FINAL TRANSCRIPT"}
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
    </div>
  );
}

export default function VoiceAgentButton({ onResponseReceived }) {
  const [showModal, setShowModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  
  // Enhanced features
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [showSettings, setShowSettings] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  
  const audioRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const conversationsEndRef = useRef(null);
  const audioUrlsRef = useRef({}); // Store audio URLs for replay

  // Keep only last N messages to prevent modal overflow
  const MAX_VISIBLE_MESSAGES = 4;
  const displayedConversations = conversations.slice(-MAX_VISIBLE_MESSAGES);
  const hasMoreMessages = conversations.length > MAX_VISIBLE_MESSAGES;

  // Deepgram WebSocket hook
  const ws = useVoiceWebSocket((data) => {
    if (!data) return;

    const payload = typeof data === "string"
      ? { text: data, is_final: true, speech_final: true }
      : data;

    if (!payload.text) return;

    const finalText = finalTranscriptRef.current.trim();
    let incoming = payload.text.trim();

    // Remove duplicate prefix
    if (finalText && incoming.startsWith(finalText)) {
      incoming = incoming.slice(finalText.length).trimStart();
    }

    if (payload.is_final || payload.speech_final) {
      if (incoming) {
        finalTranscriptRef.current = finalText ? `${finalText} ${incoming}` : incoming;
      }
      interimTranscriptRef.current = "";
      setInterimTranscript("");
      
      // Auto-send to LLM
      if (finalTranscriptRef.current) {
        handleSendToAgent();
      }
    } else {
      interimTranscriptRef.current = incoming;
      setInterimTranscript(incoming);
    }

    setTranscript(finalTranscriptRef.current);
  }, { path: "voice-agent", maxReconnectAttempts: 3, reconnectDelay: 2000 });

  // Update error state from WebSocket
  useEffect(() => {
    if (ws.error) {
      setError(ws.error);
    }
  }, [ws.error]);

  // Auto-scroll to bottom
  useEffect(() => {
    conversationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations]);

  const handleSendToAgent = async (customText = null) => {
    const textToSend = customText || finalTranscriptRef.current;
    
    if (!textToSend || textToSend.trim().length === 0) return;

    setIsProcessing(true);
    setError("");

    try {
      // Add user message with timestamp
      setConversations(prev => [...prev, {
        id: Date.now(),
        role: "user",
        content: textToSend,
        timestamp: new Date().toISOString()
      }]);

      // Get LLM response
      const response = await getVoiceAgentResponse(textToSend);
      
      // Create unique message ID
      const agentMessageId = Date.now() + Math.floor(Math.random() * 1000);
      
      // Add agent response with timestamp
      setConversations(prev => [...prev, {
        id: agentMessageId,
        role: "agent",
        content: response.text,
        timestamp: new Date().toISOString()
      }]);

      // Convert to speech with selected language and speed
      const audioUrl = await textToSpeech(response.text, selectedLanguage);
      
      // Store audio URL for replay
      audioUrlsRef.current[agentMessageId] = audioUrl;
      
      // Play audio with speed control
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.playbackRate = voiceSpeed;
        audioRef.current.play().catch(err => 
          console.error("[Voice Agent] Playback error:", err)
        );
        setIsPlaying(true);
        setCurrentPlayingId(agentMessageId);
      }

      // Notify parent
      if (onResponseReceived) {
        onResponseReceived(response.text);
      }

      // Reset for next input
      finalTranscriptRef.current = "";
      setTranscript("");

    } catch (error) {
      console.error("[Voice Agent] Error:", error);
      setError(error.message);
      setConversations(prev => [...prev, {
        id: Date.now() + 1,
        role: "error",
        content: "⚠️ " + error.message
      }]);
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

      // Connect WebSocket with error handling
      ws.connect();
      
      // Wait for connection with timeout
      const connectionTimeout = setTimeout(() => {
        if (!ws.connected) {
          throw new Error("WebSocket connection timeout. Please check your network.");
        }
      }, 5000);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      clearTimeout(connectionTimeout);
      
      if (!ws.connected) {
        throw new Error("Failed to establish WebSocket connection");
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      streamRef.current = stream;

      // Setup audio context
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

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Audio playback controls
  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Playback error:", err));
      setIsPlaying(true);
    }
  };

  const handleReplay = (messageId) => {
    const audioUrl = audioUrlsRef.current[messageId];
    if (!audioUrl || !audioRef.current) return;
    
    audioRef.current.src = audioUrl;
    audioRef.current.playbackRate = voiceSpeed;
    audioRef.current.play().catch(err => console.error("Replay error:", err));
    setIsPlaying(true);
    setCurrentPlayingId(messageId);
  };

  // Export conversation history
  const handleExportConversation = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      conversations: conversations.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString()
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-agent-conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle audio ended event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, []);

  const openModal = () => {
    setShowModal(true);
    setConversations([]);
    setTranscript("");
    setInterimTranscript("");
    setError("");
    ws.resetConnection(); // Reset any previous connection state
  };

  const closeModal = () => {
    setShowModal(false);
    if (isListening) {
      handleStopListening();
    }
    ws.resetConnection(); // Clean up connection
  };

  useEffect(() => {
    if (!showModal) return;
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [showModal]);

  useEffect(() => {
    if (!showModal) return;
    const { body, documentElement } = document;
    const prevBodyOverflow = body.style.overflow;
    const prevDocOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      body.style.overflow = prevBodyOverflow;
      documentElement.style.overflow = prevDocOverflow;
    };
  }, [showModal]);

  return (
    <>
      <style>{`
        /* Enhanced Animations */
        @keyframes wave {
          0%, 60%, 100% { transform: scaleY(0.5); }
          30% { transform: scaleY(1); }
        }
        @keyframes ringSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translateY(40px) scale(0.96);
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1);
          }
        }
        @keyframes slideInBottom {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); }
          50% { box-shadow: 0 0 30px rgba(168, 85, 247, 0.6), 0 0 40px rgba(168, 85, 247, 0.3); }
        }
        .animate-in {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .modal-enter {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .slide-in-from-bottom-2 {
          animation: slideInBottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .float-animation {
          animation: float 3s ease-in-out infinite;
        }
        .glow-animation {
          animation: glow 2s ease-in-out infinite;
        }
        /* Modern Glass Effect */
        .glass-panel {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.65);
        }
        .dark .glass-panel {
          background: rgba(17, 24, 39, 0.86);
          border: 1px solid rgba(75, 85, 99, 0.35);
        }
        .voice-ring {
          width: 160px;
          height: 160px;
          border-radius: 9999px;
          background: conic-gradient(
            from 0deg,
            #8b5cf6,
            #ec4899,
            #06b6d4,
            #10b981,
            #f59e0b,
            #8b5cf6
          );
          filter: drop-shadow(0 8px 32px rgba(139, 92, 246, 0.4));
        }
        .voice-ring-active {
          animation: ringSpin 6s linear infinite;
        }
        .voice-ring-core {
          position: absolute;
          width: 84px;
          height: 84px;
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 35%, #4c1d95, #1e1b4b);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            inset 0 0 20px rgba(0, 0, 0, 0.5),
            0 4px 24px rgba(139, 92, 246, 0.3);
        }
        .voice-ring-core-active {
          animation: ringPulse 1.5s ease-in-out infinite;
        }
        .gradient-border {
          position: relative;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1));
        }
        .gradient-border::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Voice Agent Button - Premium Design */}
      <button
        onClick={openModal}
        className="group relative flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all duration-300 flex-1 sm:flex-none bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white hover:shadow-2xl hover:shadow-purple-500/50 active:scale-95 overflow-hidden shadow-lg animate-pulse-slow"
        title="Open AI Voice Agent"
      >
        {/* Animated background glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
        
        {/* Icon with animation */}
        <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
          <MessageCircle className="w-4 h-4" />
        </div>
        
        <span className="hidden sm:inline relative z-10 tracking-wide">AI Voice Agent</span>
        
        {/* Pulse indicator */}
        <span className="absolute top-1 right-1 flex h-3 w-3 z-20">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 shadow-lg shadow-green-500/50"></span>
        </span>
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      </button>

      {/* Modal - Premium Glassmorphism Design - Fixed at Top Start */}
      {showModal && (
        <div 
          className=" inset-0 bg-gradient-to-br from-purple-900/35 via-black/55 to-pink-900/35 backdrop-blur-xl z-[9999] animate-in flex items-start justify-center p-4 sm:p-6"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden modal-enter border border-purple-500/30 animate-slide-in mt-2">
            
            {/* Header - Premium Design */}
            <div className="relative flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 overflow-hidden shadow-2xl shrink-0">
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400/30 to-pink-400/30 animate-pulse"></div>
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-40 h-40 bg-white/30 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-pink-300/30 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      AI Voice Agent
                      <span className="inline-flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400 shadow-lg shadow-green-400/50"></span>
                      </span>
                    </h2>
                    <p className="text-xs text-white/90 mt-0.5 font-medium backdrop-blur-sm">✨ Powered by Deepgram & Gemini AI</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 relative z-10">
                {conversations.length > 0 && (
                  <button
                    onClick={handleExportConversation}
                    className="p-2.5 bg-white/10 hover:bg-white/25 backdrop-blur-sm rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg"
                    title="Export conversation"
                  >
                    <Download className="w-5 h-5 text-white drop-shadow-lg" />
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2.5 bg-white/10 hover:bg-white/25 backdrop-blur-sm rounded-xl transition-all duration-300 hover:scale-110 hover:rotate-90 active:scale-95 shadow-lg"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 text-white drop-shadow-lg" />
                </button>
                <button
                  onClick={closeModal}
                  className="p-2.5 bg-white/10 hover:bg-red-500/50 backdrop-blur-sm rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg group"
                  title="Close"
                >
                  <X className="w-5 h-5 text-white drop-shadow-lg group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>
            </div>

            {/* Settings Panel - Enhanced */}
            {showSettings && (
              <div className="p-5 border-b border-purple-200/30 dark:border-purple-500/20 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-purple-900/20 space-y-4 animate-in backdrop-blur-sm shrink-0">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5" />
                      Voice Speed
                    </span>
                    <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-mono">{voiceSpeed.toFixed(1)}x</span>
                  </label>
                  <div className="relative">
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceSpeed}
                      onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-gradient-to-r from-purple-200 to-pink-200 dark:from-purple-900 dark:to-pink-900 rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, rgb(147 51 234) 0%, rgb(147 51 234) ${(voiceSpeed - 0.5) / 1.5 * 100}%, rgb(226 232 240) ${(voiceSpeed - 0.5) / 1.5 * 100}%, rgb(226 232 240) 100%)`
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-2">
                    <Languages className="w-3.5 h-3.5" />
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-2 border-purple-200 dark:border-purple-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all cursor-pointer hover:border-purple-400 shadow-sm"
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
            )}

            {/* Conversation Area */}
            <div className="flex-1 min-h-0 overflow-hidden p-5 sm:p-6 space-y-4">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-8">
                  <div className="relative">
                    <VoiceRing isActive={isListening} />
                    {isListening && (
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        Listening...
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Talk to your agent
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 max-w-xs leading-relaxed">
                      ✨ Speak naturally and get instant answers with AI-powered voice assistance
                    </p>
                  </div>
                  <button
                    onClick={isListening ? handleStopListening : handleStartListening}
                    className={`group relative px-8 py-3 rounded-xl font-bold transition-all duration-300 overflow-hidden ${
                      isListening
                        ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-2xl hover:shadow-red-500/50 hover:scale-105 active:scale-95"
                        : "bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
                    }`}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      <Mic className="w-5 h-5" />
                      {isListening ? "Stop Listening" : "Start Conversation"}
                    </span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  </button>
                </div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <div className="sticky top-0 z-40 text-center py-2 px-3 bg-purple-600/20 rounded-lg border border-purple-500/30 backdrop-blur-sm">
                      <p className="text-xs text-purple-300 font-medium">
                        ↑ {conversations.length - MAX_VISIBLE_MESSAGES} earlier messages (auto-collapsed)
                      </p>
                    </div>
                  )}
                  {displayedConversations.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3 group animate-in slide-in-from-bottom-2">
                      {msg.role !== "user" && (
                        <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50 ring-2 ring-white/20 float-animation">
                          <span className="text-white text-sm font-bold">AI</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <Message
                            role={msg.role}
                            content={msg.content}
                          />
                          {msg.role !== "user" && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <button
                                onClick={() => handleReplay(msg.id)}
                                className="shrink-0 p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-800/60 transition-all duration-300 hover:scale-110 active:scale-95"
                                title="Replay audio"
                              >
                                <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </button>
                              <button
                                onClick={() => handleCopy(msg.content, msg.id)}
                                className="shrink-0 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 hover:scale-110 active:scale-95"
                                title="Copy response"
                              >
                                {copiedId === msg.id ? (
                                  <span className="text-xs text-green-600 dark:text-green-400 px-1 font-bold">✓</span>
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isProcessing && <LoadingIndicator />}
                  
                  {transcript && (
                    <TranscriptDisplay text={transcript} isInterim={false} />
                  )}
                  
                  {interimTranscript && !isProcessing && (
                    <TranscriptDisplay text={interimTranscript} isInterim={true} />
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">⚠️ {error}</p>
                    </div>
                  )}

                  <div ref={conversationsEndRef} />
                </>
              )}
            </div>

            {/* Voice Input Section - Enhanced */}
            {isListening && (
              <div className="px-6 py-5 border-t border-purple-200/30 dark:border-purple-500/20 bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50 dark:from-purple-900/30 dark:via-pink-900/30 dark:to-purple-900/30 backdrop-blur-sm animate-in shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    Recording Audio
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Speak clearly...</span>
                </div>
                <AnimatedWaveform isActive={true} />
              </div>
            )}

            {/* Audio Playback Controls - Enhanced */}
            {isPlaying && currentPlayingId && (
              <div className="px-6 py-4 border-t border-purple-200/30 dark:border-purple-500/20 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm animate-in shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg glow-animation">
                      <Volume2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-purple-700 dark:text-purple-300 block">Playing Response</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Speed: {voiceSpeed.toFixed(1)}x</span>
                    </div>
                  </div>
                  <button
                    onClick={handlePlayPause}
                    className="p-2.5 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95"
                    title="Pause"
                  >
                    <Pause className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Footer with Controls - Enhanced */}
            <div className="p-6 border-t border-purple-200/30 dark:border-purple-500/20 bg-gradient-to-br from-gray-50 via-purple-50/30 to-pink-50/30 dark:from-gray-900 dark:via-purple-900/10 dark:to-pink-900/10 backdrop-blur-sm shrink-0">
              <div className="flex gap-3">
                {isListening ? (
                  <>
                    <button
                      onClick={handleStopListening}
                      className="group relative flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-red-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-300 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                      <Mic className="w-5 h-5 relative z-10" />
                      <span className="relative z-10">Stop Listening</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleStartListening}
                      disabled={isProcessing}
                      className="group relative flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white rounded-xl font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl"></div>
                      {isProcessing ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin relative z-10" />
                          <span className="relative z-10">Processing...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-5 h-5 relative z-10" />
                          <span className="relative z-10">Start Listening</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} />
    </>
  );
}
