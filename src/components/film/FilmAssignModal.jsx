import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { X, Send, Mail, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function FilmAssignModal({ clip, teams, players, user, onClose, onCreated }) {
  const queryClient = useQueryClient();
  const teamPlayers = players.filter(p => p.team_id === clip.team_id && p.is_active !== false);

  const [assignedTo, setAssignedTo] = useState("all");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const togglePlayer = (id) =>
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const getLabel = () => assignedTo === "all" ? "Entire Team" : `${selectedPlayers.length} athlete(s)`;
  const getValue = () => assignedTo === "all" ? "all" : JSON.stringify(selectedPlayers);
  const canSave = assignedTo === "all" || selectedPlayers.length > 0;

  const handleSave = async () => {
    setSaving(true);
    const assignment = await base44.entities.FilmAssignment.create({
      film_clip_id: clip.id,
      film_clip_title: clip.title,
      team_id: clip.team_id,
      team_name: clip.team_name,
      assigned_to: getValue(),
      assigned_to_label: getLabel(),
      due_date: dueDate || null,
      instructions: instructions.trim() || null,
      notify_email: notifyEmail,
      status: "active",
      created_by_email: user?.email,
      created_by_name: user?.full_name,
    });

    if (notifyEmail) {
      await base44.functions.invoke("sendFilmAssignment", { assignment_id: assignment.id });
    }

    queryClient.invalidateQueries({ queryKey: ["film-assignments"] });
    setSaving(false);
    setDone(true);
    setTimeout(() => { onCreated?.(assignment); }, 1200);
  };

  if (done) return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-7 h-7 text-green-400" />
        </div>
        <p className="font-semibold text-foreground">Assignment Sent!</p>
        {notifyEmail && <p className="text-xs text-muted-foreground">Email notifications delivered.</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Assign Film</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-surface rounded-xl px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{clip.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{clip.team_name} · {clip.category}</p>
        </div>

        {/* Assign to */}
        <div className="space-y-2">
          <Label className="text-xs">Assign To</Label>
          <div className="flex gap-2">
            <button onClick={() => setAssignedTo("all")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${assignedTo === "all" ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Entire Team
            </button>
            <button onClick={() => setAssignedTo("players")}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${assignedTo === "players" ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              Specific Athletes
            </button>
          </div>

          {assignedTo === "players" && (
            <div className="max-h-36 overflow-y-auto space-y-1 bg-surface rounded-xl p-2">
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

        <div>
          <Label className="text-xs">Due Date (optional)</Label>
          <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-surface border-border mt-0.5" />
        </div>

        <div>
          <Label className="text-xs">Instructions (optional)</Label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
            placeholder="What should athletes focus on when watching?"
            rows={2}
            className="w-full mt-0.5 bg-surface border border-border rounded-md px-3 py-2 text-sm text-foreground resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
        </div>

        {/* Notifications */}
        <div className="bg-surface rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Notifications</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} />
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Send email to parents & athletes</span>
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 border-border">Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 bg-primary text-primary-foreground gap-1.5">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Assign & Notify</>}
          </Button>
        </div>
      </div>
    </div>
  );
}