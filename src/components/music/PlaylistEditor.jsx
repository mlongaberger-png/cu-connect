import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2, ExternalLink, Music, Save, Zap } from "lucide-react";
import VoiceRecorder from "@/components/music/VoiceRecorder";
import GameDayConsole from "@/components/music/GameDayConsole";

const PLAYLIST_TYPES = [
  { value: "pregame", label: "Pregame Hype", emoji: "🔥" },
  { value: "warmup", label: "Warmup", emoji: "⚡" },
  { value: "walkup", label: "Walkup Songs", emoji: "🎤" },
  { value: "postgame", label: "Postgame", emoji: "🎉" },
  { value: "practice", label: "Practice", emoji: "🎵" },
];

const BLANK_SONG = {
  title: "", artist: "", player_name: "", player_id: "", song_team_id: "",
  spotify_url: "", apple_music_url: "", youtube_url: "", artwork_url: "",
  voice_intro_url: "", event_type: "", notes: ""
};

const EVENT_TYPES = [
  { value: "", label: "Auto (use playlist type)" },
  { value: "walkup", label: "🎤 Walk-Up" },
  { value: "run", label: "🏃 Run Scored" },
  { value: "strikeout", label: "⚡ Strikeout" },
  { value: "inning", label: "⏸️ Inning Break" },
  { value: "pregame", label: "🔥 Pregame Hype" },
  { value: "warmup", label: "💪 Warmup" },
  { value: "postgame", label: "🎉 Victory" },
];

