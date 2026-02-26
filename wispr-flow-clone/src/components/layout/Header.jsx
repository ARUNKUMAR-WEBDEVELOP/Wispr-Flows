import { Mic, User, Sparkles } from "lucide-react";

export default function Header({ authenticated, onLogin, user }) {
  return (
    <header className="border-b border-white/10 bg-gradient-to-r from-slate-950/80 via-purple-950/30 to-slate-950/80 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 animate-pulse-slow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">Wispr Flow</h1>
              <p className="text-xs text-gray-400">AI Voice Assistant</p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">Gemini + Deepgram</span>
            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">v1.0</span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Mic status */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <Mic size={16} className="text-green-400" />
              <span className="text-xs font-medium text-green-400">Ready</span>
            </div>
            
            {/* User/Login */}
            {authenticated && user ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full" />
                <span className="text-xs text-gray-200 truncate max-w-[140px]">{user.name}</span>
              </div>
            ) : (
              <button
                className="group relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden"
                onClick={onLogin}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                <User size={18} className="relative z-10" />
                <span className="text-sm relative z-10 hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
