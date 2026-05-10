import React from "react";
import { Shirt } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

// Sport-specific uniform fields
const SPORT_UNIFORMS = {
  baseball:   ["jersey", "pants", "hat", "socks", "belt"],
  softball:   ["jersey", "pants", "hat", "socks", "belt"],
  basketball: ["jersey", "shorts", "shoes"],
  football:   ["jersey", "pants", "helmet", "socks"],
  soccer:     ["jersey", "shorts", "socks", "cleats"],
  volleyball: ["jersey", "shorts", "shoes"],
  wrestling:  ["singlet", "shoes"],
  lacrosse:   ["jersey", "shorts", "helmet", "socks"],
  hockey:     ["jersey", "pants", "helmet", "socks"],
  default:    ["jersey", "shorts"],
};

const COLORS = ["Black", "White", "Gold", "Gray"];

function detectSport(sportName = "") {
  const s = sportName.toLowerCase();
  for (const key of Object.keys(SPORT_UNIFORMS)) {
    if (s.includes(key)) return key;
  }
  return "default";
}

export default function UniformSelector({ form, setForm, sportName }) {
  const sportKey = detectSport(sportName);
  const fields = SPORT_UNIFORMS[sportKey] || SPORT_UNIFORMS.default;

  const uniformData = (() => {
    try { return JSON.parse(form.uniform_info || "{}"); } catch { return {}; }
  })();

  const update = (field, value) => {
    const updated = { ...uniformData, [field]: value };
    setForm(f => ({ ...f, uniform_info: JSON.stringify(updated) }));
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs flex items-center gap-1.5"><Shirt className="w-3.5 h-3.5" /> Uniform Colors</Label>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(field => (
          <div key={field}>
            <p className="text-[10px] text-muted-foreground capitalize mb-0.5">{field}</p>
            <Select
              value={uniformData[field] || ""}
              onValueChange={v => update(field, v)}
            >
              <SelectTrigger className="bg-surface border-border h-8 text-xs">
                <SelectValue placeholder="Select color…" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value={null} className="text-xs text-muted-foreground">Not specified</SelectItem>
                {COLORS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}