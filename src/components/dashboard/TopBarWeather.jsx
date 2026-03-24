import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2 } from "lucide-react";

const CACHE_KEY = "topbar_weather_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function fetchWeatherByCoords(lat, lon) {
  return base44.integrations.Core.InvokeLLM({
    prompt: `Get current weather for coordinates ${lat}, ${lon}. Return current conditions as JSON.`,
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
}

async function fetchWeatherByIP() {
  // Use IP geolocation as fallback
  const geoRes = await fetch("https://ipapi.co/json/");
  const geo = await geoRes.json();
  return base44.integrations.Core.InvokeLLM({
    prompt: `Get current weather for ${geo.city}, ${geo.region}, ${geo.country_name}. Return current conditions as JSON.`,
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
}

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

    setLoading(true);

    const doFetch = async () => {
      try {
        let result;
        if (navigator.geolocation) {
          result = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  resolve(await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude));
                } catch {
                  resolve(null);
                }
              },
              async () => {
                try { resolve(await fetchWeatherByIP()); } catch { resolve(null); }
              },
              { timeout: 5000 }
            );
          });
        } else {
          result = await fetchWeatherByIP();
        }
        if (result) {
          setWeather(result);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: result, ts: Date.now() }));
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    doFetch();
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