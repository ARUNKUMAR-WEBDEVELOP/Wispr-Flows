import { useState, useEffect } from "react";
import { Crown, Zap, TrendingUp, Check, X } from "lucide-react";

export default function SubscriptionStatus() {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionStatus();
    const interval = setInterval(fetchSubscriptionStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch(
        "https://wispr-flows-3adt.onrender.com/api/chat/subscription/status/",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }
      );

      const data = await response.json();
      setSubscription(data);
      setUsage(data.usage);
    } catch (error) {
      console.error("Failed to fetch subscription status:", error);
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (tier) => {
    try {
      const response = await fetch(
        "https://wispr-flows-3adt.onrender.com/api/chat/subscription/checkout/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({ tier }),
        }
      );

      const data = await response.json();
      if (data.status === "success") {
        fetchSubscriptionStatus();
        alert(`Successfully upgraded to ${tier}!`);
      }
    } catch (error) {
      console.error("Upgrade failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-gray-700/50 rounded w-32 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-700/50 rounded w-full" />
          <div className="h-4 bg-gray-700/50 rounded w-3/4" />
        </div>
      </div>
    );
  }

  const TIER_FEATURES = {
    free: {
      voice_messages: 10,
      text_messages: 50,
      api_calls: 100,
      models: ["gemini-2.0-flash"],
      priority: false,
      export: false,
    },
    premium: {
      voice_messages: 100,
      text_messages: 500,
      api_calls: 1000,
      models: ["gemini-2.0-flash", "gemini-1.5-pro"],
      priority: true,
      export: true,
    },
    professional: {
      voice_messages: 1000,
      text_messages: 5000,
      api_calls: 10000,
      models: ["gemini-2.0-flash", "gemini-1.5-pro", "gpt-4-turbo"],
      priority: true,
      export: true,
    },
  };

  const currentTier = subscription?.tier || "free";
  const daysRemaining = subscription?.days_remaining;

  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-gradient-to-r from-blue-900/40 to-cyan-900/40 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          {currentTier === "professional" ? (
            <Crown className="w-6 h-6 text-yellow-400" />
          ) : currentTier === "premium" ? (
            <Zap className="w-6 h-6 text-purple-400" />
          ) : (
            <TrendingUp className="w-6 h-6 text-gray-400" />
          )}
          <div>
            <h3 className="text-lg font-bold text-white capitalize">
              {currentTier} Plan
            </h3>
            {subscription?.is_active && daysRemaining !== null && (
              <p className="text-sm text-gray-300">
                {daysRemaining > 0
                  ? `${daysRemaining} days remaining`
                  : "Renews soon"}
              </p>
            )}
          </div>
        </div>

        {!subscription?.is_active && currentTier !== "professional" && (
          <button
            onClick={() => upgradePlan("premium")}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium transition-all hover:shadow-lg hover:shadow-blue-500/30"
          >
            Upgrade to Premium
          </button>
        )}
      </div>

      {/* Usage Bars */}
      {usage && (
        <div className="space-y-4">
          {Object.entries(usage).map(([key, item]) => {
            if (key === "reset_date" || typeof item !== "object") return null;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300 capitalize">
                    {key.replace(/_/g, " ")}
                  </label>
                  <span className="text-xs text-gray-400">
                    {item.used} / {item.limit}
                  </span>
                </div>
                <div className="w-full bg-gray-900/50 rounded-full h-2 overflow-hidden border border-gray-700/50">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.percentage > 80
                        ? "bg-gradient-to-r from-red-600 to-pink-600"
                        : item.percentage > 50
                        ? "bg-gradient-to-r from-yellow-600 to-orange-600"
                        : "bg-gradient-to-r from-blue-600 to-cyan-600"
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(TIER_FEATURES).map(([tier, features]) => (
          <div
            key={tier}
            className={`rounded-lg p-4 border transition-all duration-200 ${
              currentTier === tier
                ? "bg-blue-600/20 border-blue-500"
                : "bg-gray-900/30 border-gray-700/50 hover:border-gray-700"
            }`}
          >
            <h4 className="font-semibold text-white capitalize mb-3">{tier}</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center gap-2">
                {features.priority ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <X className="w-3 h-3 text-gray-600" />
                )}
                <span>Priority Support</span>
              </li>
              <li className="flex items-center gap-2">
                {features.export ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <X className="w-3 h-3 text-gray-600" />
                )}
                <span>Data Export</span>
              </li>
              <li className="text-gray-400 mt-3">
                {features.models.length} AI Models
              </li>
              <li className="text-gray-400">
                {features.voice_messages} voice msgs/mo
              </li>
            </ul>
            {currentTier !== tier && tier !== "free" && (
              <button
                onClick={() => upgradePlan(tier)}
                className="w-full mt-4 px-3 py-2 rounded bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-medium transition-all"
              >
                Upgrade
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
