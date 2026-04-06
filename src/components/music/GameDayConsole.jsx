import React, { useState, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Music, Mic2, Zap, Users, ChevronRight, ExternalLink } from "lucide-react";

const EVENT_TYPES = [
  { key: "walkup", label: "Walk-Up", emoji: "🎤", color: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
  { key: "run", label: "Run Scored", emoji: "🏃", color: "border-green-500/40 bg-green-500/10 text-green-300" },
  { key: "strikeout", label: "Strikeout", emoji: "⚡", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" },
  { key: "inning", label: "Inning Break", emoji: "⏸️", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  { key: "pregame", label: "Pregame Hype", emoji: "🔥", color: "border-orange-500/40 bg-orange-500/10 text-orange-300" },
  { key: "warmup", label: "Warmup", emoji: "💪", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
  { key: "postgame", label: "Victory Song", emoji: "🎉", color: "border-pink-500/40 bg-pink-500/10 text-pink-300" },
];

function extractSpotifyId(url) {
  if (!url) return null;
  const m = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function extractAppleMusicId(url) {
  return url && url.includes("music.apple.com") ? url : null;
}

function SongCard({ song, index, onPlay }) {
  const spotifyId = extractSpotifyId(song.spotify_url);
  const appleMusicUrl = extractAppleMusicId(song.apple_music_url);
  const hasSpotify = !!spotifyId;
  const hasApple = !!appleMusicUrl;
  const hasArt = !!song.artwork_url;

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors">
      {hasArt ? (
        <img src={song.artwork_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-surface flex items-center justify-center shrink-0">
          <Music className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{song.title || "Untitled"}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
        {song.player_name && (
          <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-0.5">
            <Users className="w-2.5 h-2.5" /> {song.player_name}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 shrink-0">
        {hasSpotify && (
          <a
            href={song.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors"
            title="Open in Spotify"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Spotify
          </a>
        )}
        {hasApple && (
          <a
            href={appleMusicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
            title="Open in Apple Music"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.05-.003-.098-.01-.address-.015H5.562l-.093.01a9.405 9.405 0 0 0-1.498.14 5.055 5.055 0 0 0-2.876 1.503A4.93 4.93 0 0 0 .293 4.09a8.57 8.57 0 0 0-.24 1.743c-.013.295-.02.59-.02.885v10.56c0 .295.007.59.02.884a8.57 8.57 0 0 0 .24 1.744 4.93 4.93 0 0 0 .802 1.628 5.055 5.055 0 0 0 2.876 1.503 9.405 9.405 0 0 0 1.498.14l.093.01h12.86c.295 0 .59-.007.884-.02a8.665 8.665 0 0 0 1.564-.15 5.022 5.022 0 0 0 1.877-.727c1.118-.733 1.863-1.732 2.18-3.043a9.23 9.23 0 0 0 .24-2.19c.013-.294.02-.59.02-.884V7.008c0-.295-.007-.59-.02-.884zM9.093 16.915H7.28V8.139h1.814zm5.585 0h-1.682v-.857h-.023c-.247.33-.57.6-.953.802a2.688 2.688 0 0 1-1.264.316c-.96 0-1.705-.275-2.234-.825-.53-.55-.795-1.322-.795-2.313V8.139h1.682v5.502c0 .602.135 1.062.406 1.38.27.318.66.477 1.168.477.352 0 .658-.09.917-.27.258-.18.452-.44.58-.78V8.139h1.682v8.776h.514z"/></svg>
            Apple Music
          </a>
        )}
        {song.youtube_url && (
          <a
            href={song.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-xs font-medium hover:bg-red-600/30 transition-colors"
            title="Open on YouTube"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
            YouTube
          </a>
        )}
      </div>
    </div>
  );
}

function SpotifyEmbedPanel({ spotifyId }) {
  if (!spotifyId) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <iframe
        src={`https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator&theme=0`}
        width="100%"
        height="80"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title="Spotify Player"
      />
    </div>
  );
}

export default function GameDayConsole({ playlist, onBack }) {
  const { user } = useAuth();
  const [activeEvent, setActiveEvent] = useState("walkup");
  const [nowPlayingId, setNowPlayingId] = useState(null);

  let songs = [];
  try { songs = JSON.parse(playlist.songs || "[]"); } catch {}

  // Group songs by event_type (falls back to playlist type)
  const songsByEvent = {};
  EVENT_TYPES.forEach(e => { songsByEvent[e.key] = []; });
  songs.forEach(song => {
    const key = song.event_type || playlist.type || "pregame";
    if (songsByEvent[key]) songsByEvent[key].push(song);
    else songsByEvent["pregame"].push(song);
  });

  // If no event_type on songs, show all songs under the playlist's type
  const allSongsForEvent = songs.filter(s => !s.event_type).length === songs.length
    ? songs
    : songsByEvent[activeEvent] || [];

  const nowPlayingSong = nowPlayingId !== null ? songs[nowPlayingId] : null;
  const nowPlayingSpotifyId = nowPlayingSong ? extractSpotifyId(nowPlayingSong.spotify_url) : null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Game Day Console</h1>
          </div>
          <p className="text-sm text-muted-foreground">{playlist.name} · {playlist.team_name}</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
          🔴 LIVE
        </span>
      </div>

      {/* Now Playing embed */}
      {nowPlayingSong && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Play className="w-3 h-3" /> Now Playing
          </p>
          <div className="flex items-center gap-3">
            {nowPlayingSong.artwork_url ? (
              <img src={nowPlayingSong.artwork_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Music className="w-6 h-6 text-primary" />
              </div>
            )}
            <div>
              <p className="font-bold text-foreground">{nowPlayingSong.title}</p>
              <p className="text-sm text-muted-foreground">{nowPlayingSong.artist}</p>
              {nowPlayingSong.player_name && (
                <p className="text-xs text-primary mt-0.5">🎤 {nowPlayingSong.player_name}</p>
              )}
            </div>
          </div>
          {nowPlayingSong.voice_intro_url && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const a = new Audio(nowPlayingSong.voice_intro_url); a.play(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
              >
                <Play className="w-3 h-3" /> 1. Play Voice Intro
              </button>
              <span className="text-xs text-muted-foreground">→ then trigger music below</span>
            </div>
          )}
          {nowPlayingSpotifyId && <SpotifyEmbedPanel spotifyId={nowPlayingSpotifyId} />}
          {!nowPlayingSpotifyId && nowPlayingSong.spotify_url && (
            <a href={nowPlayingSong.spotify_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-green-400 hover:underline">
              <ExternalLink className="w-4 h-4" /> Open in Spotify
            </a>
          )}
          {nowPlayingSong.apple_music_url && (
            <a href={nowPlayingSong.apple_music_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-red-400 hover:underline">
              <ExternalLink className="w-4 h-4" /> Open in Apple Music
            </a>
          )}
        </div>
      )}

      {/* Event type tabs */}
      {songs.some(s => s.event_type) && (
        <div className="flex gap-2 flex-wrap">
          {EVENT_TYPES.filter(e => songsByEvent[e.key]?.length > 0).map(evt => (
            <button
              key={evt.key}
              onClick={() => setActiveEvent(evt.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                activeEvent === evt.key ? evt.color : "border-border bg-surface text-muted-foreground"
              }`}
            >
              <span>{evt.emoji}</span> {evt.label}
              <span className="ml-1 bg-black/20 rounded-full px-1.5 py-0.5 text-[10px]">
                {songsByEvent[evt.key].length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Song list */}
      <div className="space-y-2">
        {allSongsForEvent.length === 0 ? (
          <div className="text-center py-10 bg-card rounded-2xl border border-border">
            <Music className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No songs in this playlist</p>
          </div>
        ) : (
          allSongsForEvent.map((song, i) => (
            <div
              key={i}
              onClick={() => setNowPlayingId(songs.indexOf(song))}
              className={`cursor-pointer transition-all ${nowPlayingId === songs.indexOf(song) ? "ring-2 ring-primary/50 rounded-xl" : ""}`}
            >
              <SongCard song={song} index={i} />
            </div>
          ))
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Tap a song to load it → then use Spotify or Apple Music to play
      </p>
    </div>
  );
}