import { useState, useRef, useEffect } from "react";
import { MessageCircle, Mic, X, Send, Loader, Volume2, Copy } from "lucide-react";
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
  
  const audioRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const conversationsEndRef = useRef(null);

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
  });

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
      // Add user message
      setConversations(prev => [...prev, {
        id: Date.now(),
        role: "user",
        content: textToSend
      }]);

      // Get LLM response
      const response = await getVoiceAgentResponse(textToSend);
      
      // Add agent response
      setConversations(prev => [...prev, {
        id: Date.now() + 1,
        role: "agent",
        content: response.text
      }]);

      // Convert to speech
      const audioUrl = await textToSpeech(response.text, "en");
      
      // Play audio
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(err => 
          console.error("[Voice Agent] Playback error:", err)
        );
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

      // Connect WebSocket
      ws.connect();
      await new Promise(resolve => setTimeout(resolve, 500));

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

  const openModal = () => {
    setShowModal(true);
    setConversations([]);
    setTranscript("");
    setInterimTranscript("");
    setError("");
  };

  const closeModal = () => {
    setShowModal(false);
    if (isListening) {
      handleStopListening();
    }
  };

  return (
    <>
      <style>{`
        @keyframes wave {
          0%, 60%, 100% { transform: scaleY(0.5); }
          30% { transform: scaleY(1); }
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
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Conversation Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="mb-4 p-4 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 rounded-full">
                    <Mic className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Start a Conversation
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                    Click the microphone button to speak. Your message will be processed instantly.
                  </p>
                </div>
              ) : (
                <>
                  {conversations.map((msg) => (
                    <div key={msg.id} className="flex items-start gap-3">
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
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100 mt-1"
                              title="Copy response"
                            >
                              <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            </button>
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
