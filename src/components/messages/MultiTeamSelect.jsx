import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";

export default function MultiTeamSelect({ teams = [], selectedIds = [], onChange, placeholder = "Select teams…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(t => t !== id)
        : [...selectedIds, id]
    );
  };

  const selectedTeams = selectedIds
    .map(id => teams.find(t => t.id === id))
    .filter(Boolean);

  return (
    <div ref={ref} className="relative">
      {/* Trigger / preview box */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={`truncate ${selectedTeams.length === 0 ? "text-muted-foreground" : "text-foreground"}`}>
          {selectedTeams.length === 0
            ? placeholder
            : selectedTeams.length === 1
              ? selectedTeams[0].name
              : `${selectedTeams.length} teams selected`}
        </span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform shrink-0 ml-2 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Selected chips */}
      {selectedTeams.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedTeams.map(t => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 bg-primary/15 text-primary text-xs font-medium px-2 py-1 rounded-md"
            >
              {getTeamAvatarEmoji(t.avatar_type, t.sport_name)} {t.name}
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className="hover:text-primary-foreground/70"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-60 overflow-y-auto">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">No teams available</p>
          ) : (
            teams.map(t => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors
                    ${isSelected ? "bg-primary/20 text-primary font-medium" : "text-foreground hover:bg-surface-hover"}`}
                >
                  <span className="flex-1 truncate flex items-center gap-2">
                    <span className="text-base">{getTeamAvatarEmoji(t.avatar_type, t.sport_name)}</span>
                    {t.name}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}