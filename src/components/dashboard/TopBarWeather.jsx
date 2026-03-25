import React, { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";

const CACHE_KEY = "topbar_weather_v2";
const CACHE_TTL = 30 * 60 * 1000;

const WMO_EMOJI = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

function celsiusToF(c) { return Math.round(c * 9 / 5 + 32); }

async function fetchWeatherByIP() {
  // Step 1: IP geolocation (no key needed)
  const geo = await fetch("https://ipapi.co/json/").then(r => r.json());
  const { latitude, longitude, city } = geo;
  if (!latitude || !longitude) throw new Error("No location");

  // Step 2: Open-Meteo (free, no key)
  const wx = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
  ).then(r => r.json());

  const temp_f = Math.round(wx.current?.temperature_2m ?? 0);
  const code = wx.current?.weather_code ?? 0;
  const emoji = WMO_EMOJI[code] ?? "🌤️";

  return { city: city || "Local", temp_f, condition_emoji: emoji };
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
  const [loading, setLoading] = useState(!weather);

  useEffect(() => {
    // Skip if fresh cache exists
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) { setLoading(false); return; }
      }
    } catch {}

    setLoading(true);
    fetchWeatherByIP()
      .then(data => {
        setWeather(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs text-muted-foreground">
      <span className="text-base leading-none">{weather.condition_emoji}</span>
      <span className="font-medium text-foreground">{weather.temp_f}°F</span>
      <div className="flex items-center gap-0.5">
        <MapPin className="w-3 h-3" />
        <span className="max-w-[80px] truncate">{weather.city}</span>
      </div>
    </div>
  );
}