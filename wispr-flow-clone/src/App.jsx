import { useState, useEffect, useRef } from "react";
import { useVoiceWebSocket } from "./hooks/useVoiceWebSocket";
import Sidebar from "./components/layout/Sidebar";
import { Menu } from "lucide-react";
import Header from "./components/layout/Header";
import VoiceButton from "./components/voice/VoiceButton";
import ChatWindow from "./components/chat/ChatWindow";
import GoogleLoginButton from "./components/Auth/GoogleLoginButton";
import { fetchChatHistory, createChatSession, fetchSessionMessages } from "./services/history.service";
import { sendMessageToAI } from "./services/ai.service";
import { logout } from "./services/auth.service";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  // Voice recording handlers (must be after useState)

  const [showModal, setShowModal] = useState(() => !localStorage.getItem("access_token"));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginStep, setLoginStep] = useState(null); // null, "login", "skip"
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem("access_token"));
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");

  const ws = useVoiceWebSocket((data) => {
    if (!data) return;

    const payload = typeof data === "string"
      ? { text: data, is_final: true, speech_final: true }
      : data;

    if (!payload.text) return;

    const finalText = finalTranscriptRef.current.trim();
    let incoming = payload.text.trim();

    // Avoid duplication if Deepgram sends full transcript
    if (finalText && incoming.startsWith(finalText)) {
      incoming = incoming.slice(finalText.length).trimStart();
    }

    if (payload.is_final || payload.speech_final) {
      if (incoming) {
        finalTranscriptRef.current = finalText ? `${finalText} ${incoming}` : incoming;
      }
      interimTranscriptRef.current = "";
    } else {
      interimTranscriptRef.current = incoming;
    }

    const combined = [
      finalTranscriptRef.current,
      interimTranscriptRef.current
    ].filter(Boolean).join(" ").trim();

    setLiveTranscript(combined);
    if (listening) {
      setInputText(combined);
    }
  });

  // Live streaming voice handlers using Web Audio API for PCM
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

  const handleStartVoice = async () => {
    try {
      setListening(true);
      setLiveTranscript("");
      finalTranscriptRef.current = "";
      interimTranscriptRef.current = "";
      setInputText("");
      console.log("[Voice] Starting voice recording...");
      
      // Connect to websocket FIRST
      ws.connect();
      
      // Wait a moment for websocket to connect
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log("[Voice] Getting microphone access...");
      // Don't specify sampleRate in constraints - most browsers ignore it for input
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false
        }
      });
      streamRef.current = stream;
      console.log("[Voice] Microphone access granted");

      // Create audio context at browser's native sample rate
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Resume audio context if suspended
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log("[Voice] Audio context resumed");
      }
      
      const nativeSampleRate = audioContext.sampleRate;
      const targetSampleRate = 16000;
      const downsampleFactor = Math.round(nativeSampleRate / targetSampleRate);
      
      console.log(`[Voice] Native sample rate: ${nativeSampleRate}Hz, downsampling to ${targetSampleRate}Hz (factor: ${downsampleFactor})`);

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let sampleBuffer = [];

      processor.onaudioprocess = (event) => {
        try {
          // Get input data - this should work now that we're at native sample rate
          const inputChannelData = event.inputBuffer.getChannelData(0);
          
          if (!inputChannelData || inputChannelData.length === 0) {
            console.warn("[Voice] Empty audio buffer");
            return;
          }
          
          console.log(`[Voice] Got ${inputChannelData.length} samples`);
          
          // Downsample: take every Nth sample
          const downsampled = new Float32Array(Math.ceil(inputChannelData.length / downsampleFactor));
          let downsampledIndex = 0;
          
          for (let i = 0; i < inputChannelData.length; i += downsampleFactor) {
            downsampled[downsampledIndex++] = inputChannelData[i];
          }
          
          // Convert float32 to int16 PCM
          const pcm16 = new Int16Array(downsampledIndex);
          for (let i = 0; i < downsampledIndex; i++) {
            const s = Math.max(-1, Math.min(1, downsampled[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Send as uint8
          const uint8 = new Uint8Array(pcm16.buffer);
          ws.sendAudio(uint8);
          console.log(`[Voice] Sent ${uint8.byteLength} bytes of 16-bit PCM`);
          
        } catch (error) {
          console.error("[Voice] Error in onaudioprocess:", error);
        }
      };

      processor.onerror = (event) => {
        console.error("[Voice] ScriptProcessorNode error:", event);
      };

      // Proper connection: source -> processor -> destination
      source.connect(processor);
      processor.connect(audioContext.destination);

      workletNodeRef.current = { 
        processor, 
        source, 
        audioContext
      };
      
      console.log("[Voice] Audio processor initialized and connected");
      
    } catch (error) {
      console.error("[Voice] Error starting voice recording:", error);
      setListening(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      ws.disconnect();
    }
  };

  const handleStopVoice = async () => {
    try {
      console.log("[Voice] Stopping voice recording...");
      setListening(false);
      
      // Disconnect Web Audio API
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
          console.warn("[Voice] Error closing audio context:", e);
        }
        workletNodeRef.current = null;
      }
      
      if (streamRef.current) {
        console.log("[Voice] Stopping audio stream tracks...");
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      console.log("[Voice] Disconnecting from websocket...");
      ws.disconnect();
      
      // Wait for final transcript
      await new Promise(resolve => setTimeout(resolve, 500));

      const combined = `${finalTranscriptRef.current}${interimTranscriptRef.current ? " " + interimTranscriptRef.current : ""}`.trim();
      setInputText(combined);
      setLiveTranscript(combined);
      console.log("[Voice] Voice recording complete");
      
    } catch (error) {
      console.error("[Voice] Error stopping voice recording:", error);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchChatHistory().then(sessions => {
        setSessions(sessions);
        if (Array.isArray(sessions) && sessions.length > 0) {
          setActiveSession(sessions[0].session_id);
          setMessages(sessions[0].messages.map(m => ({ ...m, streaming: false })));
        }
      });
    }
  }, [authenticated]);

  const handleLogin = async (data) => {
    // Store user and tokens if present
    if (data.user) {
      setUser(data.user);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    if (data.tokens && data.tokens.access) {
      setAuthenticated(true);
      setShowModal(false);
      localStorage.setItem("access_token", data.tokens.access);
      localStorage.setItem("refresh_token", data.tokens.refresh || "");
    }
    // Fetch sessions
    const sessions = await fetchChatHistory();
    setSessions(sessions);
    if (Array.isArray(sessions) && sessions.length > 0) {
      setActiveSession(sessions[0].session_id);
      setMessages(sessions[0].messages.map(m => ({ ...m, streaming: false })));
    }
  };

  const handleSkip = () => {
    setShowModal(false);
    setLoginStep("skip");
  };

  const handleNewChat = async () => {
    if (authenticated) {
      // Create new session in backend
      const session = await createChatSession();
      // Fetch the full session object (with messages, title, etc.)
      const [latestSessions, messages] = await Promise.all([
        fetchChatHistory(),
        fetchSessionMessages(session.session_id)
      ]);
      setSessions(latestSessions);
      setActiveSession(session.session_id);
      setMessages(messages.map(m => ({ ...m, streaming: false })));
    } else {
      setActiveSession("guest");
      setMessages([]);
    }
  };

  const handleSessionSelect = async (sessionId) => {
    setActiveSession(sessionId);
    // Fetch messages from backend for this session
    const messages = await fetchSessionMessages(sessionId);
    setMessages(messages.map(m => ({ ...m, streaming: false })));
  };

  // Handle manual chat submit
  const handleSendText = async () => {
    if (!inputText) return;

    setMessages((prev) => {
      const updated = [...prev, { role: "user", content: inputText, streaming: false }];
      if (!authenticated) localStorage.setItem("guestChat", JSON.stringify(updated));
      return updated;
    });

    setInputText("");
    setAiStreaming(true);

    try {
      const aiResponse = await sendMessageToAI(inputText);
      setMessages((prev) => {
        const updated = [...prev, { role: "assistant", content: aiResponse.text, streaming: false, language: aiResponse.language }];
        if (!authenticated) localStorage.setItem("guestChat", JSON.stringify(updated));
        // Do not auto-speak; use MessageActions for manual TTS controls
        return updated;
      });
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }

    setAiStreaming(false);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setUser(null);
    setAuthenticated(false);
    setMessages([]);
    setSessions([]);
    setActiveSession(null);
    setShowModal(true);
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("guestChat");
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar for desktop, drawer for mobile/tablet */}
      {/* Hamburger menu for mobile/tablet */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800 p-2 rounded-lg shadow-lg"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={24} />
      </button>
      {/* Sidebar: show as drawer on mobile/tablet, static on desktop */}
      <div>
        <Sidebar
          sessions={sessions}
          activeSession={activeSession}
          onSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          user={user}
          authenticated={authenticated}
          onLogout={handleLogout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>
      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <Header authenticated={authenticated} onLogin={() => { setShowModal(true); setLoginStep("login"); }} />
        <AnimatePresence>
          {showModal && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white text-gray-900 rounded-lg p-8 shadow-lg w-full max-w-md"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
              >
                <h2 className="text-2xl font-bold mb-4">Welcome to Wispr Flow</h2>
                <div className="flex flex-col gap-4">
                  <button
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition"
                    onClick={() => setLoginStep("login")}
                  >
                    Login
                  </button>
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 transition"
                    onClick={handleSkip}
                  >
                    Skip
                  </button>
                </div>
                {loginStep === "login" && (
                  <div className="mt-6">
                    <GoogleLoginButton onSuccess={handleLogin} />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live transcript streaming UI */}
        {listening && liveTranscript && (
          <div
            className="live-transcript-streaming"
            style={{
              position: 'fixed',
              bottom: window.innerWidth < 640 ? 80 : 120,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              padding: window.innerWidth < 640 ? '0.5rem 1rem' : '1rem 2rem',
              borderRadius: '2rem',
              fontSize: window.innerWidth < 640 ? '1rem' : '1.25rem',
              zIndex: 1000,
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              animation: 'fadeIn 0.3s',
              maxWidth: '98vw',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>{liveTranscript}</span>
          </div>
        )}

        {/* Chat window */}
        <ChatWindow messages={messages} isTyping={aiStreaming} />

        <div className="p-2 sm:p-4 border-t border-gray-700 flex flex-col gap-2 sm:gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <VoiceButton
              listening={listening}
              onStart={handleStartVoice}
              onStop={handleStopVoice}
            />
            <input
              type="text"
              value={listening ? liveTranscript : inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendText()}
              placeholder="Type your message..."
              className="flex-1 p-2 text-base rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
              disabled={listening}
            />
            <button
              onClick={handleSendText}
              disabled={aiStreaming}
              className="px-4 py-2 text-base bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg w-full sm:w-auto"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
