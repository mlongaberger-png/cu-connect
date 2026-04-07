import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, ClipboardList, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Offense", "Defense", "Special Teams", "General"];
const POSITION_GROUPS = ["All", "QB", "RB", "WR", "OL", "DL", "LB", "DB", "TE", "K/P"];

export default function AssignmentCreatorDialog({ playbook, teams, players, user, onClose, onCreated }) {
  const teamPlayers = players.filter(p => p.team_id === playbook.team_id && p.is_active !== false);

  const [assignedTo, setAssignedTo] = useState("all");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [requiredAction, setRequiredAction] = useState("review_all");
  const [requiredSections, setRequiredSections] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [parentVisible, setParentVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const toggleSection = (cat) =>
    setRequiredSections(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const togglePlayer = (id) =>
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const getAssignedLabel = () => {
    if (assignedTo === "all") return "Entire Team";
    if (assignedTo === "players") return `${selectedPlayers.length} athlete(s)`;
    return `${assignedTo} Group`;
  };

  const getAssignedValue = () => {
    if (assignedTo === "all") return "all";
    if (assignedTo === "players") return JSON.stringify(selectedPlayers);
    return assignedTo;
  };

  const handleSave = async () => {
    setSaving(true);
    const assignment = await base44.entities.PlaybookAssignment.create({
      playbook_id: playbook.id,
      playbook_name: playbook.name,
      team_id: playbook.team_id,
      team_name: playbook.team_name,
      assigned_to: getAssignedValue(),
      assigned_to_label: getAssignedLabel(),
      required_action: requiredAction,
      required_sections: requiredAction === "review_sections" ? JSON.stringify(requiredSections) : null,
      due_date: dueDate || null,
      instructions: instructions.trim() || null,
      parent_visible: parentVisible,
      status: "active",
      created_by_email: user?.email,
      created_by_name: user?.full_name,
    });

    // Create per-athlete submissions
    const targetPlayers = assignedTo === "all"
      ? teamPlayers
      : assignedTo === "players"
        ? teamPlayers.filter(p => selectedPlayers.includes(p.id))
        : teamPlayers.filter(p => p.position === assignedTo);

    await Promise.all(targetPlayers.map(p =>
      base44.entities.PlaybookSubmission.create({
        assignment_id: assignment.id,
        playbook_id: playbook.id,
        playbook_name: playbook.name,
        player_id: p.id,
        player_name: `${p.first_name} ${p.last_name}`,
        player_email: p.athlete_email || p.parent_email || "",
        team_id: playbook.team_id,
        status: "assigned",
        time_viewed_seconds: 0,
        due_date: dueDate || null,
      })
    ));

    setSaving(false);
    onCreated?.(assignment);
  };

  const canSave = assignedTo !== "players" || selectedPlayers.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-5 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Assign Playbook</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-surface rounded-xl px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{playbook.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{playbook.team_name}</p>
        </div>

        {/* Who */}
        <div className="space-y-2">
          <Label className="text-xs">Assign To</Label>
          <div className="flex flex-wrap gap-1.5">
            {POSITION_GROUPS.map(pos => {
              const val = pos === "All" ? "all" : pos;
              const active = assignedTo === val;
              return (
                <button key={pos} onClick={() => setAssignedTo(val)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"}`}
                >{pos}</button>
              );
            })}
            <button onClick={() => setAssignedTo("players")}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${assignedTo === "players" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >Specific Athletes</button>
          </div>

          {assignedTo === "players" && (
            <div className="max-h-36 overflow-y-auto space-y-1 mt-1 bg-surface rounded-xl p-2">
              {teamPlayers.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-card cursor-pointer">
                  <input type="checkbox" checked={selectedPlayers.includes(p.id)} onChange={() => togglePlayer(p.id)} />
                  <span className="text-sm text-foreground">{p.first_name} {p.last_name}</span>
                  {p.position && <span className="text-xs text-muted-foreground">· {p.position}</span>}
                </label>
              ))}
              {teamPlayers.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No players found</p>}
            </div>
          )}
        </div>

        {/* Required Action */}
        <div className="space-y-2">
          <Label className="text-xs">Required Action</Label>
          <div className="flex gap-2">
            {[["review_all", "Review Entire Playbook"], ["review_sections", "Specific Sections"]].map(([val, label]) => (
              <button key={val} onClick={() => setRequiredAction(val)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${requiredAction === val ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >{label}</button>
            ))}
          </div>
          {requiredAction === "review_sections" && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => toggleSection(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${requiredSections.includes(cat) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {requiredSections.includes(cat) && <Check className="w-3 h-3 inline mr-1" />}{cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Due date + instructions */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Due Date (optional)</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-surface border-border mt-0.5" />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={parentVisible} onChange={e => setParentVisible(e.target.checked)} />
              Visible to parents
            </label>
          </div>
        </div>

        <div>
          <Label className="text-xs">Instructions (optional)</Label>
          <textarea
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Any specific notes for athletes…"
            rows={2}
            className="w-full mt-0.5 bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 bg-primary text-primary-foreground gap-1">
            <ClipboardList className="w-3.5 h-3.5" />
            {saving ? "Assigning…" : "Create Assignment"}
          </Button>
        </div>
      </div>
    </div>
  );
}