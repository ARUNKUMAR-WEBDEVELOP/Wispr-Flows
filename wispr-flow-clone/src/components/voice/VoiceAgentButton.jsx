import { useState, useRef } from "react";
import { MessageCircle, Loader, Mic, X, Send } from "lucide-react";
import { getVoiceAgentResponse } from "../../services/voice-agent.service";
import { textToSpeech } from "../../services/tts.service";
import { useVoiceWebSocket } from "../../hooks/useVoiceWebSocket";

// Waveform animation component
function VoiceWaveform() {
  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-purple-500 rounded-full"
          style={{
            height: Math.random() * 24 + 8 + "px",
            animation: `wave 600ms ease-in-out infinite`,
            animationDelay: i * 100 + "ms"
          }}
        />
      ))}
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex gap-1">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full"
          style={{
            animation: `bounce 1.4s infinite`,
            animationDelay: i * 0.2 + "s"
          }}
        />
      ))}
    </div>
  );
}

export default function VoiceAgentButton({ onResponseReceived }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [displayedResponse, setDisplayedResponse] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
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

  // Typewriter effect for response
  const typeResponse = (text, speed = 30) => {
    let index = 0;
    setDisplayedResponse("");
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedResponse(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  };

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
      
      // Add typewriter effect
      typeResponse(response.text);
      
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
      setShowModal(true);
      setIsListening(true);
      setTranscript("");
      setAgentResponse("");
      setDisplayedResponse("");
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
      setShowModal(false);
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

  const closeModal = () => {
    setShowModal(false);
    handleStopLiveAgent();
  };

  return (
    <>
      <style>{`
        @keyframes wave {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }
        @keyframes bounce {
          0%, 60%, 100% { opacity: 0.3; }
          30% { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .message-animate {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>

      <button
        onClick={handleStartLiveAgent}
        disabled={isListening}
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all flex-1 sm:flex-none ${
          isListening
            ? "bg-purple-600 text-white"
            : "bg-purple-600 text-white hover:bg-purple-700"
        }`}
        title="Start live voice agent conversation"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Voice Agent</span>
      </button>

      {/* Gemini-style Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Voice Agent</h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* User message with waveform */}
              {(isListening || transcript) && (
                <div className="message-animate flex justify-end">
                  <div className="max-w-xs">
                    {isListening && !transcript && (
                      <div className="bg-purple-600 text-white p-4 rounded-2xl rounded-tr-none">
                        <p className="text-sm font-medium mb-2">Listening...</p>
                        <VoiceWaveform />
                      </div>
                    )}
                    {transcript && (
                      <div className="bg-purple-600 text-white p-4 rounded-2xl rounded-tr-none">
                        <p className="text-sm">{transcript}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Agent processing */}
              {isProcessing && !agentResponse && (
                <div className="message-animate flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              {/* Agent response */}
              {displayedResponse && (
                <div className="message-animate flex justify-start">
                  <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-2xl rounded-tl-none max-w-xs">
                    <p className="text-sm">{displayedResponse}</p>
                    {displayedResponse !== agentResponse && (
                      <span className="inline-block w-2 h-4 ml-1 bg-gray-500 animate-pulse" />
                    )}
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="message-animate flex justify-start">
                  <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 p-4 rounded-2xl rounded-tl-none">
                    <p className="text-sm">⚠️ {error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with controls */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex gap-2">
              {isListening ? (
                <button
                  onClick={handleStopLiveAgent}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
                >
                  <Mic className="w-4 h-4" />
                  <span>Stop Listening</span>
                </button>
              ) : (
                <button
                  onClick={handleStartLiveAgent}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Listening</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <audio ref={audioRef} />
    </>
  );
}
