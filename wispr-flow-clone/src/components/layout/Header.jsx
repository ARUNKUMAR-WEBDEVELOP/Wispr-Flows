import { Mic, User, Sparkles } from "lucide-react";

export default function Header({ authenticated, onLogin, user }) {
  return (
    <header className="border-b border-white/10 bg-gradient-to-r from-slate-950/80 via-blue-950/30 to-slate-950/80 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 animate-pulse-slow flex-shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight text-white truncate">Wispr Flow</h1>
              <p className="text-[10px] sm:text-xs text-gray-400 truncate">AI Voice Assistant</p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-300">
            <span className="px-2 sm:px-2.5 py-1 rounded-full bg-white/5 border border-white/10 whitespace-nowrap">Gemini</span>
            <span className="px-2 sm:px-2.5 py-1 rounded-full bg-white/5 border border-white/10 whitespace-nowrap">Deepgram</span>
            <span className="hidden sm:inline px-2.5 py-1 rounded-full bg-white/5 border border-white/10">v1.0</span>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 justify-end">
            {/* Mic status */}
            <div className="hidden xs:flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg sm:rounded-lg backdrop-blur-sm flex-shrink-0">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50"></div>
              <Mic size={14} className="sm:w-4 sm:h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400 hidden sm:inline">Ready</span>
            </div>
            
            {/* User/Login */}
            {authenticated && user ? (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl flex-shrink-0">
                <img src={user.avatar} alt={user.name} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full ring-1 ring-blue-400/50" />
                <span className="text-xs text-gray-200 truncate max-w-[120px] hidden sm:inline">{user.name}</span>
              </div>
            ) : (
              <button
                className="group relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg sm:rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden flex-shrink-0"
                onClick={onLogin}
                title="Login"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-30 transition-opacity duration-300"></div>
                <User size={16} className="sm:w-5 sm:h-5 relative z-10" />
                <span className="text-xs sm:text-sm relative z-10 hidden sm:inline">Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