export default function PlaylistEditor({ playlist, teams, onBack }) {
  const { user } = useAuth();
  const isStaff = ["admin", "athletic_director", "coach"].includes(user?.role);

  let initialSongs = [];
  try { initialSongs = JSON.parse(playlist.songs || "[]"); } catch {}

  const [songs, setSongs] = useState(initialSongs);
  const [saved, setSaved] = useState(false);
  const [djMode, setDjMode] = useState(false);

  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Playlist.update(playlist.id, data),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const handleSave = () => {
    if (isWalkup) {
      const invalid = songs.some(s => !s.player_id || !s.song_team_id);
      if (invalid) {
        alert("All walkup songs must have a team and player selected.");
        return;
      }
    }
    updateMutation.mutate({ songs: JSON.stringify(songs) });
  };
  const addSong = () => setSongs(s => [...s, { ...BLANK_SONG }]);
  const removeSong = (i) => setSongs(s => s.filter((_, idx) => idx !== i));
  const updateSong = (i, field, value) => setSongs(s => s.map((song, idx) => idx === i ? { ...song, [field]: value } : song));

  const tc = PLAYLIST_TYPES.find(t => t.value === playlist.type) || PLAYLIST_TYPES[0];
  const isWalkup = playlist.type === "walkup";

  if (djMode) {
    return <GameDayConsole playlist={{ ...playlist, songs: JSON.stringify(songs) }} onBack={() => setDjMode(false)} />;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{tc.emoji}</span>
            <h1 className="text-xl font-bold text-foreground">{playlist.name}</h1>
            <span className="text-xs text-muted-foreground">{tc.label} · {playlist.team_name}</span>
          </div>
        </div>
        <Button
          onClick={() => setDjMode(true)}
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10 gap-2"
        >
          <Zap className="w-4 h-4" /> DJ Console
        </Button>
        {isStaff && (
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-primary text-primary-foreground gap-2">
            <Save className="w-4 h-4" />
            {saved ? "Saved ✓" : updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* Songs list */}
      <div className="space-y-3">
        {songs.length === 0 && (
          <div className="text-center py-10 bg-card rounded-2xl border border-border">
            <Music className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No songs yet. Add the first one!</p>
          </div>
        )}

        {songs.map((song, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            {/* Title + Artist row */}
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Song Title *</Label>
                  <Input
                    value={song.title}
                    onChange={e => updateSong(i, "title", e.target.value)}
                    placeholder="Song title"
                    className="mt-0.5 bg-surface border-border h-8 text-sm"
                    disabled={!isStaff}
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Artist</Label>
                  <Input
                    value={song.artist}
                    onChange={e => updateSong(i, "artist", e.target.value)}
                    placeholder="Artist name"
                    className="mt-0.5 bg-surface border-border h-8 text-sm"
                    disabled={!isStaff}
                  />
                </div>
              </div>
              {isStaff && (
                <button onClick={() => removeSong(i)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Walkup: cascading team → player dropdowns */}
            {isWalkup && (() => {
              const teamPlayers = allPlayers
                .filter(p => p.team_id === song.song_team_id && p.is_active !== false)
                .sort((a, b) => a.last_name.localeCompare(b.last_name));
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Team</Label>
                    <select
                      value={song.song_team_id || ""}
                      onChange={e => {
                        updateSong(i, "song_team_id", e.target.value);
                        updateSong(i, "player_id", "");
                        updateSong(i, "player_name", "");
                      }}
                      disabled={!isStaff}
                      className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <option value="">Select team...</option>
                      {allTeams.sort((a, b) => a.name.localeCompare(b.name)).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Player</Label>
                    <select
                      value={song.player_id || ""}
                      onChange={e => {
                        const player = allPlayers.find(p => p.id === e.target.value);
                        updateSong(i, "player_id", e.target.value);
                        updateSong(i, "player_name", player ? `${player.first_name} ${player.last_name}` : "");
                      }}
                      disabled={!isStaff || !song.song_team_id}
                      className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                    >
                      <option value="">{song.song_team_id ? "Select player..." : "Select team first"}</option>
                      {teamPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })()}

            {/* Voice Intro — walkup only */}
            {isWalkup && (
              <VoiceRecorder
                value={song.voice_intro_url || ""}
                onChange={url => updateSong(i, "voice_intro_url", url)}
                disabled={!isStaff}
              />
            )}

            {/* Event Assignment */}
            <div>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Assign to Game Event</Label>
              <select
                value={song.event_type || ""}
                onChange={e => updateSong(i, "event_type", e.target.value)}
                disabled={!isStaff}
                className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EVENT_TYPES.map(et => <option key={et.value} value={et.value}>{et.label}</option>)}
              </select>
            </div>

            {/* URLs */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span className="text-green-400">Spotify</span> URL
                </Label>
                <Input
                  value={song.spotify_url}
                  onChange={e => updateSong(i, "spotify_url", e.target.value)}
                  placeholder="https://open.spotify.com/..."
                  className="mt-0.5 bg-surface border-border h-8 text-xs"
                  disabled={!isStaff}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span className="text-red-400">Apple Music</span> URL
                </Label>
                <Input
                  value={song.apple_music_url || ""}
                  onChange={e => updateSong(i, "apple_music_url", e.target.value)}
                  placeholder="https://music.apple.com/..."
                  className="mt-0.5 bg-surface border-border h-8 text-xs"
                  disabled={!isStaff}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  <span className="text-red-400">YouTube</span> URL
                </Label>
                <Input
                  value={song.youtube_url}
                  onChange={e => updateSong(i, "youtube_url", e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="mt-0.5 bg-surface border-border h-8 text-xs"
                  disabled={!isStaff}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Artwork URL</Label>
                <Input
                  value={song.artwork_url || ""}
                  onChange={e => updateSong(i, "artwork_url", e.target.value)}
                  placeholder="https://... (album art)"
                  className="mt-0.5 bg-surface border-border h-8 text-xs"
                  disabled={!isStaff}
                />
              </div>
            </div>

            {/* Quick-open links */}
            {(song.spotify_url || song.youtube_url || song.apple_music_url) && (
              <div className="flex gap-3 flex-wrap">
                {song.spotify_url && (
                  <a href={song.spotify_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-green-400 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Spotify
                  </a>
                )}
                {song.apple_music_url && (
                  <a href={song.apple_music_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-red-400 hover:underline">
                    <ExternalLink className="w-3 h-3" /> Apple Music
                  </a>
                )}
                {song.youtube_url && (
                  <a href={song.youtube_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-red-400 hover:underline">
                    <ExternalLink className="w-3 h-3" /> YouTube
                  </a>
                )}
              </div>
            )}

            {/* Notes */}
            {isStaff && (
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</Label>
                <Input
                  value={song.notes}
                  onChange={e => updateSong(i, "notes", e.target.value)}
                  placeholder="Any notes for the DJ..."
                  className="mt-0.5 bg-surface border-border h-8 text-xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {isStaff && (
        <Button onClick={addSong} variant="outline" className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/10 gap-2">
          <Plus className="w-4 h-4" /> Add Song
        </Button>
      )}
    </div>
  );
}