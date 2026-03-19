import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCircle, Mail, Edit2, Users, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ParentAccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});

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

  const parentUsers = users.filter(u => u.role === "parent" || u.role === "user" || !u.role);
  const filtered = parentUsers.filter(u => {
    const q = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const getLinkedPlayers = (email) =>
    guardians.filter(g => g.user_email === email).map(g => players.find(p => p.id === g.player_id)).filter(Boolean);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Parent updated successfully" });
      setEditingUser(null);
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({ full_name: user.full_name || "", role: user.role || "parent" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span><strong>Password resets</strong> must be initiated by the parent via "Forgot Password" on the login page. You can update their display name and role here.</span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} parent account{filtered.length !== 1 ? "s" : ""}</p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-surface animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No parent accounts found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const linked = getLinkedPlayers(user.email);
            return (
              <div key={user.id} className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border hover:border-primary/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-semibold text-sm">{(user.full_name || user.email || "?")[0].toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground truncate">{user.full_name || <span className="text-muted-foreground italic">No name</span>}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{user.role || "user"}</Badge>
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
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Parent Account</DialogTitle></DialogHeader>
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
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="user">User (unassigned)</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="athletic_director">Athletic Director</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(() => {
                const linked = getLinkedPlayers(editingUser.email);
                return linked.length > 0 ? (
                  <div className="space-y-1">
                    <Label>Linked Players</Label>
                    <div className="flex flex-wrap gap-2">
                      {linked.map(p => <Badge key={p.id} variant="outline">{p.first_name} {p.last_name} · {p.team_name || "No team"}</Badge>)}
                    </div>
                    <p className="text-xs text-muted-foreground">To change player links, edit the player record directly.</p>
                  </div>
                ) : <div className="text-xs text-muted-foreground p-3 rounded-lg bg-surface border border-border">No players linked to this account yet.</div>;
              })()}
              <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-surface border border-border">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-400" />
                Password changes must be initiated by the parent via "Forgot Password" on the login page.
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