import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Hash, Star, ChevronDown, ChevronRight, Building2 } from "lucide-react";

export default function MessagesSidebar({ channelId, onSelectChannel, sports, teams }) {
  const [expandedSports, setExpandedSports] = useState({});
  const [starredChats, setStarredChats] = useState({}); // chatId -> preferenceId
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) return;
      setUserId(u.id);
      base44.entities.UserChatPreference.filter({ user_id: u.id, is_starred: true }).then(prefs => {
        const map = {};
        prefs.forEach(p => { map[p.chat_id] = p.id; });
        setStarredChats(map);
      });
    }).catch(() => {});
  }, []);

  const toggleStar = async (e, chatId) => {
    e.stopPropagation();
    if (!userId) return;
    if (starredChats[chatId]) {
      await base44.entities.UserChatPreference.delete(starredChats[chatId]);
      setStarredChats(prev => { const n = { ...prev }; delete n[chatId]; return n; });
    } else {
      const pref = await base44.entities.UserChatPreference.create({ user_id: userId, chat_id: chatId, is_starred: true });
      setStarredChats(prev => ({ ...prev, [chatId]: pref.id }));
    }
  };

  const toggleSport = (sportId) => {
    setExpandedSports(prev => ({ ...prev, [sportId]: !prev[sportId] }));
  };

  const isStarred = (id) => !!starredChats[id];

  // Build starred list for display
  const starredIds = Object.keys(starredChats);
  const allChannels = [
    { id: "org", name: "Organization", type: "org" },
    ...sports.map(s => ({ id: s.id, name: s.name, type: "sport", icon: s.icon })),
    ...teams.map(t => ({ id: t.id, name: t.name, type: "team" })),
  ];
  const starredItems = allChannels.filter(c => starredIds.includes(c.id));

  const channelBtn = (id, name, type, indent = false, icon = null) => (
    <div key={id} className={`flex items-center group rounded-lg mb-0.5 transition-colors ${channelId === id ? "bg-primary/15" : "hover:bg-surface"} ${indent ? "ml-4" : ""}`}>
      <button
        onClick={() => onSelectChannel(type, id, name)}
        className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm text-left ${channelId === id ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
      >
        {icon ? <span className="text-base leading-none">{icon}</span> : <Hash className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="truncate">{name}</span>
      </button>
      <button
        onClick={(e) => toggleStar(e, id)}
        className={`px-2 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity ${isStarred(id) ? "!opacity-100" : ""}`}
        title={isStarred(id) ? "Unstar" : "Star"}
      >
        <Star className={`w-3.5 h-3.5 ${isStarred(id) ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
      </button>
    </div>
  );

  return (
    <div className="w-64 bg-card border-r border-border flex-shrink-0 overflow-y-auto hidden md:flex flex-col">
      <div className="p-3 flex-1">

        {/* Org channel */}
        <div className="mb-4">
          {channelBtn("org", "Organization", "org", false, null)}
        </div>

        {/* Starred section */}
        {starredItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1 flex items-center gap-1">
              <Star className="w-3 h-3 fill-primary text-primary" /> Starred
            </p>
            {starredItems.map(c => channelBtn(c.id, c.name, c.type, false, c.icon || null))}
          </div>
        )}

        {/* Sports → Teams hierarchy */}
        {sports.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Channels</p>
            {sports.map(sport => {
              const sportTeams = teams.filter(t => t.sport_id === sport.id);
              const expanded = expandedSports[sport.id] ?? false;
              return (
                <div key={sport.id}>
                  {/* Sport row */}
                  <div className={`flex items-center group rounded-lg mb-0.5 transition-colors ${channelId === sport.id ? "bg-primary/15" : "hover:bg-surface"}`}>
                    <button
                      onClick={() => toggleSport(sport.id)}
                      className="px-2 py-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {expanded
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onSelectChannel("sport", sport.id, sport.name)}
                      className={`flex-1 flex items-center gap-1.5 py-2.5 text-sm text-left font-medium ${channelId === sport.id ? "text-primary" : "text-foreground/80 hover:text-foreground"}`}
                    >
                      {sport.icon && <span className="text-base leading-none">{sport.icon}</span>}
                      <span className="truncate">{sport.name}</span>
                    </button>
                    <button
                      onClick={(e) => toggleStar(e, sport.id)}
                      className={`px-2 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity ${isStarred(sport.id) ? "!opacity-100" : ""}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isStarred(sport.id) ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
                    </button>
                  </div>

                  {/* Teams nested under sport */}
                  {expanded && sportTeams.map(team => channelBtn(team.id, team.name, "team", true))}
                </div>
              );
            })}

            {/* Teams not under any sport */}
            {teams.filter(t => !t.sport_id).map(t => channelBtn(t.id, t.name, "team"))}
          </div>
        )}
      </div>
    </div>
  );
}