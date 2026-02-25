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

  return (
    <>
      <style>{`
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
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-in {
          animation: fadeIn 0.3s ease-out;
        }
        .slide-in-from-bottom-2 {
          animation: slideInBottom 0.3s ease-out;
        }
        @keyframes slideInBottom {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .voice-ring {
          width: 150px;
          height: 150px;
          border-radius: 9999px;
          background: conic-gradient(
            #7c3aed,
            #22d3ee,
            #a855f7,
            #10b981,
            #7c3aed
          );
          filter: drop-shadow(0 0 12px rgba(124, 58, 237, 0.5));
        }
        .voice-ring-active {
          animation: ringSpin 4s linear infinite;
        }
        .voice-ring-core {
          position: absolute;
          width: 76px;
          height: 76px;
          border-radius: 9999px;
          background: radial-gradient(circle at 30% 30%, #1f2937, #0f172a);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.4);
        }
        .voice-ring-core-active {
          animation: ringPulse 1.2s ease-in-out infinite;
        }
      `}</style>

      {/* Voice Agent Button */}
      <button
        onClick={openModal}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-300 flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600 shadow-lg hover:shadow-purple-500/40 active:scale-95"
        title="Open Voice Agent"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Voice Agent</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 dark:from-gray-800 to-purple-100 dark:to-gray-900">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Voice Agent</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Powered by Deepgram & Gemini</p>
              </div>
              <div className="flex items-center gap-2">
                {conversations.length > 0 && (
                  <button
                    onClick={handleExportConversation}
                    className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                    title="Export conversation"
                  >
                    <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </button>
                )}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/10 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    Voice Speed: {voiceSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 block">
                    <Languages className="w-3 h-3 inline mr-1" />
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-6">
                  <VoiceRing isActive={isListening} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Talk to your agent
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                      Speak naturally and get answers in real time.
                    </p>
                  </div>
                  <button
                    onClick={isListening ? handleStopListening : handleStartListening}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                      isListening
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                    }`}
                  >
                    {isListening ? "Stop" : "Talk To Your Agent"}
                  </button>
                </div>
              ) : (
                <>
                  {conversations.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3 group">
                      {msg.role !== "user" && (
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs font-bold">A</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <Message
                            role={msg.role}
                            content={msg.content}
                          />
                          {msg.role !== "user" && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleReplay(msg.id)}
                                className="flex-shrink-0 p-2 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                title="Replay audio"
                              >
                                <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                              </button>
                              <button
                                onClick={() => handleCopy(msg.content, msg.id)}
                                className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                title="Copy response"
                              >
                                {copiedId === msg.id ? (
                                  <span className="text-xs text-green-600 dark:text-green-400 px-1">✓</span>
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

            {/* Voice Input Section */}
            {isListening && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
                <AnimatedWaveform isActive={true} />
              </div>
            )}

            {/* Audio Playback Controls */}
            {isPlaying && currentPlayingId && (
              <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Playing response...</span>
                  </div>
                  <button
                    onClick={handlePlayPause}
                    className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </button>
                </div>
              </div>
            )}

            {/* Footer with Controls */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex gap-3">
                {isListening ? (
                  <>
                    <button
                      onClick={handleStopListening}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors active:scale-95"
                    >
                      <Mic className="w-4 h-4" />
                      Stop Listening
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleStartListening}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-600 transition-colors disabled:opacity-50 active:scale-95"
                    >
                      {isProcessing ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          Start Listening
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
