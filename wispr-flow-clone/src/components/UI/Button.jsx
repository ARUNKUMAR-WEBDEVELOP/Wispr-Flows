export default function Button({
  children,
  onClick,
  loading = false,
  className = "",
  variant = "primary",
}) {
  const base =
    "flex items-center justify-center px-4 py-2 rounded-lg font-medium transition";

  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white",
    ghost: "bg-transparent hover:bg-white/10 text-white",
    danger: "bg-red-600 hover:bg-red-500 text-white",
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
