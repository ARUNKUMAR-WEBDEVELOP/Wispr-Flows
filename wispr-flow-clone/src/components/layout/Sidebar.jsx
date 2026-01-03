
import { Plus, MessageSquare, Clock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export default function Sidebar({ sessions, activeSession, onSelect, onNewChat, user, authenticated, onLogout }) {
  const [activeTab, setActiveTab] = useState("history");
  return (
    <motion.div
      className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col p-4"
      initial={{ x: -100 }}
      animate={{ x: 0 }}
      exit={{ x: -100 }}
    >
      {/* Logo */}
      <div className="p-4 text-xl font-semibold border-b border-white/10">
        🎙 Wispr Flow
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-4 mb-2">
        <button
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg transition text-sm ${activeTab === "history" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-200"}`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={16} /> Chat History
        </button>
        <button
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg transition text-sm ${activeTab === "new" ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-200"}`}
          onClick={onNewChat}
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Chat History Tab */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto space-y-2">
          <div className="text-xs text-gray-400 px-2 mb-2">Your Conversations</div>
          {(Array.isArray(sessions) ? sessions : []).length === 0 && (
            <div className="text-gray-400 text-xs px-2">No conversations yet.</div>
          )}
          {(Array.isArray(sessions) ? sessions : []).map((session) => (
            <motion.div
              key={session.session_id}
              className={`p-3 rounded cursor-pointer transition ${
                activeSession === session.session_id ? "bg-indigo-700 text-white" : "bg-gray-700 text-gray-200"
              }`}
              onClick={() => onSelect(session.session_id)}
              whileHover={{ scale: 1.03 }}
            >
              {session.title || "Untitled Conversation"}
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-xs text-gray-400">
        Internship Demo v1.0
      </div>

      {authenticated && user && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
            <div>
              <div className="font-semibold">{user.name}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
          </div>
          <button
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500 transition"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      )}
    </motion.div>
  );
}
