import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, UserCircle, Mail, Phone, Send, CheckCircle, Pencil, Settings, Eye, EyeOff, FileUp, ShieldCheck, Users, DollarSign, Cookie, AlertTriangle } from "lucide-react";
import SnackManagerPanel from "@/components/snacks/SnackManagerPanel";
import { Link } from "react-router-dom";
import AdminInvoiceManager from "@/components/parentportal/AdminInvoiceManager";
import RosterPDFButton from "@/components/roster/RosterPDFButton";
import RosterImporter from "@/components/roster/RosterImporter";
import { useAdminOrADGuard } from "@/hooks/useRoleGuard";
import TeamComplianceTab from "@/components/teams/TeamComplianceTab";
import { useAuth } from "@/lib/AuthContext";

export default function TeamDetail() {
  const { isAdmin, isAD } = useAdminOrADGuard();
  const { user } = useAuth();
  const isCoach = user?.role === "coach";
  const canManage = isAdmin || isAD;
  const canViewCompliance = canManage || isCoach;
  const urlParams = new URLSearchParams(window.location.search);
  const teamId = urlParams.get("id");
  const [activeTab, setActiveTab] = useState("roster");
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showRosterImporter, setShowRosterImporter] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSelected, setAssignSelected] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [teamForm, setTeamForm] = useState({});
  const [invitedEmails, setInvitedEmails] = useState({});
  const [inviting, setInviting] = useState(null);

  const handleInviteParent = async (player) => {
    if (!player.parent_email) return;
    setInviting(player.id);
    await base44.functions.invoke("inviteParent", {
      email: player.parent_email,
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
    });
    setInvitedEmails(prev => ({ ...prev, [player.id]: true }));
    setInviting(null);
  };
  const [form, setForm] = useState({ first_name: "", last_name: "", jersey_number: "", position: "", photo_url: "", parent_name: "", parent_email: "", parent_phone: "" });
  const [jerseyConflict, setJerseyConflict] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: teamEvents = [] } = useQuery({
    queryKey: ["events-team", teamId],
    queryFn: () => base44.entities.Event.filter({ team_id: teamId }, "-date"),
    enabled: !!teamId,
  });
  const team = teams.find(t => t.id === teamId);

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: uniformInventory = [] } = useQuery({
    queryKey: ["uniform-inventory", team?.sport_id],
    queryFn: () => base44.entities.UniformInventory.filter({ sport_id: team?.sport_id }),
    enabled: !!team?.sport_id,
  });
  const players = allPlayers
    .filter(p => p.team_id === teamId)
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

  const resetForm = () => { setForm({ first_name: "", last_name: "", jersey_number: "", position: "", photo_url: "", parent_name: "", parent_email: "", parent_phone: "" }); setJerseyConflict(false); };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Player.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setShowForm(false); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Player.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["players"] }); setShowForm(false); setEditingPlayer(null); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Player.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["players"] }),
  });

  const assignPlayersMutation = useMutation({
    mutationFn: async (playerIds) => {
      await Promise.all(
        playerIds.map(pid => base44.entities.Player.update(pid, { team_id: teamId, team_name: team?.name || "", sport_name: team?.sport_name || "" }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setShowAssignModal(false);
      setAssignSelected([]);
      setAssignSearch("");
    },
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

  const decrementJerseyInventory = async () => {
    const jerseyItem = uniformInventory.find(
      inv => inv.item_type === "jersey" && inv.quantity_assigned < inv.quantity_total
    );
    if (jerseyItem) {
      await base44.entities.UniformInventory.update(jerseyItem.id, {
        quantity_assigned: (jerseyItem.quantity_assigned || 0) + 1,
      });
      queryClient.invalidateQueries({ queryKey: ["uniform-inventory", team?.sport_id] });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setJerseyConflict(false);

    // Jersey number conflict check
    if (form.jersey_number) {
      const conflict = players.find(
        p => p.jersey_number === form.jersey_number && p.id !== editingPlayer?.id
      );
      if (conflict) {
        setJerseyConflict(true);
        return;
      }
    }

    const isNewJersey = form.jersey_number && form.jersey_number !== editingPlayer?.jersey_number;

    if (editingPlayer) {
      updateMutation.mutate(
        { id: editingPlayer.id, data: { ...form, team_id: teamId, team_name: team?.name || "", sport_name: team?.sport_name || "" } },
        { onSuccess: () => { if (isNewJersey) decrementJerseyInventory(); } }
      );
    } else {
      createMutation.mutate(
        { ...form, team_id: teamId, team_name: team?.name || "", sport_name: team?.sport_name || "" },
        { onSuccess: () => { if (form.jersey_number) decrementJerseyInventory(); } }
      );
    }
  };

  const handleEdit = (player) => {
    setEditingPlayer(player);
    setForm({ first_name: player.first_name || "", last_name: player.last_name || "", jersey_number: player.jersey_number || "", position: player.position || "", photo_url: player.photo_url || "", parent_name: player.parent_name || "", parent_email: player.parent_email || "", parent_phone: player.parent_phone || "" });
    setShowForm(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, photo_url: file_url }));
    setUploadingPhoto(false);
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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Back + Team Header */}
      <div>
        <Link to="/Teams" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground leading-tight truncate">{team.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {team.sport_name && <span className="text-sm text-primary font-medium">{team.sport_name}</span>}
              {team.age_group && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{team.age_group}</span>}
              {team.season && <span className="text-xs text-muted-foreground">{team.season.charAt(0).toUpperCase() + team.season.slice(1)}{team.year ? ` ${team.year}` : ""}</span>}
            </div>
          </div>
          {canManage && (
            <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground flex-shrink-0 h-9">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline ml-1">Add Player</span>
            </Button>
          )}
        </div>
      </div>

      {/* Admin Action Bar */}
      {canManage && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <RosterPDFButton team={team} players={players} label="Download PDF" />
          <Button
            variant="outline" size="sm"
            onClick={() => updateTeamMutation.mutate({ id: teamId, data: { roster_published: !team.roster_published } })}
            className={`flex-shrink-0 gap-1.5 text-xs ${team.roster_published ? "text-green-400 border-green-500/30" : "text-muted-foreground border-border"}`}
          >
            {team.roster_published ? <><Eye className="w-3.5 h-3.5" /> Published</> : <><EyeOff className="w-3.5 h-3.5" /> Publish</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowRosterImporter(true)} className="flex-shrink-0 border-border text-xs gap-1.5">
            <FileUp className="w-3.5 h-3.5" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAssignSelected([]); setAssignSearch(""); setShowAssignModal(true); }} className="flex-shrink-0 border-border text-xs gap-1.5">
            <UserCircle className="w-3.5 h-3.5" /> Assign
          </Button>
          <Button variant="outline" size="sm" onClick={handleEditTeam} className="flex-shrink-0 border-border text-xs gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Edit Team
          </Button>
        </div>
      )}

      {/* Tab bar */}
      {canViewCompliance && (
        <div className="flex border-b border-border -mx-4 md:-mx-6 px-4 md:px-6">
          <button
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "roster" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-4 h-4" /> Roster
          </button>
          {canViewCompliance && (
            <button
              onClick={() => setActiveTab("compliance")}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "compliance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <ShieldCheck className="w-4 h-4" /> Compliance
            </button>
          )}
          {canManage && (
            <button
              onClick={() => setActiveTab("invoices")}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "invoices" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <DollarSign className="w-4 h-4" /> Invoices
            </button>
          )}
          {(canManage || isCoach) && (
            <button
              onClick={() => setActiveTab("snacks")}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "snacks" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Cookie className="w-4 h-4" /> Snacks
            </button>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {activeTab === "compliance" && canViewCompliance && (
        <TeamComplianceTab team={team} players={players} />
      )}

      {/* Roster tab content */}
      {activeTab === "roster" && (<>

      {team.head_coach && (
        <div className="bg-card rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Coaching Staff</p>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">{team.head_coach}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {team.coach_email && (
                  <a href={`mailto:${team.coach_email}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-3 h-3" /><span className="truncate max-w-[180px]">{team.coach_email}</span>
                  </a>
                )}
                {team.coach_phone && (
                  <a href={`tel:${team.coach_phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-3 h-3" />{team.coach_phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Roster <span className="text-muted-foreground font-normal text-sm">({players.length})</span></h3>
        </div>
        {players.length === 0 ? (
          <div className="p-10 text-center">
            <UserCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No players on this roster yet</p>
          </div>
        ) : (
          <>
            {/* Mobile / Tablet: card list */}
            <div className="lg:hidden divide-y divide-border">
              {players.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {p.photo_url
                      ? <img src={p.photo_url} alt={p.first_name} className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-primary">{p.jersey_number || (p.first_name?.[0] || "?")}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm">{p.first_name} {p.last_name}</p>
                    <div className="flex gap-2 mt-0.5 flex-wrap">
                      {p.position && <span className="text-xs text-muted-foreground">{p.position}</span>}
                      {p.parent_name && <span className="text-xs text-muted-foreground truncate">· {p.parent_name}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {p.parent_email && (
                      invitedEmails[p.id] ? (
                        <span className="text-xs text-green-400 flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /></span>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => handleInviteParent(p)} disabled={inviting === p.id} className="h-8 w-8 text-primary">
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      )
                    )}
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-10">#</TableHead>
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Position</TableHead>
                    <TableHead className="text-muted-foreground">Parent</TableHead>
                    <TableHead className="text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-muted-foreground w-28">Portal</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map(p => (
                    <TableRow key={p.id} className="border-border hover:bg-surface">
                      <TableCell className="font-bold text-primary">{p.jersey_number || "-"}</TableCell>
                      <TableCell className="font-medium text-foreground">{p.first_name} {p.last_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.position || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.parent_name || "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.parent_email || p.parent_phone || "-"}</TableCell>
                      <TableCell>
                        {p.parent_email ? (
                          invitedEmails[p.id] ? (
                            <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Invited</span>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleInviteParent(p)} disabled={inviting === p.id} className="h-7 text-xs text-primary px-2">
                              <Send className="w-3 h-3 mr-1" />{inviting === p.id ? "Sending..." : "Invite"}
                            </Button>
                          )
                        ) : <span className="text-xs text-muted-foreground">No email</span>}
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="h-8 w-8 text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      </>)}

      {/* Invoices Tab */}
      {activeTab === "invoices" && canManage && (
        <AdminInvoiceManager players={players} teamName={team?.name || ""} />
      )}

      {/* Snacks Tab */}
      {activeTab === "snacks" && (canManage || isCoach) && (
        <SnackManagerPanel
          teams={[team]}
          events={teamEvents}
          currentUser={user}
        />
      )}

      {/* Edit Team Dialog */}
      <Dialog open={showTeamForm} onOpenChange={setShowTeamForm}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg">
          <DialogHeader><DialogTitle>Edit Team</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateTeamMutation.mutate({ id: teamId, data: teamForm }); }} className="space-y-4">
            <div>
              <Label>Team Name</Label>
              <Input value={teamForm.name || ""} onChange={e => setTeamForm({...teamForm, name: e.target.value})} className="bg-surface border-border" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Age Group / Division</Label><Input value={teamForm.age_group || ""} onChange={e => setTeamForm({...teamForm, age_group: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Season</Label><Input value={teamForm.season || ""} onChange={e => setTeamForm({...teamForm, season: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Year</Label><Input value={teamForm.year || ""} onChange={e => setTeamForm({...teamForm, year: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Head Coach</Label><Input value={teamForm.head_coach || ""} onChange={e => setTeamForm({...teamForm, head_coach: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Coach Email</Label><Input type="email" value={teamForm.coach_email || ""} onChange={e => setTeamForm({...teamForm, coach_email: e.target.value})} className="bg-surface border-border" /></div>
              <div><Label>Coach Phone</Label><Input value={teamForm.coach_phone || ""} onChange={e => setTeamForm({...teamForm, coach_phone: e.target.value})} className="bg-surface border-border" /></div>
            </div>
            <div><Label>Practice Location</Label><Input value={teamForm.practice_location || ""} onChange={e => setTeamForm({...teamForm, practice_location: e.target.value})} className="bg-surface border-border" /></div>
            <div><Label>Practice Schedule</Label><Input value={teamForm.practice_schedule || ""} onChange={e => setTeamForm({...teamForm, practice_schedule: e.target.value})} className="bg-surface border-border" /></div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowTeamForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Roster Importer */}
      <RosterImporter open={showRosterImporter} onOpenChange={setShowRosterImporter} team={team} />

      {/* Assign Existing Players Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader><DialogTitle>Assign Existing Players to {team.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search players..."
              value={assignSearch}
              onChange={e => setAssignSearch(e.target.value)}
              className="bg-surface border-border"
            />
            <div className="rounded-lg border border-border bg-surface max-h-64 overflow-y-auto">
              {allPlayers
                .filter(p => p.team_id !== teamId && p.is_active !== false)
                .filter(p => {
                  const q = assignSearch.toLowerCase();
                  return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.team_name || "").toLowerCase().includes(q);
                })
                .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`))
                .map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-card cursor-pointer border-b border-border last:border-0">
                    <input
                      type="checkbox"
                      checked={assignSelected.includes(p.id)}
                      onChange={e => setAssignSelected(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                      {p.team_name && <p className="text-xs text-muted-foreground">Currently: {p.team_name}</p>}
                    </div>
                    {p.jersey_number && <span className="text-xs text-primary font-bold">#{p.jersey_number}</span>}
                  </label>
                ))
              }
              {allPlayers.filter(p => p.team_id !== teamId && p.is_active !== false).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">No other players found</p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{assignSelected.length} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAssignModal(false)} className="border-border">Cancel</Button>
                <Button
                  disabled={assignSelected.length === 0 || assignPlayersMutation.isPending}
                  onClick={() => assignPlayersMutation.mutate(assignSelected)}
                  className="bg-primary text-primary-foreground"
                >
                  {assignPlayersMutation.isPending ? "Assigning..." : `Assign ${assignSelected.length > 0 ? assignSelected.length : ""} Player${assignSelected.length !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Player Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingPlayer(null); resetForm(); setJerseyConflict(false); } }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>{editingPlayer ? "Edit Player" : "Add Player"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface border border-border flex items-center justify-center flex-shrink-0">
                {form.photo_url
                  ? <img src={form.photo_url} alt="Player" className="w-full h-full object-cover" />
                  : <UserCircle className="w-8 h-8 text-muted-foreground" />
                }
              </div>
              <div>
                <Label className="text-xs">Player Photo</Label>
                <label className="mt-1 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                  {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} className="bg-surface border-border" required /></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} className="bg-surface border-border" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Jersey #</Label>
                <Input
                  value={form.jersey_number}
                  onChange={e => { setForm({...form, jersey_number: e.target.value}); setJerseyConflict(false); }}
                  className={`bg-surface border-border ${jerseyConflict ? "border-red-500/70" : ""}`}
                />
                {jerseyConflict && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Number conflict: This jersey number is already claimed on this roster.
                  </p>
                )}
              </div>
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