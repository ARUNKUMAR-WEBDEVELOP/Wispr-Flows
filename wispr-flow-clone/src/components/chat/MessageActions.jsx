import { Volume2, Pause, StopCircle, Copy } from "lucide-react";
import { useState } from "react";

function filterSymbols(str) {
  // Remove @, *, # and similar symbols
  return str.replace(/[@*#]/g, "");
}

export default function MessageActions({ text, language }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  const getSelectedText = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return selection.toString();
    }
    return null;
  };

  const vibrate = () => {
    if (window.navigator.vibrate) {
      window.navigator.vibrate(30);
    }
  };

  const speak = () => {
    vibrate();
    let toSpeak = getSelectedText() || text;
    toSpeak = filterSymbols(toSpeak);
    if (!toSpeak) return;
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(toSpeak);
    let targetLang = language || navigator.language;
    // Find best matching voice for the language
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith(targetLang.toLowerCase()));
    if (!selectedVoice) {
      // Fallback to English voice
      selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
      utter.lang = 'en';
    } else {
      utter.lang = selectedVoice.lang;
    }
    if (selectedVoice) utter.voice = selectedVoice;
    utter.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    setPaused(false);
  };

  const pause = () => {
    vibrate();
    window.speechSynthesis.pause();
    setPaused(true);
  };

  const resume = () => {
    vibrate();
    window.speechSynthesis.resume();
    setPaused(false);
  };

  const stop = () => {
    vibrate();
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const copyText = async () => {
    vibrate();
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex gap-3 mt-2 text-gray-400 items-center">
      {!speaking && (
        <button
          onClick={speak}
          className="hover:text-indigo-400 active:scale-90 focus:scale-90 transition-transform duration-150 ease-in-out shadow-sm rounded-full p-2 bg-gray-800/60"
          title="Play voice"
        >
          <Volume2 size={20} />
        </button>
      )}
      {speaking && !paused && (
        <button
          onClick={pause}
          className="hover:text-indigo-400 active:scale-90 focus:scale-90 transition-transform duration-150 ease-in-out shadow-sm rounded-full p-2 bg-gray-800/60"
          title="Pause voice"
        >
          <Pause size={20} />
        </button>
      )}
      {speaking && paused && (
        <button
          onClick={resume}
          className="hover:text-indigo-400 active:scale-90 focus:scale-90 transition-transform duration-150 ease-in-out shadow-sm rounded-full p-2 bg-gray-800/60"
          title="Resume voice"
        >
          <Volume2 size={20} />
        </button>
      )}
      {speaking && (
        <button
          onClick={stop}
          className="hover:text-red-400 active:scale-90 focus:scale-90 transition-transform duration-150 ease-in-out shadow-sm rounded-full p-2 bg-gray-800/60"
          title="Stop voice"
        >
          <StopCircle size={20} />
        </button>
      )}
      <button
        onClick={copyText}
        className="hover:text-indigo-400 active:scale-90 focus:scale-90 transition-transform duration-150 ease-in-out shadow-sm rounded-full p-2 bg-gray-800/60"
        title="Copy"
      >
        <Copy size={20} />
      </button>
    </div>
  );
}
