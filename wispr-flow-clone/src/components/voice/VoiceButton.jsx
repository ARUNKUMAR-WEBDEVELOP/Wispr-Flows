import { Mic, StopCircle } from "lucide-react";

export default function VoiceButton({ listening, onStart, onStop }) {
  return (
    <button
      onClick={listening ? onStop : onStart}
      className={`
        group relative flex items-center justify-center
        w-14 h-14 rounded-xl transition-all duration-300 overflow-hidden shadow-lg
        ${listening
          ? "bg-gradient-to-br from-red-600 via-red-500 to-pink-600 shadow-red-500/50 scale-110"
          : "bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-500 hover:shadow-2xl hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
        }
      `}
    >
      {/* Animated background glow */}
      <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 blur-xl ${
        listening 
          ? "bg-gradient-to-r from-red-400 to-pink-400" 
          : "bg-gradient-to-r from-indigo-400 to-purple-400 group-hover:opacity-100"
      }`}></div>
      
      {/* Icon */}
      <div className="relative z-10">
        {listening ? (
          <StopCircle className="text-white drop-shadow-lg" size={28} />
        ) : (
          <Mic className="text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300" size={28} />
        )}
      </div>

      {/* Pulse ring for listening state */}
      {listening && (
        <>
          <span className="absolute inset-0 rounded-xl ring-4 ring-red-400/60 animate-ping" />
          <span className="absolute top-1 right-1 flex h-3 w-3 z-20">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-white shadow-lg shadow-white/50"></span>
          </span>
        </>
      )}
      
      {/* Shimmer effect */}
      {!listening && (
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      )}
    </button>
  );
}
