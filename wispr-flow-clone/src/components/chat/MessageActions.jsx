import { Volume2, Copy } from "lucide-react";

export default function MessageActions({ text }) {
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = navigator.language;
    speechSynthesis.speak(utterance);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex gap-3 mt-2 text-gray-400">
      <button
        onClick={speak}
        className="hover:text-indigo-400 transition"
        title="Play voice"
      >
        <Volume2 size={16} />
      </button>

      <button
        onClick={copyText}
        className="hover:text-indigo-400 transition"
        title="Copy"
      >
        <Copy size={16} />
      </button>
    </div>
  );
}
