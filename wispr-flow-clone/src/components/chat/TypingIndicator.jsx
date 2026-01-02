export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[#020617] border border-white/10 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}
