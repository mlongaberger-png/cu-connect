import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCircle, Mail, Edit2, Users, Link2, X, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function StaffAccountsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [playerSearch, setPlayerSearch] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: guardians = [] } = useQuery({
    queryKey: ["playerGuardians"],
    queryFn: () => base44.entities.PlayerGuardian.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  const staffUsers = users.filter(u => ["admin", "athletic_director", "coach"].includes(u.role));

  const filtered = staffUsers.filter(u => {
    const q = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const getLinkedPlayers = (email) =>
    guardians.filter(g => g.user_email === email).map(g => players.find(p => p.id === g.player_id)).filter(Boolean);

  const displayName = (u) => u.display_name || u.full_name || "";

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({ full_name: displayName(user), role: user.role || "coach" });
    setPlayerSearch("");
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke("updateParentName", { target_user_id: id, ...data }),
    onSuccess: (_, variables) => {
      const patch = { ...variables.data };
      if (patch.full_name !== undefined) { patch.display_name = patch.full_name; delete patch.full_name; }
      queryClient.setQueryData(["users"], (old = []) =>
        old.map(u => u.id === variables.id ? { ...u, ...patch } : u)
      );
      toast({ title: "Staff account updated" });
      setEditingUser(null);
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const linkPlayerMutation = useMutation({
    mutationFn: ({ player, userEmail }) =>
      base44.entities.PlayerGuardian.create({
        player_id: player.id,
        player_name: `${player.first_name} ${player.last_name}`,
        user_email: userEmail,
        relationship: "Coach/Staff",
        invited_by: "admin",
        permissions: ["view_calendar", "view_messages"],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerGuardians"] });
      setPlayerSearch("");
      toast({ title: "Athlete linked" });
    },
    onError: (e) => toast({ title: "Link failed", description: e.message, variant: "destructive" }),
  });

  const unlinkPlayerMutation = useMutation({
    mutationFn: (guardianId) => base44.entities.PlayerGuardian.delete(guardianId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playerGuardians"] });
      toast({ title: "Athlete unlinked" });
    },
  });

  const linkedPlayers = editingUser ? getLinkedPlayers(editingUser.email) : [];

  const availablePlayers = players.filter(p => {
    if (!editingUser) return false;
    const alreadyLinked = guardians.some(g => g.user_email === editingUser.email && g.player_id === p.id);
    if (alreadyLinked) return false;
    const q = playerSearch.toLowerCase();
    if (!q) return true;
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.team_name || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search staff by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} staff account{filtered.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <UserCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No staff accounts found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const linked = getLinkedPlayers(user.email);
            return (
              <div key={user.id} className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border hover:border-primary/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">{(displayName(user) || user.email || "?")[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground truncate">{displayName(user) || <span className="text-muted-foreground italic">No name</span>}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{user.role?.replace("_", " ") || "staff"}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Mail className="w-3 h-3" />{user.email}
                  </div>
                  {linked.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Users className="w-3 h-3 shrink-0" />
                      {linked.map(p => `${p.first_name} ${p.last_name}`).join(", ")}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => openEdit(user)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Staff Account</DialogTitle></DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Email (cannot be changed)</Label>
                <Input value={editingUser.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-1">
                <Label>Display Name</Label>
                <Input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Full name" />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="athletic_director">Athletic Director</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Linked Athletes */}
              <div className="space-y-2 p-3 rounded-lg bg-surface border border-border">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-primary" /> Linked Athletes
                </p>
                {linkedPlayers.length > 0 ? (
                  <div className="space-y-1">
                    {linkedPlayers.map(p => {
                      const guardian = guardians.find(g => g.user_email === editingUser.email && g.player_id === p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-card border border-border">
                          <div>
                            <span className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</span>
                            {p.team_name && <span className="text-xs text-muted-foreground ml-2">· {p.team_name}</span>}
                          </div>
                          <button
                            onClick={() => guardian && unlinkPlayerMutation.mutate(guardian.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No athletes linked yet.</p>
                )}

                {/* Link new athlete */}
                <div className="pt-1 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search athletes to link…"
                      value={playerSearch}
                      onChange={e => setPlayerSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  {playerSearch && availablePlayers.length > 0 && (
                    <div className="rounded-lg border border-border bg-card max-h-40 overflow-y-auto">
                      {availablePlayers.slice(0, 20).map(p => (
                        <button
                          key={p.id}
                          onClick={() => linkPlayerMutation.mutate({ player: p, userEmail: editingUser.email })}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface transition-colors text-left border-b border-border last:border-0"
                        >
                          <div>
                            <span className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</span>
                            {p.team_name && <span className="text-xs text-muted-foreground ml-2">· {p.team_name}</span>}
                          </div>
                          <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                  {playerSearch && availablePlayers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">No matching athletes found.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ id: editingUser.id, data: editForm })} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}