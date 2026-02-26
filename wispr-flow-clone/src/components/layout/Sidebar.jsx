
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
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-3 pb-4 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div className="text-xs font-semibold text-purple-300 flex items-center gap-2">
              <MessageSquare size={14} />
              Conversations
            </div>
            <span className="text-[10px] text-gray-500 font-medium">{(Array.isArray(sessions) ? sessions : []).length}</span>
          </div>

          {/* Scrollable History List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 min-h-0">
            {(Array.isArray(sessions) ? sessions : []).length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="text-gray-500 text-sm">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">No conversations</p>
                  <p className="text-xs mt-1 opacity-75">Start a new chat to begin</p>
                </div>
              </div>
            ) : (
              (Array.isArray(sessions) ? sessions : []).map((session) => (
                <motion.button
                  key={session.session_id}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group overflow-hidden ${
                    activeSession === session.session_id 
                      ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20" 
                      : "bg-gray-800/40 text-gray-300 hover:bg-gray-700/60 border border-purple-500/10 hover:border-purple-500/30"
                  }`}
                  onClick={() => onSelect(session.session_id)}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <MessageSquare size={14} className="shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {session.title || "Untitled"}
                      </div>
                      <div className="text-[10px] opacity-70 truncate">
                        {new Date(session.created_at || Date.now()).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  {activeSession === session.session_id && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </motion.button>
              ))
            )}
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
