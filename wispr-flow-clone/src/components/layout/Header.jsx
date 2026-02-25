import { Mic, User, Sparkles } from "lucide-react";

export default function Header({ authenticated, onLogin }) {
  return (
    <header className="h-16 flex items-center justify-between border-b border-purple-500/20 bg-gradient-to-r from-gray-900 via-purple-900/20 to-gray-900 backdrop-blur-xl shadow-lg">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50 animate-pulse-slow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Voice Assistant
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">Powered by Gemini & Deepgram</p>
          </div>
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
          {!authenticated && (
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
    </header>
  );
}
