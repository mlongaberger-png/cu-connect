import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Wind, Droplets, Loader2, CloudOff } from "lucide-react";

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }
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
                feels_like_f: { type: "number" },
                condition: { type: "string" },
                condition_emoji: { type: "string" },
                humidity: { type: "number" },
                wind_mph: { type: "number" },
                high_f: { type: "number" },
                low_f: { type: "number" }
              }
            }
          });
          setWeather(result);
        } catch (e) {
          setError("Could not load weather");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLocationDenied(true);
        setLoading(false);
      }
    );
  }, []);

  if (locationDenied) return null;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        <span className="text-sm text-muted-foreground">Getting weather…</span>
      </div>
    );
  }

  if (error || !weather) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{weather.condition_emoji || "🌤️"}</span>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{Math.round(weather.temp_f)}°F</span>
              <span className="text-xs text-muted-foreground">feels {Math.round(weather.feels_like_f)}°</span>
            </div>
            <p className="text-xs text-muted-foreground">{weather.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end mb-1">
            <MapPin className="w-3 h-3" />
            <span>{weather.city}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            H: {Math.round(weather.high_f)}° · L: {Math.round(weather.low_f)}°
          </div>
        </div>
      </div>
      <div className="flex gap-4 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Droplets className="w-3 h-3 text-blue-400" />
          <span>{weather.humidity}% humidity</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wind className="w-3 h-3 text-primary" />
          <span>{weather.wind_mph} mph wind</span>
        </div>
      </div>
    </div>
  );
}