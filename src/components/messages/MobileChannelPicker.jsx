import React, { useState } from "react";
import { Star, ChevronDown, ChevronRight, Hash, X, Building2 } from "lucide-react";

export default function MobileChannelPicker({ sports, teams, channelId, onSelectChannel, starredIds = [], filterTeamIds = null }) {
  const [expandedSports, setExpandedSports] = useState({});
  const [open, setOpen] = useState(false);

  const visibleTeams = filterTeamIds ? teams.filter(t => filterTeamIds.includes(t.id)) : teams;
  const visibleSports = filterTeamIds
    ? sports.filter(s => visibleTeams.some(t => t.sport_id === s.id))
    : sports;

  const allChannels = [
    ...(filterTeamIds ? [] : [{ id: "org", name: "Organization", type: "org" }]),
    ...visibleSports.map(s => ({ id: s.id, name: s.name, type: "sport", icon: s.icon })),
    ...visibleTeams.map(t => ({ id: t.id, name: t.name, type: "team" })),
  ];
  const currentChannel = allChannels.find(c => c.id === channelId);

  const select = (type, id, name) => {
    onSelectChannel(type, id, name);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 max-w-[200px] text-foreground"
      >
        <Hash className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="text-sm font-semibold truncate">{currentChannel?.name || "Select Channel"}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </button>
    );
  }

  const starredItems = allChannels.filter(c => starredIds.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setOpen(false)}>
      <div className="w-full bg-card rounded-t-2xl border-t border-border max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-semibold text-foreground">Select Channel</span>
          <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="p-3 space-y-1">
          {/* Org — only for staff */}
          {!filterTeamIds && (
            <button
              onClick={() => select("org", "org", "Organization")}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm ${channelId === "org" ? "bg-primary/15 text-primary font-medium" : "text-foreground hover:bg-surface"}`}
            >
              <Hash className="w-4 h-4" /> Organization
            </button>
          )}

          {/* Starred */}
          {starredItems.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-1 flex items-center gap-1">
                <Star className="w-3 h-3 fill-primary text-primary" /> Starred
              </p>
              {starredItems.map(c => (
                <button key={c.id} onClick={() => select(c.type, c.id, c.name)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm ${channelId === c.id ? "bg-primary/15 text-primary font-medium" : "text-foreground hover:bg-surface"}`}>
                  {c.icon ? <span>{c.icon}</span> : <Hash className="w-4 h-4" />}
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {/* Sports + Teams */}
          {visibleSports.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-3 mb-1">Channels</p>
              {visibleSports.map(sport => {
                const sportTeams = visibleTeams.filter(t => t.sport_id === sport.id);
                const expanded = expandedSports[sport.id] ?? false;
                return (
                  <div key={sport.id}>
                    <div className="flex items-center">
                      <button onClick={() => setExpandedSports(p => ({ ...p, [sport.id]: !p[sport.id] }))}
                        className="px-2 py-3 text-muted-foreground">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <button onClick={() => select("sport", sport.id, sport.name)}
                        className={`flex-1 flex items-center gap-2 py-3 pr-3 text-sm font-medium ${channelId === sport.id ? "text-primary" : "text-foreground"}`}>
                        {sport.icon && <span>{sport.icon}</span>}
                        {sport.name}
                      </button>
                    </div>
                    {expanded && sportTeams.map(team => (
                      <button key={team.id} onClick={() => select("team", team.id, team.name)}
                        className={`w-full flex items-center gap-3 pl-10 pr-3 py-3 rounded-xl text-left text-sm ${channelId === team.id ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-surface"}`}>
                        <Hash className="w-3.5 h-3.5" /> {team.name}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}