export default function IconButton({
  icon: Icon,
  onClick,
  active = false,
}) {
  return (
    <button
      onClick={onClick}
      className={`
        p-2 rounded-full transition
        ${active ? "bg-indigo-600" : "bg-white/10 hover:bg-white/20"}
      `}
    >
      <Icon size={16} className="text-white" />
    </button>
  );
}
