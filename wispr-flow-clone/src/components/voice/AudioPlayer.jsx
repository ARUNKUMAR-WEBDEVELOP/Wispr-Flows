import { Play, Pause } from "lucide-react";
import { useRef, useState } from "react";

export default function AudioPlayer({ src }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 mt-2">
      <button
        onClick={togglePlay}
        className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 transition flex items-center justify-center"
      >
        {playing ? (
          <Pause size={16} className="text-white" />
        ) : (
          <Play size={16} className="text-white" />
        )}
      </button>

      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
