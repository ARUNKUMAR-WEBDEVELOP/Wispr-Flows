import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { MessageSquare } from "lucide-react";

export default function ChatWindow({ messages, isTyping, liveTranscript }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-transparent overflow-hidden">
      {/* Scrollable Messages Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pb-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 w-full">
          {/* Empty State */}
          {messages.length === 0 && !liveTranscript && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center space-y-6 animate-in">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/30 animate-float">
                  <MessageSquare className="w-12 h-12 text-white" strokeWidth={1.5} />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"></div>
              </div>
              <div className="space-y-2 rounded-2xl bg-white/5 border border-white/10 px-6 py-4 shadow-xl max-w-sm">
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  Start a Conversation
                </h3>
                <p className="text-sm sm:text-base text-gray-300">
                  ✨ Type a message or use voice input to begin
                </p>
              </div>
            </div>
          )}

          {/* All Messages - Full Scrollable History */}
          {messages.length > 0 && (
            <>
              {messages.map((msg, index) => (
                <MessageBubble key={index} message={msg} index={index} />
              ))}

              {/* Show live transcript as a temporary message */}
              {liveTranscript && (
                <MessageBubble message={{ text: liveTranscript, from: "user", temp: true }} />
              )}

              {isTyping && <TypingIndicator />}
            </>
          )}
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
`}</style>
