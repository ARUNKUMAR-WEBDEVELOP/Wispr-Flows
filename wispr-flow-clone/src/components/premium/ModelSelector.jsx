import { useState, useEffect } from "react";
import { ChevronDown, Zap, Sparkles, Crown } from "lucide-react";

export default function ModelSelector({ selectedModel = "gemini-2.0-flash", onModelChange, isPremium = false }) {
  const [models, setModels] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableModels();
  }, []);

  const fetchAvailableModels = async () => {
    try {
      const response = await fetch("https://wispr-flows-3adt.onrender.com/api/chat/models/", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });

      const data = await response.json();
      setModels(data.models || []);
    } catch (error) {
      console.error("Failed to fetch models:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelSelect = async (modelId) => {
    try {
      const response = await fetch("https://wispr-flows-3adt.onrender.com/api/chat/models/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({ model_id: modelId }),
      });

      if (response.ok) {
        onModelChange(modelId);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to select model:", error);
    }
  };

  const currentModel = models.find((m) => m.id === selectedModel);

  const getModelIcon = (tier) => {
    if (tier === "professional") return <Crown className="w-4 h-4" />;
    if (tier === "premium") return <Sparkles className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50">
        <div className="w-4 h-4 bg-gradient-to-r from-blue-400 to-cyan-400 rounded animate-pulse" />
        <span className="text-sm text-gray-400">Loading models...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full sm:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-blue-500/30 hover:border-blue-500/50 transition-all duration-300 text-sm text-white"
      >
        <div className="flex items-center gap-2">
          {currentModel && getModelIcon(currentModel.tier)}
          <span className="truncate max-w-[150px]">
            {currentModel?.name || "Select Model"}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950 border border-blue-500/30 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="max-h-[300px] overflow-y-auto">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                disabled={model.tier !== "free" && !isPremium}
                className={`w-full px-4 py-3 flex items-start gap-3 border-b border-blue-500/10 transition-all duration-200 text-left
                  ${
                    selectedModel === model.id
                      ? "bg-blue-600/30 border-l-4 border-l-blue-500"
                      : "hover:bg-gray-900/50"
                  }
                  ${model.tier !== "free" && !isPremium ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <div className="flex items-center gap-2 mt-0.5">
                  {getModelIcon(model.tier)}
                  {selectedModel === model.id && (
                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white">{model.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{model.description}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-gray-500">Response: {model.latency}</span>
                    {model.tier !== "free" && !isPremium && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300">
                        Premium
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {models.some((m) => m.tier !== "free" && !isPremium) && (
            <div className="px-4 py-3 bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-t border-purple-500/20">
              <p className="text-xs text-purple-300">
                ⭐ Upgrade to Premium to use advanced models
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
