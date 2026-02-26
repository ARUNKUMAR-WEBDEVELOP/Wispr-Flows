import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";

export default function ChatWindow({ messages, isTyping, liveTranscript }) {
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-transparent">
      {/* Messages Container with Scrolling */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent hover:scrollbar-thumb-gray-500 transition-colors"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-5 w-full">
          {/* Empty State */}
          {messages.length === 0 && !liveTranscript && (
            <div className="flex min-h-[50vh] sm:min-h-[60vh] flex-col items-center justify-center text-center space-y-6 animate-in px-4">
              <div className="relative">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-600 via-cyan-500 to-blue-400 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/30 animate-float">
                  <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"></div>
              </div>
              <div className="space-y-2 rounded-2xl bg-white/5 border border-white/10 px-4 sm:px-6 py-4 shadow-xl">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                  Start a Conversation
                </h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-300 max-w-lg">
                  ✨ Type a message or use voice input to begin chatting with your AI assistant
                </p>
              </div>
            </div>
          )}

          {/* Messages - All Messages with Scrolling */}
          {messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} index={index} />
          ))}

          {/* Show live transcript as a temporary message */}
          {liveTranscript && (
            <MessageBubble message={{ text: liveTranscript, from: "user", temp: true }} />
          )}

          {isTyping && <TypingIndicator />}
          
          {/* Auto-scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}

<style jsx>{`
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-in {
    animation: fadeIn 0.5s ease-out;
  }

  /* Custom scrollbar styling */
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
  }
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #4b5563;
    border-radius: 4px;
  }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background-color: #6b7280;
  }
`}</style>
