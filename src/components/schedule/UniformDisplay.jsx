import React from "react";
import { Shirt } from "lucide-react";

export default function UniformDisplay({ event }) {
  const items = (() => {
    try { return JSON.parse(event?.uniform_items || "[]"); } catch { return []; }
  })();

  if (items.length === 0 && !event?.uniform_instructions) return null;

  return (
    <div className="flex items-start gap-2">
      <Shirt className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-foreground mb-1">Uniform</p>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {items.map((item, idx) => (
              <span key={idx} className="text-xs bg-surface border border-border rounded-full px-2.5 py-1 text-foreground">
                {item.item}{item.color ? ` — ${item.color}` : ""}
              </span>
            ))}
          </div>
        )}
        {event.uniform_instructions && (
          <p className="text-xs text-muted-foreground">{event.uniform_instructions}</p>
        )}
      </div>
    </div>
  );
}