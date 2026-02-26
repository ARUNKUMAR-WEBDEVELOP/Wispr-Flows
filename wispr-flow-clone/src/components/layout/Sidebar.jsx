
import { Plus, MessageSquare, Clock, LogOut, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Sidebar({ sessions, activeSession, onSelect, onNewChat, user, authenticated, onLogout, open, onClose }) {
  const [activeTab, setActiveTab] = useState("history");

  return (
    <motion.div
      className={`fixed md:static top-0 left-0 z-50 md:z-auto h-full w-72 sm:w-80 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-blue-950/30 border-r border-white/10 flex flex-col backdrop-blur-2xl transition-transform duration-300 shadow-2xl ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      initial={{ x: -100 }}
      animate={{ x: open || window.innerWidth >= 768 ? 0 : -320 }}
      exit={{ x: -100 }}
      style={{ maxWidth: "100vw" }}
    >
      {/* Close button for mobile/tablet */}
      <button
        className="md:hidden absolute top-3 right-3 bg-blue-600/80 backdrop-blur-sm p-2 rounded-lg hover:bg-blue-500 transition-all hover:scale-110 shadow-lg"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        <span className="text-white font-bold text-lg">✕</span>
      </button>
      
      {/* Logo */}
      <div className="p-3 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-cyan-600/10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 flex-shrink-0">
            <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent truncate">
              Wispr Flow
            </h1>
            <p className="text-[10px] sm:text-xs text-gray-400 truncate">AI Voice Assistant</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 m-3 sm:m-4">
        <button
          className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all duration-300 text-xs sm:text-sm font-medium ${
            activeTab === "history" 
              ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/50 scale-[1.02]" 
              : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-blue-500/20"
          }`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={14} className="hidden sm:inline" /> 
          <Clock size={12} className="sm:hidden" /> 
          <span className="hidden sm:inline">History</span>
        </button>
        <button
          className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all duration-300 text-xs sm:text-sm font-medium bg-gradient-to-r from-green-600 to-green-500 text-white hover:shadow-lg hover:shadow-green-500/50 hover:scale-[1.02] active:scale-95"
          onClick={onNewChat}
          title="Create new chat"
        >
          <Plus size={14} className="hidden sm:inline" />
          <Plus size={12} className="sm:hidden" />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>

      {/* Chat History Tab */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-4 space-y-2">
            {(Array.isArray(sessions) ? sessions.reverse() : []).length === 0 && (
              <div className="text-gray-400 text-xs sm:text-sm px-3 py-8 text-center bg-gray-800/30 rounded-lg border border-dashed border-gray-700 mt-2">
                No conversations yet.
                <br />
                <span className="text-[10px] sm:text-xs">Start a new chat to begin! 💬</span>
              </div>
            )}
            {(Array.isArray(sessions) ? sessions.reverse() : []).map((session, idx) => (
              <motion.div
                key={session.session_id}
                className={`group relative p-2.5 sm:p-3 rounded-lg sm:rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
                  activeSession === session.session_id 
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30" 
                    : "bg-gray-800/40 text-gray-200 hover:bg-gray-700/60 border border-blue-500/10 hover:border-blue-500/30"
                }`}
                onClick={() => onSelect(session.session_id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare size={14} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-medium truncate block">
                      {session.title || "Untitled Chat"}
                    </span>
                    {session.created_at && (
                      <span className="text-[10px] sm:text-xs text-gray-400 truncate block">
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {activeSession === session.session_id && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                )}
              </motion.div>
            ))}
          </div>
          
          {/* Scroll Indicator */}
          {(Array.isArray(sessions) ? sessions : []).length > 5 && (
            <div className="px-3 sm:px-4 py-2 text-center text-[10px] text-gray-500 border-t border-white/5">
              ↓ Scroll to see more
            </div>
          )}
        </div>
      )}

      {/* User Profile Section */}
      {authenticated && user && (
        <div className="p-3 sm:p-4 border-t border-blue-500/20 bg-gradient-to-r from-blue-900/20 to-cyan-900/20">
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-800/50 rounded-lg sm:rounded-xl backdrop-blur-sm border border-blue-500/20">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full ring-2 ring-blue-500/50 shadow-lg flex-shrink-0" 
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-xs sm:text-sm truncate">{user.name}</div>
              <div className="text-[10px] sm:text-xs text-gray-400 truncate">{user.email}</div>
            </div>
            <button
              className="p-1.5 sm:p-2 bg-red-600/80 hover:bg-red-500 rounded-lg transition-all hover:scale-110 active:scale-95 flex-shrink-0"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut size={14} className="sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-blue-500/20 text-center">
        <p className="text-[10px] sm:text-xs text-gray-500">✨ Powered by AI • v1.0</p>
      </div>
    </motion.div>
  );
}
