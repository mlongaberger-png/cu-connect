import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Calendar, Users, Lock, Unlock, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export default function VolunteerOpportunitiesPanel({ teams, filterTeam, user, isAdmin, isCoach }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    team_id: "", role_id: "", event_id: "", date: "", start_time: "", end_time: "",
    required_count: 1, notes: "", signup_deadline: ""
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["volunteer-roles"],
    queryFn: () => base44.entities.VolunteerRole.filter({ is_active: true }),
  });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["volunteer-opportunities"],
    queryFn: () => base44.entities.VolunteerOpportunity.list("-date"),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["volunteer-assignments"],
    queryFn: () => base44.entities.VolunteerAssignment.list(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VolunteerOpportunity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteer-opportunities"] });
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VolunteerOpportunity.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-opportunities"] }),
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ id, is_locked }) => base44.entities.VolunteerOpportunity.update(id, { is_locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-opportunities"] }),
  });

  const resetForm = () => setForm({ team_id: "", role_id: "", event_id: "", date: "", start_time: "", end_time: "", required_count: 1, notes: "", signup_deadline: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    const team = teams.find(t => t.id === form.team_id);
    const role = roles.find(r => r.id === form.role_id);
    const event = events.find(ev => ev.id === form.event_id);
    createMutation.mutate({
      ...form,
      team_name: team?.name || "",
      role_name: role?.name || "",
      event_name: event?.title || "",
      required_count: Number(form.required_count),
    });
  };

  const visibleOpps = filterTeam === "all"
    ? opportunities.filter(o => teams.some(t => t.id === o.team_id))
    : opportunities.filter(o => o.team_id === filterTeam);

  const getFilledCount = (oppId) => assignments.filter(a => a.opportunity_id === oppId && a.status !== "no_show").length;

  const teamEvents = form.team_id ? events.filter(e => e.team_id === form.team_id) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Volunteer Opportunities</h2>
        {(isAdmin || isCoach) && (
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Opportunity
          </Button>
        )}
      </div>

      {visibleOpps.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No volunteer opportunities yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleOpps.map(opp => {
            const filled = getFilledCount(opp.id);
            const total = opp.required_count || 1;
            const pct = Math.min(100, Math.round((filled / total) * 100));
            const isFull = filled >= total;
            const oppAssignments = assignments.filter(a => a.opportunity_id === opp.id);

            return (
              <div key={opp.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{opp.role_name}</span>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{opp.team_name}</span>
                      {opp.is_locked && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
                      {isFull && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Full</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{opp.date ? format(new Date(opp.date), "MMM d, yyyy") : "No date"}</span>
                      {opp.start_time && <span>{opp.start_time}{opp.end_time ? ` – ${opp.end_time}` : ""}</span>}
                      {opp.event_name && <span className="text-primary">📅 {opp.event_name}</span>}
                    </div>
                    {/* Fill bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isFull ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{filled}/{total} filled</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(isAdmin || isCoach) && (
                      <>
                        <button
                          onClick={() => toggleLockMutation.mutate({ id: opp.id, is_locked: !opp.is_locked })}
                          className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                          title={opp.is_locked ? "Unlock" : "Lock"}
                        >
                          {opp.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteMutation.mutate(opp.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                      className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedId === opp.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {expandedId === opp.id && (
                  <div className="border-t border-border px-4 py-3 bg-surface/50">
                    {oppAssignments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No volunteers signed up yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Signed Up</p>
                        {oppAssignments.map(a => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <span className="text-foreground">{a.volunteer_name || a.volunteer_email}</span>
                            <span className="text-xs text-muted-foreground">({a.player_name})</span>
                            <StatusBadge status={a.status} />
                          </div>
                        ))}
                      </div>
                    )}
                    {opp.notes && (isAdmin || isCoach) && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">📝 {opp.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Volunteer Opportunity</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Team *</Label>
                <Select value={form.team_id} onValueChange={v => setForm(f => ({ ...f, team_id: v, event_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                  <SelectContent>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role_id} onValueChange={v => setForm(f => ({ ...f, role_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.team_id && teamEvents.length > 0 && (
              <div className="space-y-1.5">
                <Label>Link to Event (optional)</Label>
                <Select value={form.event_id || "none"} onValueChange={v => setForm(f => ({ ...f, event_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="No event linked" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event</SelectItem>
                    {teamEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.title} – {e.date}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Volunteers Needed</Label>
                <Input type="number" min="1" value={form.required_count} onChange={e => setForm(f => ({ ...f, required_count: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Signup Deadline</Label>
                <Input type="date" value={form.signup_deadline} onChange={e => setForm(f => ({ ...f, signup_deadline: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Admin Notes (not visible to parents)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional internal notes" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.team_id || !form.role_id || !form.date}>
                Create Opportunity
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    signed_up: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    no_show: "bg-red-500/20 text-red-400",
    excused: "bg-yellow-500/20 text-yellow-400",
  };
  const label = { signed_up: "Signed Up", completed: "Completed", no_show: "No Show", excused: "Excused" };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || ""}`}>{label[status] || status}</span>;
}