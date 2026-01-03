// ...existing state hooks...

  // Voice recording handlers (must be after useState)

import { useState, useEffect, useRef } from "react";
import { useVoiceWebSocket } from "./hooks/useVoiceWebSocket";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import VoiceButton from "./components/voice/VoiceButton";
import ChatWindow from "./components/chat/ChatWindow";
import GoogleLoginButton from "./components/Auth/GoogleLoginButton";
import { fetchChatHistory, createChatSession, fetchSessionMessages } from "./services/history.service";
import { sendMessageToAI } from "./services/ai.service";
import { logout } from "./services/auth.service";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [showModal, setShowModal] = useState(() => !localStorage.getItem("access_token"));
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
  const ws = useVoiceWebSocket((text) => setLiveTranscript(text));

  // Live streaming voice handlers using Web Audio API for PCM
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

  const handleStartVoice = async () => {
    setListening(true);
    setLiveTranscript("");
    ws.connect();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Use MediaRecorder to stream audio chunks to backend
    let mediaRecorder;
    if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' });
    } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    } else {
      mediaRecorder = new MediaRecorder(stream); // fallback
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        e.data.arrayBuffer().then((buffer) => {
          ws.sendAudio(buffer);
        });
      }
    };
    mediaRecorder.start(250); // send every 250ms
    workletNodeRef.current = mediaRecorder; // reuse ref for cleanup
  };

  const handleStopVoice = async () => {
    setListening(false);
    if (workletNodeRef.current) {
      // If using MediaRecorder, stop it
      if (workletNodeRef.current.state === 'recording') {
        workletNodeRef.current.stop();
      }
      workletNodeRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    ws.disconnect();
    setInputText(liveTranscript);
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
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        user={user}
        authenticated={authenticated}
        onLogout={handleLogout}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative">
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
              bottom: 120,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)',
              color: '#fff',
              padding: '1rem 2rem',
              borderRadius: '2rem',
              fontSize: '1.25rem',
              zIndex: 1000,
              boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              animation: 'fadeIn 0.3s',
              maxWidth: '90vw',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontWeight: 600, letterSpacing: 0.5 }}>{liveTranscript}</span>
          </div>
        )}

        {/* Chat window */}
        <ChatWindow messages={messages} isTyping={aiStreaming} />

        <div className="p-4 border-t border-gray-700 flex flex-col gap-3">
          <div className="flex items-center gap-3">
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
              className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
              disabled={listening}
            />
            <button
              onClick={handleSendText}
              disabled={aiStreaming}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
