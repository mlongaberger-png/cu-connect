import React, { useRef, useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { X, Clock, CheckCircle2 } from "lucide-react";

function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  // Vimeo
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}?autoplay=1`;
  // Hudl / other direct embed — just return as-is for iframe
  return null;
}

function fmtTime(secs) {
  if (!secs) return "0m";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}

export default function FilmPlayer({ clip, player, userEmail, assignmentId, existingView, onClose, onViewUpdate }) {
  const startTime = useRef(Date.now());
  const accumulatedSeconds = useRef(existingView?.seconds_watched || 0);
  const intervalRef = useRef(null);
  const [localSeconds, setLocalSeconds] = useState(existingView?.seconds_watched || 0);
  const [saved, setSaved] = useState(false);

  const embedUrl = getEmbedUrl(clip.video_url);
  const isDirectVideo = !embedUrl && clip.video_url;

  const saveProgress = useCallback(async (finalSave = false) => {
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000);
    const total = accumulatedSeconds.current + elapsed;
    setLocalSeconds(total);

    const viewData = {
      film_clip_id: clip.id,
      film_clip_title: clip.title,
      viewer_email: userEmail,
      player_id: player?.id,
      player_name: player ? `${player.first_name} ${player.last_name}` : undefined,
      team_id: clip.team_id,
      seconds_watched: total,
      last_watched_at: new Date().toISOString(),
      ...(assignmentId ? { film_assignment_id: assignmentId } : {}),
    };

    if (existingView?.id) {
      await base44.entities.FilmView.update(existingView.id, viewData);
    } else {
      await base44.entities.FilmView.create(viewData);
    }

    if (finalSave) {
      setSaved(true);
      onViewUpdate?.();
    }
  }, [clip, userEmail, player, assignmentId, existingView]);

  useEffect(() => {
    // Save progress every 30 seconds
    intervalRef.current = setInterval(() => saveProgress(false), 30000);
    return () => {
      clearInterval(intervalRef.current);
      saveProgress(true);
    };
  }, [saveProgress]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-white/10">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{clip.title}</h2>
          <p className="text-xs text-white/50">{clip.team_name} · {clip.category}</p>
        </div>
        <div className="flex items-center gap-3 ml-3">
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <Clock className="w-3.5 h-3.5" />
            <span>{fmtTime(localSeconds)} watched</span>
          </div>
          {saved && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full max-w-5xl"
            style={{ maxHeight: "calc(100vh - 120px)" }}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        ) : isDirectVideo ? (
          <video
            src={clip.video_url}
            controls
            autoPlay
            className="w-full h-full max-w-5xl object-contain"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          />
        ) : (
          <div className="text-white/40 text-sm">No playable video source found.</div>
        )}
      </div>

      {/* Footer */}
      {clip.description && (
        <div className="px-4 py-2 bg-black/50 border-t border-white/10">
          <p className="text-xs text-white/60">{clip.description}</p>
        </div>
      )}
    </div>
  );
}