
import { Plus, MessageSquare, Clock, LogOut, Sparkles } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Sidebar({ sessions, activeSession, onSelect, onNewChat, user, authenticated, onLogout, open, onClose }) {
  const [activeTab, setActiveTab] = useState("history");
  // Responsive: show as drawer on mobile/tablet
  return (
    <motion.div
      className={`fixed md:static top-0 left-0 z-50 md:z-auto h-full w-80 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-purple-950/30 border-r border-white/10 flex flex-col backdrop-blur-2xl transition-transform duration-300 shadow-2xl ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      initial={{ x: -100 }}
      animate={{ x: open || window.innerWidth >= 768 ? 0 : -320 }}
      exit={{ x: -100 }}
      style={{ maxWidth: 320 }}
    >
      {/* Close button for mobile/tablet */}
      <button
        className="md:hidden absolute top-4 right-4 bg-purple-600/80 backdrop-blur-sm p-2 rounded-full hover:bg-purple-500 transition-all hover:scale-110 shadow-lg"
        onClick={onClose}
        aria-label="Close sidebar"
      >
        ✕
      </button>
      
      {/* Logo */}
      <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-600/10 to-pink-600/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/50">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Wispr Flow
            </h1>
            <p className="text-xs text-gray-400">AI Voice Assistant</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 m-4">
        <button
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium ${
            activeTab === "history" 
              ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/50 scale-[1.02]" 
              : "bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 border border-purple-500/20"
          }`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={16} /> History
        </button>
        <button
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 text-sm font-medium bg-gradient-to-r from-green-600 to-green-500 text-white hover:shadow-lg hover:shadow-green-500/50 hover:scale-[1.02] active:scale-95"
          onClick={onNewChat}
        >
          <Plus size={16} /> New
        </button>
      </div>

      {/* Chat History Tab */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3 shadow-lg shadow-purple-900/10">
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                <MessageSquare size={14} />
                AI Voice Assistant History
              </div>
              <span className="text-[10px] uppercase tracking-widest text-gray-500">Scroll</span>
            </div>
          {(Array.isArray(sessions) ? sessions : []).length === 0 && (
            <div className="text-gray-400 text-sm px-2 py-8 text-center bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
              No conversations yet.
              <br />
              <span className="text-xs">Start a new chat to begin! 💬</span>
            </div>
          )}
            <div className="space-y-2">
              {(Array.isArray(sessions) ? sessions : []).map((session) => (
                <motion.div
                  key={session.session_id}
                  className={`group relative p-3.5 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
                    activeSession === session.session_id 
                      ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30" 
                      : "bg-gray-800/50 text-gray-200 hover:bg-gray-700/60 border border-purple-500/10 hover:border-purple-500/30"
                  }`}
                  onClick={() => onSelect(session.session_id)}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {session.title || "Untitled Conversation"}
                    </span>
                  </div>
                  {activeSession === session.session_id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Section */}
      {authenticated && user && (
        <div className="p-4 border-t border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-pink-900/20">
          <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl backdrop-blur-sm border border-purple-500/20">
            <img 
              src={user.avatar} 
              alt={user.name} 
              className="w-10 h-10 rounded-full ring-2 ring-purple-500/50 shadow-lg" 
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white text-sm truncate">{user.name}</div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
            </div>
            <button
              className="p-2 bg-red-600/80 hover:bg-red-500 rounded-lg transition-all hover:scale-110 active:scale-95"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut size={16} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-purple-500/20 text-center">
        <p className="text-xs text-gray-500">✨ Powered by AI • v1.0</p>
      </div>
    </motion.div>
  );
}
