import { useEffect, useState } from "react";
import MessageActions from "./MessageActions";

export default function MessageBubble({ message }) {
  const { role, content, streaming, language } = message;
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
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
        ${isUser
          ? "bg-indigo-600 text-white rounded-br-sm"
          : "bg-[#020617] text-gray-200 border border-white/10 rounded-bl-sm"
        }`}
      >
        <div className="whitespace-pre-wrap">{displayText}</div>

        {/* Show TTS controls only for AI responses after streaming finishes */}
        {!isUser && !streaming && (
          <MessageActions text={content} language={language} />
        )}
      </div>
    </div>
  );
}
