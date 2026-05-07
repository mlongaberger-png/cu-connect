import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Shirt } from "lucide-react";

// Sport-specific uniform item presets
const SPORT_PRESETS = {
  baseball: ["Jersey", "Pants", "Hat", "Belt", "Socks", "Cleats"],
  softball: ["Jersey", "Pants", "Hat", "Belt", "Socks", "Cleats"],
  basketball: ["Jersey", "Shorts", "Socks", "Shoes"],
  football: ["Jersey", "Pants", "Helmet", "Pads", "Socks", "Cleats"],
  soccer: ["Jersey", "Shorts", "Socks", "Shin Guards", "Cleats"],
  volleyball: ["Jersey", "Shorts", "Knee Pads", "Shoes"],
  wrestling: ["Singlet", "Headgear", "Shoes"],
  track: ["Jersey", "Shorts", "Shoes"],
  cheerleading: ["Top", "Skirt", "Bow", "Shoes", "Socks"],
  swimming: ["Suit", "Cap", "Goggles"],
};

const DEFAULT_ITEMS = ["Jersey", "Shorts", "Pants", "Hat", "Socks"];

function getPresets(sportName) {
  if (!sportName) return DEFAULT_ITEMS;
  const lower = sportName.toLowerCase();
  const key = Object.keys(SPORT_PRESETS).find(k => lower.includes(k));
  return key ? SPORT_PRESETS[key] : DEFAULT_ITEMS;
}

export default function UniformEditor({ form, setForm }) {
  const [newItem, setNewItem] = useState({ item: "", color: "" });

  const items = (() => {
    try { return JSON.parse(form.uniform_items || "[]"); } catch { return []; }
  })();

  const updateItems = (updated) => {
    setForm(f => ({ ...f, uniform_items: JSON.stringify(updated) }));
  };

  const addItem = (itemName) => {
    if (!itemName.trim()) return;
    const exists = items.find(i => i.item.toLowerCase() === itemName.toLowerCase());
    if (!exists) updateItems([...items, { item: itemName, color: "" }]);
    setNewItem({ item: "", color: "" });
  };

  const removeItem = (idx) => updateItems(items.filter((_, i) => i !== idx));

  const updateColor = (idx, color) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], color };
    updateItems(updated);
  };

  const presets = getPresets(form.sport_name || "");
  const unusedPresets = presets.filter(p => !items.find(i => i.item.toLowerCase() === p.toLowerCase()));

  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1"><Shirt className="w-3 h-3" /> Uniform for This Event</Label>

      {/* Quick-add preset chips */}
      {unusedPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedPresets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => addItem(p)}
              className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors bg-surface"
            >
              + {p}
            </button>
          ))}
        </div>
      )}

      {/* Current items with color */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm text-foreground w-24 shrink-0">{item.item}</span>
              <Input
                value={item.color}
                onChange={e => updateColor(idx, e.target.value)}
                placeholder="Color (e.g. White)"
                className="bg-surface border-border h-8 text-sm flex-1"
              />
              <button type="button" onClick={() => removeItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom item input */}
      <div className="flex gap-2">
        <Input
          value={newItem.item}
          onChange={e => setNewItem(n => ({ ...n, item: e.target.value }))}
          placeholder="Custom item (e.g. Gloves)"
          className="bg-surface border-border h-8 text-sm"
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem(newItem.item))}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => addItem(newItem.item)} className="h-8 border-border shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Freeform notes */}
      <div>
        <Input
          value={form.uniform_instructions || ""}
          onChange={e => setForm(f => ({ ...f, uniform_instructions: e.target.value }))}
          placeholder="Uniform notes (e.g. 'Home whites, tuck in jerseys')"
          className="bg-surface border-border text-sm"
        />
      </div>
    </div>
  );
}