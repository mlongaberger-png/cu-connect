import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, UserCircle, Mail, Phone, Send, CheckCircle, Pencil, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import AdminInvoiceManager from "@/components/parentportal/AdminInvoiceManager";

export default function TeamDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get("id");
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [invitedEmails, setInvitedEmails] = useState({});
  const [inviting, setInviting] = useState(null);

  const handleInviteParent = async (player) => {
    if (!player.parent_email) return;
    setInviting(player.id);
    await base44.functions.invoke("inviteParent", { email: player.parent_email });
    setInvitedEmails(prev => ({ ...prev, [player.id]: true }));
    setInviting(null);
  };
  const [form, setForm] = useState({ first_name: "", last_name: "", jersey_number: "", position: "", parent_name: "", parent_email: "", parent_phone: "" });
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const team = teams.find(t => t.id === teamId);

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });
  const players = allPlayers.filter(p => p.team_id === teamId);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setShowForm(false); setForm({ first_name: "", last_name: "", jersey_number: "", position: "", parent_name: "", parent_email: "", parent_phone: "" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setShowForm(false); setEditingPlayer(null); setForm({ first_name: "", last_name: "", jersey_number: "", position: "", parent_name: "", parent_email: "", parent_phone: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Team.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["teams"] }); setShowTeamForm(false); },
  });

  const handleEditTeam = () => {
    setTeamForm({
      name: team.name || "",
      sport_name: team.sport_name || "",
      age_group: team.age_group || "",
      head_coach: team.head_coach || "",
      coach_email: team.coach_email || "",
      coach_phone: team.coach_phone || "",
      season: team.season || "",
      year: team.year || "",
      practice_location: team.practice_location || "",
      practice_schedule: team.practice_schedule || "",
    });
    setShowTeamForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, data: { ...form, team_id: teamId, team_name: team?.name || "", sport_name: team?.sport_name || "" } });
    } else {
      createMutation.mutate({ ...form, team_id: teamId, team_name: team?.name || "", sport_name: team?.sport_name || "" });
    }
  };

  const handleEdit = (player) => {
    setEditingPlayer(player);
    setForm({ first_name: player.first_name || "", last_name: player.last_name || "", jersey_number: player.jersey_number || "", position: player.position || "", parent_name: player.parent_name || "", parent_email: player.parent_email || "", parent_phone: player.parent_phone || "" });
    setShowForm(true);
  };

  if (!team) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Team not found</p>
        <Link to="/Teams"><Button variant="outline" className="mt-4 border-border">Back to Teams</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/Teams" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Teams
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-primary">{team.sport_name}</span>
            {team.age_group && <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{team.age_group}</span>}
            {team.season && <span className="text-xs text-muted-foreground capitalize">{team.season} {team.year}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEditTeam} className="border-border">
            <Settings className="w-4 h-4 mr-2" /> Edit Team
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Player
          </Button>
        </div>
      </div>

      {/* Coach Info */}
      {team.head_coach && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Coaching Staff</h3>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{team.head_coach}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {team.coach_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {team.coach_email}</span>}
                {team.coach_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {team.coach_phone}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Roster ({players.length})</h3>
        </div>
        {players.length === 0 ? (
          <div className="p-10 text-center">
            <UserCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No players on this roster yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">#</TableHead>
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Position</TableHead>
                  <TableHead className="text-muted-foreground">Parent</TableHead>
                  <TableHead className="text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-muted-foreground w-32">Portal Access</TableHead>
                  <TableHead className="text-muted-foreground w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map(p => (
                  <TableRow key={p.id} className="border-border hover:bg-surface">
                    <TableCell className="font-bold text-primary">{p.jersey_number || "-"}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.first_name} {p.last_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.position || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.parent_name || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.parent_email || p.parent_phone || "-"}</TableCell>
                    <TableCell>
                      {p.parent_email ? (
                        invitedEmails[p.id] ? (
                          <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Invited</span>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleInviteParent(p)} disabled={inviting === p.id} className="h-7 text-xs text-primary hover:text-primary/80 px-2">
                            <Send className="w-3 h-3 mr-1" />{inviting === p.id ? "Sending..." : "Invite"}
                          </Button>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">No email</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Invoices */}
      <AdminInvoiceManager players={players} teamName={team?.name || ""} />

      {/* Add/Edit Player Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingPlayer(null); setForm({ first_name: "", last_name: "", jersey_number: "", position: "", parent_name: "", parent_email: "", parent_phone: "" }); } }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>{editingPlayer ? "Edit Player" : "Add Player"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="bg-surface border-border" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Jersey #</Label><Input value={form.jersey_number} onChange={e => setForm({...form, jersey_number: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Position</Label><Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div><Label>Parent Name</Label><Input value={form.parent_name} onChange={e => setForm({...form, parent_name: e.target.value})} className="bg-surface border-border" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Parent Email</Label><Input type="email" value={form.parent_email} onChange={e => setForm({...form, parent_email: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Parent Phone</Label><Input value={form.parent_phone} onChange={e => setForm({...form, parent_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingPlayer(null); }} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">{editingPlayer ? "Save Changes" : "Add Player"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}