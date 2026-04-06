import React, { useState, useRef, useEffect } from "react";
import { Play, Square, Mic, Music, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOTAL_DURATION = 10;
const VOICE_WINDOW = 3;
const MUSIC_START = 3;

export default function TimedWalkupPlayer({ song, onComplete }) {
  const [phase, setPhase] = useState("idle"); // idle | voice | music | done
  const [elapsed, setElapsed] = useState(0);
  const [musicUnavailable, setMusicUnavailable] = useState(false);

  const masterStart = useRef(null);
  const tickRef = useRef(null);
  const voiceRef = useRef(null);
  const musicOpened = useRef(false);

  const spotifyUrl = song?.spotify_url;
  const appleMusicUrl = song?.apple_music_url;
  const musicUrl = spotifyUrl || appleMusicUrl;

  const cleanup = () => {
    clearInterval(tickRef.current);
    if (voiceRef.current) {
      voiceRef.current.pause();
      voiceRef.current.src = "";
    }
  };

  const stop = () => {
    cleanup();
    setPhase("done");
    setElapsed(TOTAL_DURATION);
    onComplete?.();
  };

  const start = () => {
    musicOpened.current = false;
    setMusicUnavailable(false);
    setElapsed(0);
    masterStart.current = Date.now();

    // Play voice intro immediately if present
    if (song?.voice_intro_url) {
      setPhase("voice");
      const audio = new Audio(song.voice_intro_url);
      voiceRef.current = audio;
      audio.play().catch(() => {});
      // Hard-stop voice at 3s
      setTimeout(() => {
        audio.pause();
        audio.src = "";
      }, VOICE_WINDOW * 1000);
    } else {
      setPhase("music");
    }

    // Master tick — updates every 100ms
    tickRef.current = setInterval(() => {
      const t = (Date.now() - masterStart.current) / 1000;
      const clamped = Math.min(t, TOTAL_DURATION);
      setElapsed(clamped);

      // At T=3: trigger music
      if (t >= MUSIC_START && !musicOpened.current) {
        musicOpened.current = true;
        setPhase("music");
        if (musicUrl) {
          window.open(musicUrl, "_blank");
        } else {
          setMusicUnavailable(true);
        }
      }

      // At T=10: force stop
      if (t >= TOTAL_DURATION) {
        stop();
      }
    }, 100);
  };

  // Cleanup on unmount
  useEffect(() => () => cleanup(), []);

  const remaining = Math.max(0, TOTAL_DURATION - elapsed);
  const progress = (elapsed / TOTAL_DURATION) * 100;
  const isActive = phase === "voice" || phase === "music";

  const phaseLabel = {
    idle: null,
    voice: "🎤 Playing voice intro...",
    music: musicUnavailable ? "Music unavailable" : "🎵 Music triggered — playing via provider",
    done: "✓ Walk-up complete",
  }[phase];

  const phaseColor = {
    idle: "",
    voice: "text-primary",
    music: musicUnavailable ? "text-destructive" : "text-green-400",
    done: "text-muted-foreground",
  }[phase];

  return (
    <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-primary font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <Mic className="w-3 h-3" /> Timed Walk-Up
        </p>
        <span className="text-[10px] text-muted-foreground">Voice 3s · Music 7s · Total 10s</span>
      </div>

      {/* Song info */}
      <div className="flex items-center gap-3">
        {song?.artwork_url ? (
          <img src={song.artwork_url} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Music className="w-5 h-5 text-primary" />
          </div>
        )}
        <div>
          <p className="font-bold text-foreground text-sm">{song?.title || "Untitled"}</p>
          <p className="text-xs text-muted-foreground">{song?.artist}</p>
          {song?.player_name && <p className="text-xs text-primary mt-0.5">🎤 {song.player_name}</p>}
        </div>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: elapsed < MUSIC_START
                  ? "hsl(var(--primary))"
                  : "hsl(142 71% 45%)",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>T = {elapsed.toFixed(1)}s</span>
            <span className="font-bold text-foreground text-sm tabular-nums">{remaining.toFixed(1)}s</span>
          </div>
          {/* Phase markers */}
          <div className="flex gap-4">
            <span className={`text-xs font-medium ${elapsed < MUSIC_START ? "text-primary" : "text-muted-foreground"}`}>
              Voice (0–3s)
            </span>
            <span className={`text-xs font-medium ${elapsed >= MUSIC_START ? "text-green-400" : "text-muted-foreground"}`}>
              Music (3–10s)
            </span>
          </div>
        </div>
      )}

      {/* Status */}
      {phaseLabel && (
        <p className={`text-xs font-medium ${phaseColor} flex items-center gap-1.5`}>
          {musicUnavailable && <AlertCircle className="w-3 h-3" />}
          {phaseLabel}
        </p>
      )}

      {musicUnavailable && (
        <p className="text-[10px] text-muted-foreground">
          No Spotify or Apple Music URL linked. Voice intro played successfully.
        </p>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {phase === "idle" || phase === "done" ? (
          <Button
            size="sm"
            onClick={start}
            className="bg-primary text-primary-foreground gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            {phase === "done" ? "Play Again" : "Start Walk-Up"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={stop}
            className="gap-1.5"
          >
            <Square className="w-3.5 h-3.5" /> Stop
          </Button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Music plays in Spotify / Apple Music. Duration may vary due to network or provider availability.
        Voice and music assets are never mixed or merged.
      </p>
    </div>
  );
}