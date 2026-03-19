import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "signed_up", label: "Signed Up" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No Show" },
  { value: "excused", label: "Excused" },
];

const STATUS_CLASSES = {
  signed_up: "bg-blue-500/20 text-blue-400",
  completed: "bg-green-500/20 text-green-400",
  no_show: "bg-red-500/20 text-red-400",
  excused: "bg-yellow-500/20 text-yellow-400",
};

export default function VolunteerAssignmentsPanel({ teams, filterTeam, user, isAdmin, isCoach }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterOpp, setFilterOpp] = useState("all");
  const [form, setForm] = useState({ opportunity_id: "", player_id: "", volunteer_name: "", volunteer_email: "", admin_notes: "" });

  const { data: opportunities = [] } = useQuery({
    queryKey: ["volunteer-opportunities"],
    queryFn: () => base44.entities.VolunteerOpportunity.list("-date"),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["volunteer-assignments"],
    queryFn: () => base44.entities.VolunteerAssignment.list("-created_date"),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.VolunteerAssignment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteer-assignments"] });
      setOpen(false);
      setForm({ opportunity_id: "", player_id: "", volunteer_name: "", volunteer_email: "", admin_notes: "" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.VolunteerAssignment.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-assignments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.VolunteerAssignment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["volunteer-assignments"] }),
  });

  const myTeamIds = new Set(teams.map(t => t.id));
  const visibleOpps = opportunities.filter(o => myTeamIds.has(o.team_id) && (filterTeam === "all" || o.team_id === filterTeam));
  const visibleAssignments = assignments.filter(a => {
    const opp = opportunities.find(o => o.id === a.opportunity_id);
    if (!opp) return false;
    if (!myTeamIds.has(opp.team_id)) return false;
    if (filterTeam !== "all" && opp.team_id !== filterTeam) return false;
    if (filterOpp !== "all" && a.opportunity_id !== filterOpp) return false;
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const opp = opportunities.find(o => o.id === form.opportunity_id);
    const player = players.find(p => p.id === form.player_id);
    createMutation.mutate({
      ...form,
      team_id: opp?.team_id || "",
      player_name: player ? `${player.first_name} ${player.last_name}` : "",
      override_by: user?.email,
      status: "signed_up",
    });
  };

  const oppPlayers = form.opportunity_id
    ? players.filter(p => {
        const opp = opportunities.find(o => o.id === form.opportunity_id);
        return opp && p.team_id === opp.team_id;
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground">All Assignments</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterOpp} onValueChange={setFilterOpp}>
            <SelectTrigger className="w-48 text-sm bg-surface border-border">
              <SelectValue placeholder="Filter by opportunity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Opportunities</SelectItem>
              {visibleOpps.map(o => (
                <SelectItem key={o.id} value={o.id}>{o.role_name} – {o.date ? format(new Date(o.date), "MMM d") : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(isAdmin || isCoach) && (
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Assign Volunteer
            </Button>
          )}
        </div>
      </div>

      {visibleAssignments.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No assignments yet</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volunteer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Player</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Opportunity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                {(isAdmin || isCoach) && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {visibleAssignments.map((a, i) => {
                const opp = opportunities.find(o => o.id === a.opportunity_id);
                return (
                  <tr key={a.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-surface/30"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.volunteer_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{a.volunteer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{a.player_name}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {opp ? (
                        <div>
                          <p className="text-foreground">{opp.role_name}</p>
                          <p className="text-xs text-muted-foreground">{opp.date ? format(new Date(opp.date), "MMM d, yyyy") : ""}</p>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(isAdmin || isCoach) ? (
                        <Select value={a.status} onValueChange={v => updateStatusMutation.mutate({ id: a.id, status: v })}>
                          <SelectTrigger className={`w-32 h-7 text-xs border-0 ${STATUS_CLASSES[a.status] || ""}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLASSES[a.status] || ""}`}>
                          {STATUS_OPTIONS.find(s => s.value === a.status)?.label || a.status}
                        </span>
                      )}
                    </td>
                    {(isAdmin || isCoach) && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteMutation.mutate(a.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual assign dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manually Assign Volunteer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Opportunity *</Label>
              <Select value={form.opportunity_id} onValueChange={v => setForm(f => ({ ...f, opportunity_id: v, player_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select opportunity" /></SelectTrigger>
                <SelectContent>
                  {visibleOpps.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.role_name} – {o.team_name} – {o.date ? format(new Date(o.date), "MMM d") : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Player *</Label>
              <Select value={form.player_id} onValueChange={v => setForm(f => ({ ...f, player_id: v }))} disabled={!form.opportunity_id}>
                <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                <SelectContent>
                  {oppPlayers.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Volunteer Name</Label>
                <Input value={form.volunteer_name} onChange={e => setForm(f => ({ ...f, volunteer_name: e.target.value }))} placeholder="Parent name" />
              </div>
              <div className="space-y-1.5">
                <Label>Volunteer Email *</Label>
                <Input type="email" value={form.volunteer_email} onChange={e => setForm(f => ({ ...f, volunteer_email: e.target.value }))} placeholder="parent@email.com" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admin Notes</Label>
              <Input value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))} placeholder="Optional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !form.opportunity_id || !form.player_id || !form.volunteer_email}>
                Assign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}