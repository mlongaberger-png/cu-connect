import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Aug 11, 2026: this tab is the root-cause fix for a bug found while scoping the
// coach-compliance feature -- CoachProfile.team_id is the ONLY thing that scopes a
// coach's own Teams/Applications/Carpool views (see Sidebar.jsx/Applications.jsx/
// Carpool.jsx/Teams.jsx), but the only prior UI that created CoachProfile records
// (CoachProfileModal, from CoachesTraining.jsx) never actually set team_id -- it only
// took a free-typed team NAME. Live DB check found exactly one CoachProfile record in
// the whole app (a QA test fixture), meaning every real coach saw an empty Teams page.
// This tab is the real "assign a coach to this team" flow that was missing entirely.

const ROLE_LABELS = { head_coach: "Head Coach", assistant_coach: "Asst. Coach", manager: "Manager" };
const SPORT_TYPE_MAP = { football: "football", baseball: "baseball", cheerleading: "cheer", cheer: "cheer" };
const STAFF_ROLES = new Set(["coach", "athletic_director", "admin"]);

export default function TeamCoachesTab({ team }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAssign, setShowAssign] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [roleType, setRoleType] = useState("assistant_coach");

  const { data: coachProfiles = [], isLoading } = useQuery({
    queryKey: ["team-coach-profiles", team.id],
    queryFn: () => base44.entities.CoachProfile.filter({ team_id: team.id }),
  });

  // Fixed Aug 12, 2026: raw base44.entities.User.list() 403s for every non-admin
  // caller (platform-default User RLS) -- confirmed live for an athletic_director
  // account, the exact role this feature is built for. searchStaffUsers re-implements
  // the read server-side under asServiceRole, same pattern as getDmContacts.
  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-for-coach-assign"],
    queryFn: async () => {
      const res = await base44.functions.invoke("searchStaffUsers");
      if (res.data?.error) throw new Error(res.data.error);
      return res.data?.users || [];
    },
    enabled: showAssign,
  });

  const alreadyAssignedEmails = new Set(coachProfiles.map(p => p.user_email?.toLowerCase()).filter(Boolean));

  const displayName = (u) => u.display_name || u.full_name || u.email;

  // Only surface already-staff accounts (coach/AD/admin) as "existing" matches --
  // assigning a CoachProfile doesn't grant the Coach role guard by itself (that's
  // driven by User.role), so silently linking a parent/athlete account here would
  // create a CoachProfile that doesn't actually unlock any coach-facing pages for
  // them. Anyone not already staff goes through "invite as new coach" instead,
  // which correctly sets role: "coach" from the start.
  const searchResults = search.trim().length < 2 ? [] : allUsers.filter(u => {
    if (!STAFF_ROLES.has(u.role)) return false;
    if (alreadyAssignedEmails.has(u.email?.toLowerCase())) return false;
    const q = search.toLowerCase();
    return displayName(u).toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  }).slice(0, 8);

  const resetAssignForm = () => {
    setSearch(""); setSelectedUser(null); setInviteEmail(""); setInviteName(""); setRoleType("assistant_coach");
  };

  const assignMutation = useMutation({
    mutationFn: async () => {
      let email, name;
      if (selectedUser) {
        email = selectedUser.email;
        name = displayName(selectedUser);
      } else {
        if (!inviteEmail) throw new Error("Enter an email to invite, or pick an existing account above.");
        email = inviteEmail;
        name = inviteName || inviteEmail;
        // redirectPath is required -- omitting it drops the invitee on the generic
        // /welcome marketing page instead of into the app (established lesson,
        // see the project doc's Aug 5 caveat).
        await base44.users.inviteUser(email, "coach", "/Portal");
      }
      const sportType = SPORT_TYPE_MAP[(team.sport_name || "").toLowerCase()];
      const profile = await base44.entities.CoachProfile.create({
        user_email: email,
        user_name: name,
        team_id: team.id,
        team_name: team.name,
        ...(sportType ? { sport_type: sportType } : {}),
        role_type: roleType,
      });
      if (roleType === "head_coach") {
        await base44.entities.Team.update(team.id, { head_coach: name, coach_email: email });
      }
      return profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-coach-profiles", team.id] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setShowAssign(false);
      resetAssignForm();
      toast({ title: "Coach assigned" });
    },
    onError: (err) => {
      toast({ title: "Couldn't assign coach", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (profile) => base44.entities.CoachProfile.delete(profile.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-coach-profiles", team.id] });
      toast({ title: "Coach removed from team" });
    },
    onError: (err) => {
      toast({ title: "Couldn't remove coach", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ profile, role_type }) => base44.entities.CoachProfile.update(profile.id, { role_type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-coach-profiles", team.id] }),
    onError: (err) => {
      toast({ title: "Couldn't update role", description: err?.message || "Please try again.", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Coaches</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Everyone assigned here can access this team's roster, schedule, and messages as Coach.</p>
        </div>
        <Button size="sm" onClick={() => { resetAssignForm(); setShowAssign(true); }} className="bg-primary text-primary-foreground gap-1.5 h-8 text-xs flex-shrink-0">
          <UserPlus className="w-3.5 h-3.5" /> Assign Coach
        </Button>
      </div>

      {isLoading ? (
        <div className="h-16 bg-card rounded-xl animate-pulse border border-border" />
      ) : coachProfiles.length === 0 ? (
        <div className="text-center py-10 bg-card rounded-xl border border-border">
          <ShieldCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No coaches assigned to this team yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coachProfiles.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{p.user_name || p.user_email}</p>
                <p className="text-xs text-muted-foreground truncate">{p.user_email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select value={p.role_type || "assistant_coach"} onValueChange={(v) => changeRoleMutation.mutate({ profile: p, role_type: v })}>
                  <SelectTrigger className="w-32 h-8 bg-surface border-border text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="head_coach">Head Coach</SelectItem>
                    <SelectItem value="assistant_coach">Asst. Coach</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => removeMutation.mutate(p)} className="p-1.5 rounded-lg bg-surface hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader><DialogTitle>Assign Coach to {team.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Search existing staff accounts</Label>
              <Input value={search} onChange={e => { setSearch(e.target.value); setSelectedUser(null); }} placeholder="Name or email…" className="bg-surface border-border h-9 text-sm" />
              {searchResults.length > 0 && !selectedUser && (
                <div className="mt-1 border border-border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                  {searchResults.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUser(u); setSearch(displayName(u)); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface border-b border-border/50 last:border-0"
                    >
                      <p className="text-foreground">{displayName(u)}</p>
                      <p className="text-xs text-muted-foreground">{u.email} · {u.role}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <p className="text-xs text-primary mt-1">Selected: {selectedUser.email}</p>
              )}
            </div>

            {!selectedUser && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">Not an existing staff account? Invite a new coach login:</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Name" className="bg-surface border-border h-9 text-sm" />
                  <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email" type="email" className="bg-surface border-border h-9 text-sm" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Role</Label>
              <Select value={roleType} onValueChange={setRoleType}>
                <SelectTrigger className="bg-surface border-border h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="head_coach">Head Coach</SelectItem>
                  <SelectItem value="assistant_coach">Asst. Coach</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAssign(false)} className="border-border h-8 text-xs">Cancel</Button>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending || (!selectedUser && !inviteEmail)}
                className="bg-primary text-primary-foreground h-8 text-xs"
              >
                {assignMutation.isPending ? "Assigning…" : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
