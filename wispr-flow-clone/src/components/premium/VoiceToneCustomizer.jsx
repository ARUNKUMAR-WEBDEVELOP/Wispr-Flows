import { useState, useEffect } from "react";
import { Volume2, Sliders, X } from "lucide-react";

const VOICE_TONES = [
  { id: "neutral", label: "Neutral", description: "Professional and balanced" },
  { id: "friendly", label: "Friendly", description: "Warm and approachable" },
  { id: "professional", label: "Professional", description: "Formal and respectful" },
  { id: "casual", label: "Casual", description: "Relaxed and informal" },
  { id: "formal", label: "Formal", description: "Dignified and structured" },
  { id: "enthusiastic", label: "Enthusiastic", description: "Energetic and positive" },
  { id: "empathetic", label: "Empathetic", description: "Understanding and caring" },
];

export default function VoiceToneCustomizer({ isOpen, onClose, onSave }) {
  const [selectedTone, setSelectedTone] = useState("neutral");
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !loaded) {
      fetchVoiceTones();
    }
  }, [isOpen]);

  const fetchVoiceTones = async () => {
    try {
      const response = await fetch("https://wispr-flows-3adt.onrender.com/api/chat/voice-tone/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      const data = await response.json();
      setSelectedTone(data.tone || "neutral");
      setSpeakingRate(data.speaking_rate || 1.0);
      setPitch(data.pitch || 1.0);
      setCustomPrompt(data.custom_system_prompt || "");
      setLoaded(true);
    } catch (error) {
      console.error("Failed to fetch voice tones:", error);
      setLoaded(true);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("https://wispr-flows-3adt.onrender.com/api/chat/voice-tone/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          tone: selectedTone,
          speaking_rate: speakingRate,
          pitch: pitch,
          custom_system_prompt: customPrompt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onSave) onSave(data);
        onClose();
      }
    } catch (error) {
      console.error("Failed to save voice tone:", error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-950 border border-blue-500/30 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Voice Tone Customizer</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-6 py-6 space-y-6">
            {/* Tone Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
                <Sliders className="w-4 h-4" />
                Select Voice Tone
              </label>
              <div className="grid grid-cols-2 gap-3">
                {VOICE_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => setSelectedTone(tone.id)}
                    className={`p-3 rounded-lg text-left transition-all duration-200 border
                      ${
                        selectedTone === tone.id
                          ? "bg-blue-600/30 border-blue-500 shadow-lg shadow-blue-500/20"
                          : "bg-gray-900/50 border-gray-700/50 hover:border-gray-600/50"
                      }
                    `}
                  >
                    <div className="font-medium text-white text-sm">{tone.label}</div>
                    <div className="text-xs text-gray-400 mt-1">{tone.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking Rate */}
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">
                Speaking Rate: <span className="text-blue-400">{speakingRate.toFixed(1)}x</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speakingRate}
                  onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex gap-2 text-xs text-gray-400 min-w-fit">
                  <span>0.5x</span>
                  <span>2.0x</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {speakingRate < 1 ? "Slower speech" : speakingRate > 1 ? "Faster speech" : "Normal speed"}
              </p>
            </div>

            {/* Pitch */}
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">
                Pitch: <span className="text-blue-400">{pitch.toFixed(2)}</span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex gap-2 text-xs text-gray-400 min-w-fit">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {pitch < 1 ? "Lower pitch" : pitch > 1 ? "Higher pitch" : "Normal pitch"}
              </p>
            </div>

            {/* Custom System Prompt */}
            <div>
              <label className="text-sm font-semibold text-white mb-3 block">
                Custom System Prompt (Optional)
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Add custom instructions for the voice agent (e.g., 'Always use simple language', 'Be concise')"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:bg-gray-900 transition-all resize-none h-24"
              />
            </div>

            {/* Preview */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border border-blue-500/20">
              <p className="text-xs text-blue-300 font-medium mb-2">Preview</p>
              <p className="text-sm text-gray-300">
                Your voice agent will sound <span className="text-blue-400 font-semibold">{selectedTone}</span> with{" "}
                <span className="text-blue-400 font-semibold">{speakingRate.toFixed(1)}x</span> speaking rate and{" "}
                <span className="text-blue-400 font-semibold">{pitch === 1 ? "normal" : pitch > 1 ? "higher" : "lower"}</span> pitch.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-blue-500/20 flex items-center gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
