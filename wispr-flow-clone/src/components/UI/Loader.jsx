export default function Loader() {
  return (
    <div className="flex items-center gap-1">
      <span className="loader-dot" />
      <span className="loader-dot delay-150" />
      <span className="loader-dot delay-300" />
    </div>
  );
}
