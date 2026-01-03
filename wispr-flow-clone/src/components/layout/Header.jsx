import { Mic, User } from "lucide-react";

export default function Header({ authenticated, onLogin }) {
  return (
    <header className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-[#020617]">
      {/* Title */}
      <h1 className="text-sm font-medium text-gray-300">
        AI Voice Assistant
      </h1>
      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Mic status */}
        <div className="flex items-center gap-2 text-xs text-green-400">
          <Mic size={16} />
          Ready
        </div>
        {/* User/Login */}
        {!authenticated && (
          <button className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-white/10" onClick={onLogin}>
            <User size={16} />
            <span className="text-sm">Login</span>
          </button>
        )}
      </div>
    </header>
  );
}
