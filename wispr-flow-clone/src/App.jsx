import { useState, useEffect, useRef } from "react";
import { useVoiceWebSocket } from "./hooks/useVoiceWebSocket";
import Sidebar from "./components/layout/Sidebar";
import { Menu, Sparkles } from "lucide-react";
import Header from "./components/layout/Header";
import VoiceButton from "./components/voice/VoiceButton";
import VoiceAgentButton from "./components/voice/VoiceAgentButton";
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
  const [activeSession, setActiveSession] = useState(() => localStorage.getItem("activeSession") || null);
  const [messages, setMessages] = useState(() => {
    const stored = localStorage.getItem("guestChat");
    return stored && !localStorage.getItem("access_token") ? JSON.parse(stored) : [];
  });
  const [inputText, setInputText] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isVoiceAgentActive, setIsVoiceAgentActive] = useState(false);
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

  // Load chat history on mount or when authenticated status changes
  useEffect(() => {
    if (authenticated) {
      fetchChatHistory().then(sessions => {
        setSessions(sessions || []);
        // Try to restore previously active session
        const savedSessionId = localStorage.getItem("activeSession");
        if (Array.isArray(sessions) && sessions.length > 0) {
          const targetSession = sessions.find(s => s.session_id === savedSessionId) || sessions[0];
          setActiveSession(targetSession.session_id);
          localStorage.setItem("activeSession", targetSession.session_id);
          // Fetch messages for this session
          fetchSessionMessages(targetSession.session_id).then(msgs => {
            setMessages((msgs || []).map(m => ({ ...m, streaming: false })));
          }).catch(err => {
            console.error("Error loading messages:", err);
            setMessages([]);
          });
        }
      }).catch(err => {
        console.error("Error loading chat history:", err);
        setSessions([]);
        setMessages([]);
      });
    } else {
      // Load guest chat from localStorage
      const stored = localStorage.getItem("guestChat");
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
          setActiveSession("guest");
        } catch (e) {
          console.error("Error parsing guest chat:", e);
          localStorage.removeItem("guestChat");
        }
      }
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
      localStorage.removeItem("guestChat");
    }
    try {
      // Fetch sessions
      const sessions = await fetchChatHistory();
      setSessions(sessions || []);
      if (Array.isArray(sessions) && sessions.length > 0) {
        const targetSession = sessions[0];
        setActiveSession(targetSession.session_id);
        localStorage.setItem("activeSession", targetSession.session_id);
        // Fetch messages for this session
        const messages = await fetchSessionMessages(targetSession.session_id);
        setMessages((messages || []).map(m => ({ ...m, streaming: false })));
      }
    } catch (error) {
      console.error("Error during login session fetch:", error);
      setMessages([]);
    }
  };

  const handleSkip = () => {
    setShowModal(false);
    setLoginStep("skip");
  };

  const handleNewChat = async () => {
    if (authenticated) {
      try {
        // Create new session in backend
        const session = await createChatSession();
        // Fetch the full session list and messages
        const [latestSessions, messages] = await Promise.all([
          fetchChatHistory(),
          fetchSessionMessages(session.session_id)
        ]);
        setSessions(latestSessions || []);
        setActiveSession(session.session_id);
        localStorage.setItem("activeSession", session.session_id);
        setMessages((messages || []).map(m => ({ ...m, streaming: false })));
      } catch (error) {
        console.error("Error creating new chat:", error);
      }
    } else {
      // Guest chat - create new session locally
      const guestSessionId = "guest-" + Date.now();
      setActiveSession(guestSessionId);
      localStorage.setItem("activeSession", guestSessionId);
      setMessages([]);
      localStorage.removeItem("guestChat");
    }
  };

  const handleSessionSelect = async (sessionId) => {
    setActiveSession(sessionId);
    localStorage.setItem("activeSession", sessionId);
    try {
      // Fetch messages from backend for this session
      const messages = await fetchSessionMessages(sessionId);
      setMessages((messages || []).map(m => ({ ...m, streaming: false })));
    } catch (error) {
      console.error("Error loading session messages:", error);
      setMessages([]);
    }
  };

  // Handle adding messages from Voice Agent to main chat
  const handleAddMessage = (message) => {
    setMessages((prev) => {
      const newMessage = {
        role: message.from === "user" ? "user" : message.from === "agent" ? "assistant" : "error",
        content: message.text,
        streaming: false,
        isVoiceAgent: message.isVoiceAgent || false,
        timestamp: message.timestamp
      };
      const updated = [...prev, newMessage];
      if (!authenticated) localStorage.setItem("guestChat", JSON.stringify(updated));
      return updated;
    });
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
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("activeSession");
    localStorage.removeItem("guestChat");
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#07080f] text-white overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-20 h-96 w-96 rounded-full bg-purple-600/20 blur-[120px]"></div>
        <div className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full bg-pink-500/15 blur-[140px]"></div>
      </div>
      <div className="relative z-10 flex min-h-[100dvh]">
      {/* Sidebar for desktop, drawer for mobile/tablet */}
      {/* Hamburger menu for mobile/tablet */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-gradient-to-br from-purple-600 to-purple-500 p-3 rounded-xl shadow-2xl shadow-purple-500/50 hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-sm"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu size={24} className="text-white" />
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
          className="fixed inset-0 bg-gradient-to-br from-purple-900/40 via-black/60 to-pink-900/40 backdrop-blur-sm z-40 md:hidden animate-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Main chat area */}
      <div className="flex-1 min-h-0 flex flex-col relative min-w-0 w-full overflow-hidden">
        <Header authenticated={authenticated} user={user} onLogin={() => { setShowModal(true); setLoginStep("login"); }} />
        <AnimatePresence>
          {showModal && (
            <motion.div
              className="fixed inset-0 bg-gradient-to-br from-purple-900/50 via-black/70 to-pink-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-gradient-to-br from-white via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-pink-900/20 text-gray-900 dark:text-white rounded-3xl p-8 shadow-2xl w-full max-w-md border-2 border-purple-200/50 dark:border-purple-500/30 backdrop-blur-xl"
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 20 }}
              >
                <div className="text-center mb-6">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-purple-500/50 float-animation">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Welcome to Wispr Flow</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your AI-powered voice assistant</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    className="group relative px-6 py-3 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-95 overflow-hidden"
                    onClick={() => setLoginStep("login")}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                    <span className="relative z-10">Login with Google</span>
                  </button>
                  <button
                    className="px-6 py-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 rounded-xl font-medium hover:bg-white/70 dark:hover:bg-gray-800/70 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    onClick={handleSkip}
                  >
                    Continue Without Login
                  </button>
                </div>
                {loginStep === "login" && (
                  <div className="mt-6 animate-slide-in">
                    <GoogleLoginButton onSuccess={handleLogin} />
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat window */}
        <ChatWindow messages={messages} isTyping={aiStreaming} liveTranscript={listening ? liveTranscript : null} />

        {/* Voice Agent Settings Panel */}
        {isVoiceAgentActive && (
          <div className="relative flex-shrink-0 p-3 sm:p-4 border-t border-blue-400/30 bg-gradient-to-br from-blue-900/20 via-cyan-900/20 to-blue-900/20 backdrop-blur-xl overflow-hidden">
            <div className="max-w-4xl mx-auto">
              <VoiceAgentButton
                onAddMessage={handleAddMessage}
                messages={messages}
                isVoiceAgentActive={isVoiceAgentActive}
                onToggleVoiceAgent={() => setIsVoiceAgentActive(!isVoiceAgentActive)}
              />
            </div>
          </div>
        )}

        {/* Premium Input Area with Gradient Background */}
        <div className="relative flex-shrink-0 p-4 sm:p-6 border-t border-purple-500/30 bg-gradient-to-br from-gray-900/95 via-purple-900/30 to-pink-900/20 backdrop-blur-xl shadow-2xl">
          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10 opacity-50"></div>
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{animationDelay: '1.5s'}}></div>
          
          <div className="relative z-10 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Voice Buttons with Premium Design */}
              <div className="flex gap-3 w-full sm:w-auto">
                <VoiceButton
                  listening={listening}
                  onStart={handleStartVoice}
                  onStop={handleStopVoice}
                />
                {!isVoiceAgentActive && (
                  <button
                    onClick={() => setIsVoiceAgentActive(true)}
                    className="group relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white hover:shadow-2xl hover:shadow-blue-500/50 active:scale-95 overflow-hidden shadow-lg"
                    title="Enable Voice Agent"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl"></div>
                    <svg className="w-5 h-5 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4" />
                    </svg>
                    <span className="relative z-10 text-sm">Voice Agent</span>
                    <span className="absolute top-0 right-0 flex h-2.5 w-2.5 z-20">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-lg shadow-green-500/50"></span>
                    </span>
                  </button>
                )}
              </div>
              
              {/* Enhanced Input Field with Glassmorphism */}
              <div className="relative flex-1 w-full sm:w-auto group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                <input
                  type="text"
                  value={listening ? liveTranscript : inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendText()}
                  placeholder="✨ Type your message or use voice..."
                  className="relative w-full px-5 py-3.5 text-base rounded-xl bg-white/10 backdrop-blur-md border-2 border-purple-500/30 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 text-white placeholder-gray-400 transition-all duration-300 shadow-lg hover:shadow-xl hover:bg-white/15"
                  disabled={listening}
                />
                {listening && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-xs text-red-300 font-bold">Recording</span>
                  </div>
                )}
              </div>
              
              {/* Premium Send Button */}
              <button
                onClick={handleSendText}
                disabled={aiStreaming || !inputText.trim()}
                className="group relative px-6 py-3.5 text-base bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 w-full sm:w-auto overflow-hidden shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl"></div>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {aiStreaming ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                      Send
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
