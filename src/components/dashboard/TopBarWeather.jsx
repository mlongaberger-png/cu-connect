import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2 } from "lucide-react";

const CACHE_KEY = "topbar_weather_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export default function TopBarWeather() {
  const [weather, setWeather] = useState(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If we already have fresh cached data, skip fetching
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return;
      }
    } catch {}

    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Get current weather for coordinates ${latitude}, ${longitude}. Return current conditions as JSON.`,
            add_context_from_internet: true,
            response_json_schema: {
              type: "object",
              properties: {
                city: { type: "string" },
                temp_f: { type: "number" },
                condition_emoji: { type: "string" },
                condition: { type: "string" },
              }
            }
          });
          setWeather(result);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        } catch {
          // silently fail
        } finally {
          setLoading(false);
        }
      },
      () => setLoading(false)
    );
  }, []);

  if (loading) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Weather…</span>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-muted-foreground"
      title={weather.condition}
    >
      <span className="text-base leading-none">{weather.condition_emoji || "🌤️"}</span>
      <span className="font-medium text-foreground">{Math.round(weather.temp_f)}°F</span>
      <div className="flex items-center gap-0.5">
        <MapPin className="w-3 h-3" />
        <span className="max-w-[80px] truncate">{weather.city}</span>
      </div>
    </div>
  );
}