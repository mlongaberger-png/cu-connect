import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, Video, ChevronDown, ChevronUp, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Offense", "Defense", "Special Teams", "General"];

export default function PlaybookEditor({ playbook, onClose, teams, user }) {
  const queryClient = useQueryClient();
  const isNew = !playbook?.id;

  const [form, setForm] = useState({
    name: playbook?.name || "",
    team_id: playbook?.team_id || "",
    team_name: playbook?.team_name || "",
    season: playbook?.season || "",
    description: playbook?.description || "",
    status: playbook?.status || "draft",
    parent_visible: playbook?.parent_visible !== false,
    assigned_to: playbook?.assigned_to || "all",
  });

  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState("General");
  const [newPlay, setNewPlay] = useState({ title: "", description: "", film_clip_url: "", film_clip_label: "" });
  const [addingPlay, setAddingPlay] = useState(false);
  const [uploadingDiagram, setUploadingDiagram] = useState(null);

  const { data: plays = [], refetch: refetchPlays } = useQuery({
    queryKey: ["plays", playbook?.id],
    queryFn: () => base44.entities.Play.filter({ playbook_id: playbook.id }),
    enabled: !!playbook?.id,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["play-reviews", playbook?.id],
    queryFn: () => base44.entities.PlayReview.filter({ playbook_id: playbook.id }),
    enabled: !!playbook?.id,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players-team", form.team_id],
    queryFn: () => base44.entities.Player.filter({ team_id: form.team_id }),
    enabled: !!form.team_id,
  });

  const handleSavePlaybook = async () => {
    setSaving(true);
    const team = teams.find(t => t.id === form.team_id);
    const data = { ...form, team_name: team?.name || form.team_name, created_by_email: user?.email, created_by_name: user?.full_name };
    if (isNew) {
      const created = await base44.entities.Playbook.create(data);
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      setSaving(false);
      onClose(created);
      return;
    }
    await base44.entities.Playbook.update(playbook.id, data);
    queryClient.invalidateQueries({ queryKey: ["playbooks"] });
    setSaving(false);
  };

  const handleAddPlay = async () => {
    if (!newPlay.title.trim() || !playbook?.id) return;
    await base44.entities.Play.create({
      ...newPlay,
      playbook_id: playbook.id,
      category: activeCategory,
      assigned_to: "all",
      sort_order: plays.length,
    });
    setNewPlay({ title: "", description: "", film_clip_url: "", film_clip_label: "" });
    setAddingPlay(false);
    refetchPlays();
  };

  const handleDeletePlay = async (playId) => {
    await base44.entities.Play.delete(playId);
    refetchPlays();
  };

  const handleUploadDiagram = async (playId, file) => {
    setUploadingDiagram(playId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Play.update(playId, { diagram_url: file_url });
    setUploadingDiagram(null);
    refetchPlays();
  };

  const handlePublish = async () => {
    await base44.entities.Playbook.update(playbook.id, { status: "published" });
    setForm(f => ({ ...f, status: "published" }));
    queryClient.invalidateQueries({ queryKey: ["playbooks"] });
  };

  const categoryPlays = plays.filter(p => p.category === activeCategory);

  // Review stats per play
  const reviewCountByPlay = {};
  reviews.forEach(r => { reviewCountByPlay[r.play_id] = (reviewCountByPlay[r.play_id] || 0) + 1; });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl mx-4 p-6 space-y-5" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">{isNew ? "New Playbook" : "Edit Playbook"}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && form.status === "draft" && (
              <Button size="sm" onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white gap-1">
                <Check className="w-3.5 h-3.5" /> Publish
              </Button>
            )}
            {!isNew && form.status === "published" && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-medium">Published</span>
            )}
            <button onClick={() => onClose()} className="text-muted-foreground hover:text-foreground transition-colors text-sm">✕</button>
          </div>
        </div>

        {/* Playbook Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Playbook Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Offensive Playbook" className="bg-surface border-border mt-0.5" />
          </div>
          <div>
            <Label className="text-xs">Team</Label>
            <select
              value={form.team_id}
              onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
              className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground"
            >
              <option value="">Select team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Season</Label>
            <Input value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} placeholder="e.g. Spring 2025" className="bg-surface border-border mt-0.5" />
          </div>
          <div>
            <Label className="text-xs">Assign To</Label>
            <select
              value={form.assigned_to}
              onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
              className="w-full h-9 mt-0.5 bg-surface border border-border rounded-md px-3 text-sm text-foreground"
            >
              <option value="all">Entire Team</option>
              {["QB", "RB", "WR", "OL", "DL", "LB", "DB", "TE", "K/P"].map(pos => (
                <option key={pos} value={pos}>{pos} Group</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" className="bg-surface border-border mt-0.5" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="pv" checked={form.parent_visible} onChange={e => setForm(f => ({ ...f, parent_visible: e.target.checked }))} />
            <label htmlFor="pv" className="text-xs text-muted-foreground">Visible to parents</label>
          </div>
        </div>

        <Button onClick={handleSavePlaybook} disabled={saving || !form.name || !form.team_id} className="bg-primary text-primary-foreground w-full">
          {saving ? "Saving…" : isNew ? "Create Playbook" : "Save Changes"}
        </Button>

        {/* Plays Section — only after playbook exists */}
        {!isNew && (
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Plays ({plays.length})</h3>
              <Button size="sm" variant="outline" onClick={() => setAddingPlay(true)} className="gap-1 border-primary/30 text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Play
              </Button>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {cat} ({plays.filter(p => p.category === cat).length})
                </button>
              ))}
            </div>

            {/* Add play form */}
            {addingPlay && (
              <div className="bg-surface rounded-xl p-4 space-y-2 border border-border">
                <Input value={newPlay.title} onChange={e => setNewPlay(p => ({ ...p, title: e.target.value }))} placeholder="Play name…" className="bg-card border-border" />
                <Input value={newPlay.description} onChange={e => setNewPlay(p => ({ ...p, description: e.target.value }))} placeholder="Coaching notes (optional)…" className="bg-card border-border" />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newPlay.film_clip_url} onChange={e => setNewPlay(p => ({ ...p, film_clip_url: e.target.value }))} placeholder="Video URL (optional)…" className="bg-card border-border text-xs" />
                  <Input value={newPlay.film_clip_label} onChange={e => setNewPlay(p => ({ ...p, film_clip_label: e.target.value }))} placeholder="Video label…" className="bg-card border-border text-xs" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddPlay} disabled={!newPlay.title.trim()} className="bg-primary text-primary-foreground gap-1"><Plus className="w-3.5 h-3.5" /> Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingPlay(false)} className="border-border">Cancel</Button>
                </div>
              </div>
            )}

            {/* Play list */}
            <div className="space-y-2">
              {categoryPlays.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No plays in {activeCategory} yet</p>}
              {categoryPlays.map(play => (
                <div key={play.id} className="bg-surface rounded-xl p-3 border border-border space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{play.title}</p>
                      {play.description && <p className="text-xs text-muted-foreground mt-0.5">{play.description}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {play.film_clip_url && (
                          <a href={play.film_clip_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                            <Video className="w-3 h-3" /> {play.film_clip_label || "Film Clip"}
                          </a>
                        )}
                        {reviewCountByPlay[play.id] && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> {reviewCountByPlay[play.id]} reviewed
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <label className="cursor-pointer p-1.5 rounded hover:bg-card transition-colors text-muted-foreground hover:text-foreground" title="Upload diagram">
                        {uploadingDiagram === play.id ? <span className="text-xs">…</span> : <Upload className="w-3.5 h-3.5" />}
                        <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files[0] && handleUploadDiagram(play.id, e.target.files[0])} />
                      </label>
                      <button onClick={() => handleDeletePlay(play.id)} className="p-1.5 rounded hover:bg-card text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {play.diagram_url && (
                    <a href={play.diagram_url} target="_blank" rel="noopener noreferrer">
                      <img src={play.diagram_url} alt={play.title} className="h-24 w-auto rounded-lg object-contain bg-card border border-border" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}