import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Video, Plus, Send, Trash2, Play, Filter, BarChart2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import FilmUploadModal from "./FilmUploadModal";
import FilmAssignModal from "./FilmAssignModal";
import FilmPlayer from "./FilmPlayer";
import FilmAnalyticsDashboard from "./FilmAnalyticsDashboard";
import { format } from "date-fns";

const CATEGORIES = ["All", "Game Film", "Practice", "Opponent Scout", "Highlight", "Other"];

const CAT_COLORS = {
  "Game Film":      "bg-green-500/20 text-green-400 border-green-500/30",
  "Practice":       "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Opponent Scout": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Highlight":      "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Other":          "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

function getThumb(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  return null;
}

export default function FilmRoom({ user, teams, players, isStaff }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("library");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterCat, setFilterCat] = useState("All");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [assigningClip, setAssigningClip] = useState(null);
  const [playingClip, setPlayingClip] = useState(null);

  const { data: clips = [] } = useQuery({
    queryKey: ["film-clips"],
    queryFn: () => base44.entities.FilmClip.list("-created_date"),
  });

  const { data: myViews = [] } = useQuery({
    queryKey: ["my-film-views", user?.email],
    queryFn: () => base44.entities.FilmView.filter({ viewer_email: user?.email }),
    enabled: !!user?.email,
  });

  const handleDelete = async (id) => {
    if (!confirm("Delete this film clip?")) return;
    await base44.entities.FilmClip.delete(id);
    queryClient.invalidateQueries({ queryKey: ["film-clips"] });
  };

  const getViewForClip = (clipId) => myViews.find(v => v.film_clip_id === clipId);

  const filtered = clips
    .filter(c => filterTeam === "all" || c.team_id === filterTeam)
    .filter(c => filterCat === "All" || c.category === filterCat)
    .filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.tags?.toLowerCase().includes(search.toLowerCase()));

  const tabs = isStaff
    ? [{ id: "library", label: "Library", icon: Video }, { id: "analytics", label: "Analytics", icon: BarChart2 }]
    : [{ id: "library", label: "Film Library", icon: Video }];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Analytics tab */}
      {activeTab === "analytics" && isStaff && (
        <FilmAnalyticsDashboard teams={teams} players={players} />
      )}

      {/* Library tab */}
      {activeTab === "library" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="flex gap-2 flex-1 flex-wrap">
              {/* Team filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
                  className="text-xs bg-surface border border-border rounded-lg px-2 py-1.5 text-foreground">
                  <option value="all">All Teams</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              {/* Category chips */}
              <div className="flex gap-1 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setFilterCat(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterCat === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {isStaff && (
              <Button onClick={() => setShowUpload(true)} className="bg-primary text-primary-foreground gap-1 h-9 px-3 shrink-0">
                <Plus className="w-4 h-4" /> Add Film
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search film…"
              className="w-full pl-9 pr-4 h-9 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                {isStaff ? "No film uploaded yet. Click \"Add Film\" to get started." : "No film available."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(clip => {
                const thumb = clip.thumbnail_url || getThumb(clip.video_url);
                const view = getViewForClip(clip.id);
                const watched = view?.seconds_watched || 0;
                const team = teams.find(t => t.id === clip.team_id);

                return (
                  <div key={clip.id} className="bg-card border border-border rounded-2xl overflow-hidden group">
                    {/* Thumbnail */}
                    <div className="relative aspect-video bg-surface cursor-pointer" onClick={() => setPlayingClip(clip)}>
                      {thumb ? (
                        <img src={thumb} alt={clip.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-10 h-10 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-primary/80 transition-colors">
                          <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      {/* Watch progress bar */}
                      {watched > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, (watched / Math.max(clip.duration_seconds || 600, watched)) * 100)}%` }} />
                        </div>
                      )}
                      <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium border ${CAT_COLORS[clip.category] || ""}`}>
                        {clip.category}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="p-3 space-y-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-1">{clip.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{team?.name || clip.team_name}{clip.event_date ? ` · ${format(new Date(clip.event_date + "T00:00"), "MMM d, yyyy")}` : ""}</p>
                      </div>
                      {clip.description && <p className="text-xs text-muted-foreground line-clamp-2">{clip.description}</p>}
                      {watched > 0 && (
                        <p className="text-xs text-primary">{Math.floor(watched / 60)}m watched</p>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => setPlayingClip(clip)} className="flex-1 gap-1 border-border text-xs">
                          <Play className="w-3 h-3" /> Watch
                        </Button>
                        {isStaff && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setAssigningClip(clip)} className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs">
                              <Send className="w-3 h-3" /> Assign
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDelete(clip.id)} className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showUpload && (
        <FilmUploadModal teams={teams} user={user} onClose={() => setShowUpload(false)} onCreated={() => setShowUpload(false)} />
      )}
      {assigningClip && (
        <FilmAssignModal
          clip={assigningClip}
          teams={teams}
          players={players}
          user={user}
          onClose={() => setAssigningClip(null)}
          onCreated={() => setAssigningClip(null)}
        />
      )}
      {playingClip && (
        <FilmPlayer
          clip={playingClip}
          player={null}
          userEmail={user?.email}
          existingView={myViews.find(v => v.film_clip_id === playingClip.id)}
          onClose={() => {
            setPlayingClip(null);
            queryClient.invalidateQueries({ queryKey: ["my-film-views", user?.email] });
            queryClient.invalidateQueries({ queryKey: ["film-views-all"] });
          }}
          onViewUpdate={() => queryClient.invalidateQueries({ queryKey: ["my-film-views", user?.email] })}
        />
      )}
    </div>
  );
}