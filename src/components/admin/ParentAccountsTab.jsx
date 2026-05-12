import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, UserCircle, Mail, Edit2, Users, AlertCircle, Trash2, Link2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import InviteParentPanel from "@/components/admin/InviteParentPanel";
import AccessRequestsPanel from "@/components/admin/AccessRequestsPanel";

export default function ParentAccountsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [deletingUser, setDeletingUser] = useState(null);

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

  const parentUsers = users.filter(u => u.role === "parent" || u.role === "user" || u.role === "pending" || !u.role);
  const filtered = parentUsers.filter(u => {
    const q = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const getLinkedPlayers = (email) =>
    guardians.filter(g => g.user_email === email).map(g => players.find(p => p.id === g.player_id)).filter(Boolean);

  const deleteMutation = useMutation({
    mutationFn: ({ id, email }) => base44.functions.invoke("adminDeleteAccount", { target_user_id: id, target_email: email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["playerGuardians"] });
      toast({ title: "Account deleted successfully" });
      setDeletingUser(null);
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.functions.invoke("updateParentName", { target_user_id: id, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ title: "Parent updated successfully" });
      setEditingUser(null);
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const [appleRelayEmail, setAppleRelayEmail] = useState("");
  const [linkingRelay, setLinkingRelay] = useState(false);

  const openEdit = (user) => {
    setEditingUser(user);
    setEditForm({ full_name: user.full_name || "", role: user.role || "parent" });
    setAppleRelayEmail("");
  };

  const handleLinkRelayEmail = async () => {
    if (!appleRelayEmail.trim() || !editingUser) return;
    setLinkingRelay(true);
    const res = await base44.functions.invoke("linkRelayEmail", {
      primary_email: editingUser.email,
      relay_email: appleRelayEmail.trim(),
    });
    setLinkingRelay(false);
    if (res.data?.success) {
      queryClient.invalidateQueries({ queryKey: ["playerGuardians"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setAppleRelayEmail("");
      toast({ title: "Apple relay email linked", description: `${res.data.links_created} guardian link(s) created for ${appleRelayEmail.trim()}` });
    } else {
      toast({ title: "Link failed", description: res.data?.error || "Something went wrong.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AccessRequestsPanel />
      <InviteParentPanel />

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
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => setDeletingUser(user)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Parent Account</DialogTitle></DialogHeader>
          {deletingUser && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the account for <span className="font-semibold text-foreground">{deletingUser.full_name || deletingUser.email}</span>?
              </p>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs space-y-1">
                <p className="font-semibold">This will permanently:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Remove their account access</li>
                  <li>Delete all player guardian links</li>
                  <li>Remove their push notification subscriptions</li>
                </ul>
                <p className="mt-1">Financial records are retained per compliance policy.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate({ id: deletingUser.id, email: deletingUser.email })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="space-y-2 p-3 rounded-lg bg-surface border border-border">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-primary" /> Link Apple ID / Relay Email</p>
                <p className="text-xs text-muted-foreground">If this parent uses Sign in with Apple with "Hide My Email", enter their private relay address so they gain access automatically.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="abc123@privaterelay.appleid.com"
                    value={appleRelayEmail}
                    onChange={e => setAppleRelayEmail(e.target.value)}
                    className="font-mono text-xs h-8"
                  />
                  <Button size="sm" variant="outline" onClick={handleLinkRelayEmail} disabled={!appleRelayEmail.trim() || linkingRelay} className="shrink-0 h-8">
                    {linkingRelay ? "Linking…" : "Link"}
                  </Button>
                </div>
              </div>
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