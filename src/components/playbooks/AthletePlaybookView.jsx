import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Circle, Video, ChevronRight, ArrowLeft, ExternalLink, FileText, Send, RotateCcw } from "lucide-react";

const CATEGORIES = ["Offense", "Defense", "Special Teams", "General"];

export default function AthletePlaybookView({ playbook, player, userEmail, submission, onSubmissionUpdated }) {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("General");
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [athleteNotes, setAthleteNotes] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  // Engagement time tracking
  const activeSecsRef = useRef(submission?.time_viewed_seconds || 0);
  const intervalRef = useRef(null);
  const lastFlushRef = useRef(Date.now());
  const sectionsSeenRef = useRef(new Set((() => { try { return JSON.parse(submission?.sections_accessed || "[]"); } catch { return []; } })()));
  const playsSeenRef = useRef(new Set((() => { try { return JSON.parse(submission?.plays_reviewed || "[]"); } catch { return []; } })()));

  useEffect(() => {
    if (!submission?.id || ["submitted","approved"].includes(submission?.status)) return;
    const tick = () => { activeSecsRef.current += 1; };
    intervalRef.current = setInterval(tick, 1000);

    // Flush every 30s or on visibility change
    const flush = async () => {
      if (!submission?.id) return;
      await base44.entities.PlaybookSubmission.update(submission.id, {
        time_viewed_seconds: activeSecsRef.current,
        status: submission.status === "assigned" ? "in_progress" : submission.status,
        sections_accessed: JSON.stringify([...sectionsSeenRef.current]),
        plays_reviewed: JSON.stringify([...playsSeenRef.current]),
      });
      onSubmissionUpdated?.();
    };

    const flushInterval = setInterval(flush, 30000);
    const handleVisibility = () => { if (document.hidden) { clearInterval(intervalRef.current); } else { intervalRef.current = setInterval(tick, 1000); } };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      clearInterval(flushInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
      flush();
    };
  }, [submission?.id]);

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

  // Uploaded-doc playbook detection
  const isUploadedDoc = !!playbook.document_url && plays.length === 0;
  const DOC_PLAY_ID = `doc_${playbook.id}`;
  const docReviewed = reviews.some(r => r.play_id === DOC_PLAY_ID);

  const handleMarkDocReviewed = async () => {
    await base44.entities.PlayReview.create({
      play_id: DOC_PLAY_ID,
      playbook_id: playbook.id,
      player_id: player?.id,
      player_name: player ? `${player.first_name} ${player.last_name}` : "",
      reviewed_by_email: userEmail,
      reviewed_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["my-reviews", playbook.id, player?.id] });
  };

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

  const trackCategory = (cat) => { sectionsSeenRef.current.add(cat); setActiveCategory(cat); };
  const trackPlay = (play) => { playsSeenRef.current.add(play.id); setSelectedPlay(play); };

  const handleSubmitAssignment = async () => {
    if (!submission?.id) return;
    setSubmitting(true);
    await base44.entities.PlaybookSubmission.update(submission.id, {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      athlete_notes: athleteNotes.trim() || null,
      time_viewed_seconds: activeSecsRef.current,
      sections_accessed: JSON.stringify([...sectionsSeenRef.current]),
      plays_reviewed: JSON.stringify([...playsSeenRef.current]),
    });
    setSubmitting(false);
    setShowSubmitForm(false);
    onSubmissionUpdated?.();
  };

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

  if (isUploadedDoc) {
    // Parse multi-file descriptions
    let extraFiles = [];
    if (playbook.description?.startsWith("__files__")) {
      try { extraFiles = JSON.parse(playbook.description.replace("__files__", "")); } catch {}
    }
    const allFiles = extraFiles.length > 0 ? extraFiles : [{ name: playbook.document_name || "Playbook", url: playbook.document_url }];

    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">{playbook.name}</h3>
              {playbook.season && <p className="text-xs text-muted-foreground mt-0.5">{playbook.season}</p>}
            </div>
            {docReviewed ? (
              <span className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" /> Reviewed
              </span>
            ) : (
              <button
                onClick={handleMarkDocReviewed}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed
              </button>
            )}
          </div>

          <div className="space-y-2">
            {allFiles.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors"
              >
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground flex-1 truncate">{f.name || `File ${i + 1}`}</span>
                <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </a>
            ))}
          </div>
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

      {/* Assignment status banners */}
      {submission && submission.status === "returned" && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border bg-red-500/10 border-red-500/30">
          <RotateCcw className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-red-400 text-sm">Assignment returned for revision.</span>
            {submission.coach_feedback && <p className="text-xs text-red-300 mt-0.5">{submission.coach_feedback}</p>}
          </div>
        </div>
      )}
      {submission && submission.status === "approved" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-green-500/10 border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="font-semibold text-green-400 text-sm">Assignment approved by coach</span>
        </div>
      )}
      {submission && submission.status === "submitted" && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-purple-500/10 border-purple-500/30">
          <Send className="w-4 h-4 text-purple-400" />
          <span className="text-purple-400 text-sm">Submitted — awaiting coach review</span>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {CATEGORIES.map(cat => {
          const count = visiblePlays.filter(p => p.category === cat).length;
          if (count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => trackCategory(cat)}
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
              onClick={() => trackPlay(play)}
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

      {/* Submit for review */}
      {submission && ["assigned","in_progress","returned"].includes(submission.status) && (
        <div className="pt-2 border-t border-border">
          {!showSubmitForm ? (
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              <Send className="w-4 h-4" /> Mark as Completed & Submit
            </button>
          ) : (
            <div className="space-y-3 bg-surface rounded-2xl p-4 border border-border">
              <p className="text-sm font-semibold text-foreground">Submit for Coach Review</p>
              <textarea
                value={athleteNotes}
                onChange={e => setAthleteNotes(e.target.value)}
                placeholder="Any notes for your coach? (optional)"
                rows={2}
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowSubmitForm(false)} className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button
                  onClick={handleSubmitAssignment}
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />{submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}