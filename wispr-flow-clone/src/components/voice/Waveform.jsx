export default function Waveform({ active, frequency = 0 }) {
  if (!active) return null;

  // Adjust animation speed based on frequency (0-1 scale)
  const animationSpeed = Math.max(0.4, 1.2 - frequency * 0.8);

  return (
    <div className="flex items-center gap-1 h-10">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${animationSpeed}s`,
          }}
        />
      ))}
    </div>
  );
}
