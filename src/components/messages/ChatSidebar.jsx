import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Hash, MessageSquare, Car, Megaphone, Crown, MessageSquarePlus } from "lucide-react";
import { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";
import NewDmDialog from "@/components/messages/NewDmDialog";

export default function ChatSidebar({ activeChannelId }) {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: "", type: "team", team_id: "" });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const canCreate = currentUser ? ["admin", "athletic_director"].includes(currentUser.role) : false;

  const { data: orgTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!currentUser,
  });

  const { data: teamChannels = [] } = useQuery({
    queryKey: ["channels", "team"],
    queryFn: () => base44.entities.Channel.filter({ type: "team" }),
  });

  const { data: directChannels = [] } = useQuery({
    queryKey: ["channels", "direct"],
    queryFn: () => base44.entities.Channel.filter({ type: "direct" }),
  });

  const { data: carpoolChannels = [] } = useQuery({
    queryKey: ["channels", "carpool"],
    queryFn: () => base44.entities.Channel.filter({ type: "carpool" }),
  });

  const { data: announceChannels = [] } = useQuery({
    queryKey: ["channels", "announcement"],
    queryFn: () => base44.entities.Channel.filter({ type: "announcement" }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Channel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setShowCreate(false);
      setNewChannelForm({ name: "", type: "team", team_id: "" });
    },
  });

  const select = (id) => setSearchParams({ channelId: id });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newChannelForm.name.trim()) return;
    createMutation.mutate({
      name: newChannelForm.name.trim(),
      type: newChannelForm.type,
      team_id: newChannelForm.team_id || null,
      organization_id: currentUser?.organization_id || "",
    });
  };

  const ChannelBtn = ({ ch, pinned }) => {
    const isActive = ch.id === activeChannelId;
    // For team channels, look up the team avatar from orgTeams
    const linkedTeam = ch.type === "team" && ch.team_id
      ? orgTeams.find(t => t.id === ch.team_id)
      : null;
    const teamAvatarUrl = linkedTeam?.avatar_url || ch.avatar_url;
    const teamAvatarType = linkedTeam?.avatar_type;

    return (
      <button
        onClick={() => select(ch.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
          ${isActive ? "bg-primary/15 text-primary font-medium" : "hover:bg-surface text-muted-foreground"}
          ${pinned ? "border border-yellow-500/30 bg-yellow-500/5" : ""}`}
      >
        <div className="w-7 h-7 rounded-full overflow-hidden bg-surface flex items-center justify-center shrink-0 border border-border/50">
          {teamAvatarUrl ? (
            <img src={teamAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : linkedTeam ? (
            <span className="text-sm">{getTeamAvatarEmoji(teamAvatarType)}</span>
          ) : pinned ? (
            <Crown className="w-3.5 h-3.5 text-yellow-400" />
          ) : (
            <Hash className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
        <span className="truncate text-sm">{ch.name || "Unnamed"}</span>
        {pinned && <Crown className="w-3 h-3 text-yellow-400 ml-auto shrink-0" />}
      </button>
    );
  };

  return (
    <Tabs defaultValue="teams" className="flex h-full flex-col bg-card overflow-hidden">
      {/* Solid Header Unit - z-20 keeps it in front */}
      <div className="flex-shrink-0 border-b border-border bg-card z-20 relative shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Messages
          </h2>
          {canCreate && (
            <Button variant="ghost" size="icon" onClick={() => setShowCreate(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
        <div className="px-4 pb-3">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="teams">🛡️ Teams</TabsTrigger>
            <TabsTrigger value="direct">💬 Direct</TabsTrigger>
            <TabsTrigger value="carpool">🚗 Carpool</TabsTrigger>
            <TabsTrigger value="announce">📢 News</TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Scrollable Area - z-0 keeps it behind the header */}
      <div className="flex-1 overflow-y-auto relative z-0 p-2 space-y-1">
        <TabsContent value="teams" className="m-0 space-y-1">
          {teamChannels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg m-2">
              No team chats found.{canCreate ? " Click the + above to create one." : ""}
            </div>
          ) : teamChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>

        <TabsContent value="direct" className="m-0 space-y-1">
          <Button
            className="w-full mb-3 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            variant="ghost"
            onClick={() => setShowNewDm(true)}
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" /> New Direct Message
          </Button>
          {directChannels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg m-2">
              No direct messages yet.
            </div>
          ) : [...directChannels]
              .sort((a, b) => (b.pinned_role ? 1 : 0) - (a.pinned_role ? 1 : 0))
              .map(ch => <ChannelBtn key={ch.id} ch={ch} pinned={!!ch.pinned_role} />)}
        </TabsContent>

        <TabsContent value="carpool" className="m-0 space-y-1">
          {carpoolChannels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg m-2">
              No carpool channels yet.
            </div>
          ) : carpoolChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>

        <TabsContent value="announce" className="m-0 space-y-1">
          {announceChannels.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg m-2">
              No news yet.
            </div>
          ) : announceChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>
      </div>

      {/* NewDM Dialog */}
      <NewDmDialog
        open={showNewDm}
        onOpenChange={setShowNewDm}
        currentUser={currentUser}
        onChannelCreated={(id) => { select(id); }}
      />

      {/* 3. Create Channel Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Channel</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Channel Type</label>
              <Select
                value={newChannelForm.type}
                onValueChange={val => setNewChannelForm(prev => ({ ...prev, type: val, name: "", team_id: "" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">🛡️ Team</SelectItem>
                  <SelectItem value="announcement">📢 News</SelectItem>
                  <SelectItem value="carpool">🚗 Carpool</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newChannelForm.type === "team" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Select Team</label>
                <Select
                  value={newChannelForm.team_id}
                  onValueChange={val => {
                    const team = orgTeams.find(t => t.id === val);
                    setNewChannelForm(prev => ({ ...prev, team_id: team.id, name: team.name }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgTeams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Channel Name</label>
                <Input
                  value={newChannelForm.name}
                  onChange={e => setNewChannelForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Game Day Announcements"
                  required
                />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !newChannelForm.name.trim()}
              >
                {createMutation.isPending ? "Creating…" : "Create Channel"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}