import { Mic, StopCircle } from "lucide-react";

export default function VoiceButton({ listening, onStart, onStop }) {
  return (
    <button
      onClick={listening ? onStop : onStart}
      className={`
        relative flex items-center justify-center
        w-14 h-14 rounded-full transition-all duration-300
        ${listening
          ? "bg-red-600 animate-spin"
          : "bg-indigo-600 hover:bg-indigo-500 hover:inimate-pulse "
        }
      `}
    >
      {listening ? (
        <StopCircle className="text-white" size={28} />
      ) : (
        <Mic className="text-white" size={28} />
      )}

      {listening && (
        <span className="absolute inset-0 rounded-full ring-4 ring-red-400/40 animate-ping" />
      )}
    </button>
  );
}
