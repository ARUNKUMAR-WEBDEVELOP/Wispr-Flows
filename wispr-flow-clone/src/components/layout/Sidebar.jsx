import { Plus, MessageSquare } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#020617] border-r border-white/10 flex flex-col">

      {/* Logo */}
      <div className="p-4 text-xl font-semibold border-b border-white/10">
        🎙 Wispr Flow
      </div>

      {/* New Chat */}
      <div className="p-4">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition">
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="text-xs text-gray-400 px-2 mb-2">Recent</div>

        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
          <MessageSquare size={16} />
          Voice Assistant Demo
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 text-xs text-gray-400">
        Internship Demo v1.0
      </div>

    </aside>
  );
}
