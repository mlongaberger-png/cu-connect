import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Music, Trash2, ExternalLink, ChevronDown, ChevronUp, GripVertical, Play, Mic2, Zap } from "lucide-react";
import PlaylistEditor from "@/components/music/PlaylistEditor";

const PLAYLIST_TYPES = [
  { value: "pregame", label: "Pregame Hype", emoji: "🔥", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "warmup", label: "Warmup", emoji: "⚡", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "walkup", label: "Walkup Songs", emoji: "🎤", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "postgame", label: "Postgame", emoji: "🎉", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "practice", label: "Practice", emoji: "🎵", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
];

export default function GameDayPlaylists() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = ["admin", "athletic_director", "coach"].includes(user?.role);

  const [showCreate, setShowCreate] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [newForm, setNewForm] = useState({ name: "", type: "pregame", team_id: "" });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.filter({ is_active: true }, "name"),
  });

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists"],
    queryFn: () => base44.entities.Playlist.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Playlist.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      setShowCreate(false);
      setNewForm({ name: "", type: "pregame", team_id: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Playlist.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["playlists"] }),
  });

  const handleCreate = () => {
    if (!newForm.name || !newForm.team_id) return;
    const team = teams.find(t => t.id === newForm.team_id);
    createMutation.mutate({
      ...newForm,
      team_name: team?.name || "",
      songs: "[]",
      created_by_name: user?.full_name || "",
      created_by_email: user?.email || "",
    });
  };

  const filtered = playlists.filter(p => {
    if (filterTeam !== "all" && p.team_id !== filterTeam) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    return true;
  });

  const typeConfig = (type) => PLAYLIST_TYPES.find(t => t.value === type) || PLAYLIST_TYPES[0];

  if (editingPlaylist) {
    return (
      <PlaylistEditor
        playlist={editingPlaylist}
        teams={teams}
        onBack={() => { setEditingPlaylist(null); queryClient.invalidateQueries({ queryKey: ["playlists"] }); }}
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Music className="w-6 h-6 text-primary" /> Game Day Music
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Walkup songs, pregame playlists, and team anthems</p>
        </div>
        {isStaff && (
          <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Playlist
          </Button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Create New Playlist</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label className="text-xs">Playlist Name</Label>
              <Input
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Friday Night Hype"
                className="mt-1 bg-surface border-border"
              />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newForm.type} onValueChange={v => setNewForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1 bg-surface border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {PLAYLIST_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Team</Label>
              <Select value={newForm.team_id} onValueChange={v => setNewForm(f => ({ ...f, team_id: v }))}>
                <SelectTrigger className="mt-1 bg-surface border-border">
                  <SelectValue placeholder="Select team..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="border-border">Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending || !newForm.name || !newForm.team_id} className="bg-primary text-primary-foreground">
              {createMutation.isPending ? "Creating..." : "Create Playlist"}
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-44 bg-surface border-border text-sm">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44 bg-surface border-border text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Types</SelectItem>
            {PLAYLIST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Playlist Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-card rounded-2xl border border-border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <Music className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No playlists yet</p>
          {isStaff && <p className="text-xs text-muted-foreground mt-1">Create your first playlist to get the crowd going 🎵</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(playlist => {
            const tc = typeConfig(playlist.type);
            let songs = [];
            try { songs = JSON.parse(playlist.songs || "[]"); } catch {}
            return (
              <div key={playlist.id} className="bg-card border border-border rounded-2xl p-5 space-y-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${tc.color}`}>{tc.emoji} {tc.label}</span>
                    <h3 className="font-semibold text-foreground mt-2">{playlist.name}</h3>
                    <p className="text-xs text-muted-foreground">{playlist.team_name}</p>
                  </div>
                  {isStaff && (
                    <button
                      onClick={() => { if (confirm("Delete this playlist?")) deleteMutation.mutate(playlist.id); }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Song preview */}
                <div className="space-y-1">
                  {songs.slice(0, 3).map((song, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-4 text-center font-mono text-primary">{i + 1}</span>
                      <span className="truncate font-medium text-foreground">{song.title}</span>
                      {song.artist && <span className="text-muted-foreground truncate">— {song.artist}</span>}
                      {song.player_name && <span className="text-primary/70 text-[10px] shrink-0">{song.player_name}</span>}
                    </div>
                  ))}
                  {songs.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-6">+{songs.length - 3} more songs</p>
                  )}
                  {songs.length === 0 && <p className="text-xs text-muted-foreground pl-1">No songs added yet</p>}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-primary/30 text-primary hover:bg-primary/10 gap-2"
                  onClick={() => setEditingPlaylist(playlist)}
                >
                  {isStaff ? <><Mic2 className="w-3.5 h-3.5" /> Edit Playlist</> : <><Play className="w-3.5 h-3.5" /> View Playlist</>}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}