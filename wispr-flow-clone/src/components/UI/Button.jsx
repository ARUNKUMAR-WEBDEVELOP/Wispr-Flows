export default function Button({
  children,
  onClick,
  loading = false,
  className = "",
  variant = "primary",
  disabled = false,
}) {
  const base =
    "group relative flex items-center justify-center px-5 py-3 rounded-xl font-semibold transition-all duration-300 overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white hover:shadow-xl hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-95",
    ghost: "bg-transparent hover:bg-white/10 text-white border border-white/20 hover:border-white/40",
    danger: "bg-gradient-to-r from-red-600 to-red-500 text-white hover:shadow-xl hover:shadow-red-500/50 hover:scale-[1.02] active:scale-95",
    google: "bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] active:scale-95",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {/* Shimmer effect */}
      {variant !== "google" && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer"></div>
      )}
      <span className="relative z-10">{loading ? "Loading..." : children}</span>
    </button>
  );
}
