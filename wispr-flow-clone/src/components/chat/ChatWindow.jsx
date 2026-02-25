import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { MessageSquare } from "lucide-react";

export default function ChatWindow({ messages, isTyping, liveTranscript }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-purple-50/20 to-pink-50/20 dark:from-gray-900 dark:via-purple-900/10 dark:to-pink-900/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Empty State */}
        {messages.length === 0 && !liveTranscript && (
          <div className="min-h-[calc(100vh-16rem)] flex flex-col items-center justify-center text-center space-y-6 animate-in">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-float">
                <MessageSquare className="w-12 h-12 text-white" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Start a Conversation
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                ✨ Type a message or use voice input to begin chatting with your AI assistant
              </p>
            </div>
          </div>
          
        {/* Messages */}
        {messages.map((msg, index) => (
          <MessageBubble key={index} message={msg} index={index} />
        ))}

        {/* Show live transcript as a temporary message */}
        {liveTranscript && (
          <MessageBubble message={{ text: liveTranscript, from: "user", temp: true }} />
        )}

        {isTyping && <TypingIndicator />}

        <div ref={bottomRef} />
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
`}</style>
