import { useEffect, useState } from "react";
import MessageActions from "./MessageActions";
import { Bot, User } from "lucide-react";

export default function MessageBubble({ message, index = 0 }) {
  const { role, content, streaming, language, temp } = message;
  const isUser = role === "user";

  const [displayText, setDisplayText] = useState(
    streaming ? "" : content
  );

  // Streaming typing effect
  useEffect(() => {
    if (!streaming) return;

    let i = 0;
    const interval = setInterval(() => {
      setDisplayText(content.slice(0, i + 1));
      i++;
      if (i >= content.length) clearInterval(interval);
    }, 18);

    return () => clearInterval(interval);
  }, [content, streaming]);

  return (
    <div
      className={`flex gap-3 items-start ${
        isUser ? "justify-end" : "justify-start"
      } animate-slide-in`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50 ring-2 ring-white/20 float-animation">
          <Bot className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
      )}
      
      {/* Message Bubble */}
      <div
        className={`group relative max-w-[75%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed backdrop-blur-sm transition-all duration-300
        ${
          isUser
            ? "bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 text-white rounded-br-sm shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02]"
            : temp
            ? "bg-purple-100/50 dark:bg-purple-900/20 text-gray-700 dark:text-gray-300 border-2 border-purple-300 dark:border-purple-700 border-dashed rounded-bl-sm"
            : "bg-white/80 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 border border-purple-200/50 dark:border-purple-700/30 rounded-bl-sm shadow-md hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600"
        }`}
      >
        {/* Shimmer effect for user messages */}
        {isUser && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden opacity-0 group-hover:opacity-20 transition-opacity duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent shimmer-animation"></div>
          </div>
        )}
        
        <div className="relative whitespace-pre-wrap break-words">{displayText}</div>
        {streaming && (
          <span className="inline-block w-1 h-4 ml-1 bg-current opacity-75 animate-pulse"></span>
        )}

        {/* Show TTS controls only for AI responses after streaming finishes */}
        {!isUser && !streaming && !temp && (
          <MessageActions text={content} language={language} />
        )}
      </div>
      
      {/* Avatar for user */}
      {isUser && (
        <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/50 ring-2 ring-white/20">
          <User className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}
