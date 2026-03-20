import React, { useState, useRef, useEffect } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function SearchableSelect({ placeholder, options, onSelect, disabled = false, emptyText = "No matches found" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (option) => {
    onSelect(option);
    setQuery("");
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && filtered.length > 0 && !filtered[0].disabled) {
      handleSelect(filtered[0]);
    }
    if (e.key === "ArrowDown") {
      // focus first result
      const first = ref.current?.querySelector("[data-option]");
      first?.focus();
    }
  };

  const handleOptionKeyDown = (e, option, idx) => {
    if (e.key === "Enter" && !option.disabled) handleSelect(option);
    if (e.key === "ArrowDown") {
      const next = ref.current?.querySelectorAll("[data-option]")[idx + 1];
      next?.focus();
    }
    if (e.key === "ArrowUp") {
      if (idx === 0) {
        ref.current?.querySelector("input")?.focus();
      } else {
        const prev = ref.current?.querySelectorAll("[data-option]")[idx - 1];
        prev?.focus();
      }
    }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full">
      <div
        className={`flex items-center gap-2 h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-text"} ${open ? "ring-1 ring-ring" : ""}`}
        onClick={() => { if (!disabled) { setOpen(true); ref.current?.querySelector("input")?.focus(); } }}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((option, idx) => (
              <div
                key={option.value}
                data-option
                tabIndex={option.disabled ? -1 : 0}
                onKeyDown={(e) => handleOptionKeyDown(e, option, idx)}
                onClick={() => { if (!option.disabled) handleSelect(option); }}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 transition-colors outline-none
                  ${option.disabled
                    ? "text-muted-foreground cursor-not-allowed opacity-50"
                    : "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  }`}
              >
                <span>{option.label}</span>
                {option.disabled && <span className="text-xs text-muted-foreground">Already added</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }) {
  return (
    <Badge variant="outline" className="flex items-center gap-1.5 pr-1 py-1 text-xs">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded hover:text-destructive transition-colors ml-0.5 focus:outline-none focus:text-destructive"
        aria-label={`Remove ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );
}

/**
 * AthleteLinker
 *
 * Props:
 *   sports: Sport[]
 *   teams: Team[]
 *   players: Player[]
 *   linkedPlayers: Player[]           – already-confirmed links
 *   onAdd: (player: Player) => void
 *   onRemove: (playerId: string) => void
 */
export default function AthleteLinker({ sports, teams, players, linkedPlayers, onAdd, onRemove }) {
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const linkedIds = new Set(linkedPlayers.map(p => p.id));

  // Derived option lists
  const sportOptions = sports.map(s => ({
    value: s.id,
    label: `${s.icon || ""} ${s.name}`.trim(),
  }));

  const teamOptions = (selectedSport
    ? teams.filter(t => t.sport_id === selectedSport.value)
    : teams
  ).map(t => ({ value: t.id, label: t.name }));

  const playerOptions = (selectedTeam
    ? players.filter(p => p.team_id === selectedTeam.value)
    : selectedSport
    ? players.filter(p => {
        const team = teams.find(t => t.id === p.team_id);
        return team?.sport_id === selectedSport.value;
      })
    : players
  ).map(p => ({
    value: p.id,
    label: `${p.first_name} ${p.last_name}${p.jersey_number ? ` #${p.jersey_number}` : ""} · ${p.team_name || "No team"}`,
    disabled: linkedIds.has(p.id),
    raw: p,
  }));

  const handleSelectSport = (option) => {
    setSelectedSport(option);
    setSelectedTeam(null); // clear downstream
  };

  const handleSelectTeam = (option) => {
    setSelectedTeam(option);
  };

  const handleSelectPlayer = (option) => {
    if (!option.disabled) onAdd(option.raw);
  };

  const handleRemoveSport = () => {
    setSelectedSport(null);
    setSelectedTeam(null);
  };

  const handleRemoveTeam = () => {
    setSelectedTeam(null);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-surface border border-border">
        {/* Sport */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Sport</p>
          {selectedSport ? (
            <Chip label={selectedSport.label} onRemove={handleRemoveSport} />
          ) : (
            <SearchableSelect
              placeholder="Search sport…"
              options={sportOptions}
              onSelect={handleSelectSport}
            />
          )}
        </div>

        {/* Team */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Team</p>
          {selectedTeam ? (
            <Chip label={selectedTeam.label} onRemove={handleRemoveTeam} />
          ) : (
            <SearchableSelect
              placeholder="Search team…"
              options={teamOptions}
              onSelect={handleSelectTeam}
              emptyText={selectedSport ? "No teams for this sport" : "No matches found"}
            />
          )}
        </div>

        {/* Athlete */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Athlete</p>
          <SearchableSelect
            placeholder="Search & click to add…"
            options={playerOptions}
            onSelect={handleSelectPlayer}
            disabled={playerOptions.length === 0 && !selectedTeam && !selectedSport}
            emptyText={
              !selectedSport && !selectedTeam
                ? "Filter by sport or team first"
                : "No athletes found"
            }
          />
        </div>
      </div>

      {/* Linked athletes chips */}
      {linkedPlayers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linkedPlayers.map(p => (
            <Chip
              key={p.id}
              label={`${p.first_name} ${p.last_name} · ${p.team_name || "No team"}`}
              onRemove={() => onRemove(p.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No athletes linked yet — invite will still be sent.</p>
      )}
    </div>
  );
}