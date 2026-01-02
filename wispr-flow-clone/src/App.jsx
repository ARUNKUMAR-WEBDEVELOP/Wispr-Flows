import { useState, useEffect } from "react";

// Components
import ChatWindow from "./components/chat/ChatWindow";
import VoiceButton from "./components/voice/VoiceButton";
import Waveform from "./components/voice/Waveform";
import AudioPlayer from "./components/voice/AudioPlayer";
import GoogleLoginButton from "./components/Auth/GoogleLoginButton";

// Hooks
import { useVoiceRecorder } from "./hooks/useVoiceRecorder";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useTypingEffect } from "./hooks/useTypingEffect";

// Services
import { speechToText } from "./services/speech.service";
import { sendMessageToAI } from "./services/ai.service";
import { textToSpeech } from "./services/tts.service";
import { isAuthenticated, logout } from "./services/auth.service";

export default function App() {
  const [user, setUser] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);
  const [ttsUrl, setTtsUrl] = useState(null);
  const [listening, setListening] = useState(false);

  const { recording, startRecording, stopRecording } = useVoiceRecorder();

  // Speech recognition hook (UI-level fallback)
  const recognition = useSpeechRecognition(setInputText);

  // Check if user is already logged in on mount
  useEffect(() => {
    if (isAuthenticated()) {
      setAuthenticated(true);
      // Load user data from localStorage or API
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, []);

  // Handle start voice
  const handleStartVoice = async () => {
    if (recognition) recognition.start();
    await startRecording();
    setListening(true);
  };

  // Handle stop voice
  const handleStopVoice = async () => {
    if (recognition) recognition.stop();
    const audioBlob = await stopRecording();
    setListening(false);

    try {
      // 1️⃣ Speech → text
      const { text, language } = await speechToText(audioBlob);

      setMessages((prev) => [
        ...prev,
        { role: "user", content: text, streaming: false },
      ]);

      // 2️⃣ AI response
      setAiStreaming(true);
      const aiResponse = await sendMessageToAI(text, language);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse.text, streaming: true },
      ]);
      setAiStreaming(false);

      // 3️⃣ TTS
      const ttsObjUrl = await textToSpeech(aiResponse.text, aiResponse.language);
      setTtsUrl(ttsObjUrl);

    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  // Handle manual chat submit
  const handleSendText = async () => {
    if (!inputText) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: inputText, streaming: false },
    ]);

    setInputText("");
    setAiStreaming(true);

    try {
      const aiResponse = await sendMessageToAI(inputText);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiResponse.text, streaming: true },
      ]);

      const ttsObjUrl = await textToSpeech(aiResponse.text, aiResponse.language);
      setTtsUrl(ttsObjUrl);
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }

    setAiStreaming(false);
  };

  // Google login callback
  const handleLogin = (data) => {
    console.log("User logged in:", data);
    setUser(data.user);
    setAuthenticated(true);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setUser(null);
    setAuthenticated(false);
    setMessages([]);
    localStorage.removeItem("user");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h1 className="text-xl font-bold">Wispr Flow</h1>
        
        <div className="flex items-center gap-4">
          {authenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
              {user.avatar && (
                <img 
                  src={user.avatar} 
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 rounded"
              >
                Logout
              </button>
            </div>
          ) : (
            <GoogleLoginButton onSuccess={handleLogin} />
          )}
        </div>
      </div>

      {/* Show login prompt if not authenticated */}
      {!authenticated ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Welcome to Wispr Flow</h2>
            <p className="text-gray-400 mb-8">Please sign in to continue</p>
            <GoogleLoginButton onSuccess={handleLogin} />
          </div>
        </div>
      ) : (
        <>
          {/* Chat window */}
          <ChatWindow messages={messages} isTyping={aiStreaming} />

          {/* Voice + waveform + input */}
          <div className="p-4 border-t border-gray-700 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <VoiceButton
                listening={listening}
                onStart={handleStartVoice}
                onStop={handleStopVoice}
              />
              <Waveform active={listening} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendText()}
                placeholder="Type your message..."
                className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleSendText}
                disabled={aiStreaming}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg"
              >
                Send
              </button>
            </div>

            {ttsUrl && <AudioPlayer src={ttsUrl} />}
          </div>
        </>
      )}
    </div>
  );
}
