import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Circle, Video, ChevronRight, ArrowLeft } from "lucide-react";

const CATEGORIES = ["Offense", "Defense", "Special Teams", "General"];

export default function AthletePlaybookView({ playbook, player, userEmail }) {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("General");
  const [selectedPlay, setSelectedPlay] = useState(null);

  const { data: plays = [] } = useQuery({
    queryKey: ["plays", playbook.id],
    queryFn: () => base44.entities.Play.filter({ playbook_id: playbook.id }),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["my-reviews", playbook.id, player?.id],
    queryFn: () => base44.entities.PlayReview.filter({ playbook_id: playbook.id, player_id: player?.id }),
    enabled: !!player?.id,
  });

  const reviewedIds = new Set(reviews.map(r => r.play_id));

  const markReviewedMutation = useMutation({
    mutationFn: (play) => base44.entities.PlayReview.create({
      play_id: play.id,
      playbook_id: playbook.id,
      player_id: player?.id,
      player_name: player ? `${player.first_name} ${player.last_name}` : "",
      reviewed_by_email: userEmail,
      reviewed_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reviews", playbook.id, player?.id] });
    },
  });

  const visiblePlays = plays.filter(p => {
    const assigned = p.assigned_to;
    if (!assigned || assigned === "all") return true;
    try {
      const arr = JSON.parse(assigned);
      return arr.includes(player?.id) || arr.includes(player?.position);
    } catch { return assigned === "all"; }
  });

  const categoryPlays = visiblePlays.filter(p => p.category === activeCategory);
  const totalReviewed = visiblePlays.filter(p => reviewedIds.has(p.id)).length;

  if (selectedPlay) {
    const isReviewed = reviewedIds.has(selectedPlay.id);
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedPlay(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to plays
        </button>
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{selectedPlay.category}</span>
              <h3 className="text-lg font-bold text-foreground mt-0.5">{selectedPlay.title}</h3>
            </div>
            {isReviewed ? (
              <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Reviewed
              </span>
            ) : (
              <button
                onClick={() => markReviewedMutation.mutate(selectedPlay)}
                disabled={markReviewedMutation.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {markReviewedMutation.isPending ? "Marking…" : "Mark Reviewed"}
              </button>
            )}
          </div>

          {selectedPlay.diagram_url && (
            <a href={selectedPlay.diagram_url} target="_blank" rel="noopener noreferrer">
              <img src={selectedPlay.diagram_url} alt={selectedPlay.title} className="w-full max-h-64 object-contain rounded-xl bg-surface border border-border" />
            </a>
          )}

          {selectedPlay.description && (
            <div className="bg-surface rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coaching Notes</p>
              <p className="text-sm text-foreground">{selectedPlay.description}</p>
            </div>
          )}

          {selectedPlay.film_clip_url && (
            <a
              href={selectedPlay.film_clip_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              <Video className="w-4 h-4" /> {selectedPlay.film_clip_label || "Watch Film Clip"}
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">{playbook.name}</p>
          <span className="text-xs text-muted-foreground">{totalReviewed}/{visiblePlays.length} reviewed</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: visiblePlays.length ? `${(totalReviewed / visiblePlays.length) * 100}%` : "0%" }}
          />
        </div>
        {playbook.season && <p className="text-xs text-muted-foreground mt-1.5">{playbook.season}</p>}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {CATEGORIES.map(cat => {
          const count = visiblePlays.filter(p => p.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Play list */}
      <div className="space-y-2">
        {categoryPlays.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No plays in this category</p>}
        {categoryPlays.map(play => {
          const isReviewed = reviewedIds.has(play.id);
          return (
            <button
              key={play.id}
              onClick={() => setSelectedPlay(play)}
              className="w-full flex items-center gap-3 p-3 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors text-left"
            >
              {isReviewed
                ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{play.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {play.film_clip_url && <span className="flex items-center gap-0.5 text-[10px] text-blue-400"><Video className="w-2.5 h-2.5" /> Film</span>}
                  {play.diagram_url && <span className="text-[10px] text-muted-foreground">📐 Diagram</span>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}