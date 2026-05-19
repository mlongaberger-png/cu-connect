import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Hash, MessageSquare, Car, Crown, MessageSquarePlus, Users, MessageCircle, Megaphone } from "lucide-react";
import { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";
import NewDmDialog from "@/components/messages/NewDmDialog";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";

export default function ChatSidebar({ activeChannelId }) {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showCarpoolRequest, setShowCarpoolRequest] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: "", type: "team", team_id: "" });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const canCreate = currentUser?.role === "admin" || currentUser?.role === "athletic_director";

  const { data: orgTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!currentUser,
  });

  const { data: allChannels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => base44.entities.Channel.list("-last_message_at"),
    enabled: !!currentUser,
  });

  // Fetch unread counts for current user
  const { data: myMemberships = [] } = useQuery({
    queryKey: ["channel-members", user?.email],
    queryFn: () => base44.entities.ChannelMember.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const unreadMap = myMemberships.reduce((acc, m) => {
    if (m.unread_count > 0) acc[m.channel_id] = m.unread_count;
    return acc;
  }, {});

  const resetUnreadMutation = useMutation({
    mutationFn: async (channelId) => {
      const membership = myMemberships.find(m => m.channel_id === channelId);
      if (membership && membership.unread_count > 0) {
        await base44.entities.ChannelMember.update(membership.id, { unread_count: 0 });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channel-members", user?.email] }),
  });

  const select = (id) => {
    setSearchParams({ channelId: id });
    resetUnreadMutation.mutate(id);
  };

  // Filter channels by type
  const userEmail = currentUser?.email;
  const teamChannels = allChannels.filter(ch => ch.type === "team" || ch.type === "announcement");
  const directChannels = allChannels.filter(ch => {
    if (ch.type !== "direct") return false;
    try {
      const members = JSON.parse(ch.member_emails || "[]");
      return members.includes(userEmail);
    } catch { return false; }
  });
  const carpoolChannels = allChannels.filter(ch => ch.type === "carpool");
  const announceChannels = allChannels.filter(ch => ch.type === "announcement");

  const createChannelMutation = useMutation({
    mutationFn: (data) => base44.entities.Channel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setShowCreate(false);
      setNewChannelForm({ name: "", type: "team", team_id: "" });
    },
  });

  const handleCreateChannel = () => {
    if (!newChannelForm.name.trim()) return;
    createChannelMutation.mutate({
      name: newChannelForm.name.trim(),
      type: newChannelForm.type,
      team_id: newChannelForm.team_id || undefined,
    });
  };

  const ChannelBtn = ({ ch, pinned }) => {
    const isActive = ch.id === activeChannelId;
    const unread = unreadMap[ch.id] || 0;
    const linkedTeam = (ch.type === "team" || ch.type === "announcement") && ch.team_id
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
          ) : ch.type === "carpool" ? (
            <Car className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Hash className="w-3.5 h-3.5 text-primary" />
          )}
        </div>
        <span className="truncate text-sm flex-1">{ch.name || "Unnamed"}</span>
        {pinned && !unread && <Crown className="w-3 h-3 text-yellow-400 ml-auto shrink-0" />}
        {unread > 0 && (
          <span className="ml-auto shrink-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    );
  };

  return (
    <Tabs defaultValue="teams" className="h-full flex flex-col bg-card overflow-hidden">

      <div className="flex-shrink-0 border-b border-border bg-card z-20 shadow-sm">
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
            <TabsTrigger value="teams" className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Teams
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" /> DMs
            </TabsTrigger>
            <TabsTrigger value="carpool" className="flex items-center gap-1">
              <Car className="w-3.5 h-3.5" /> Carpool
            </TabsTrigger>
            <TabsTrigger value="announce" className="flex items-center gap-1">
              <Megaphone className="w-3.5 h-3.5" /> News
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <TabsContent value="teams" className="m-0 space-y-1">
          {teamChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No team channels yet</p>
          ) : (
            teamChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)
          )}
        </TabsContent>

        <TabsContent value="direct" className="m-0 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-primary mb-1 hover:bg-primary/10"
            onClick={() => setShowNewDm(true)}
          >
            <MessageSquarePlus className="w-4 h-4" /> New Direct Message
          </Button>
          {directChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No direct messages yet</p>
          ) : (
            directChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)
          )}
        </TabsContent>

        <TabsContent value="carpool" className="m-0 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-primary mb-1 hover:bg-primary/10"
            onClick={() => setShowCarpoolRequest(true)}
          >
            <Car className="w-4 h-4" /> Request a Ride
          </Button>
          {carpoolChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No carpool channels yet</p>
          ) : (
            carpoolChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)
          )}
        </TabsContent>

        <TabsContent value="announce" className="m-0 space-y-1">
          {announceChannels.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No announcement channels yet</p>
          ) : (
            announceChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)
          )}
        </TabsContent>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Channel name"
              value={newChannelForm.name}
              onChange={e => setNewChannelForm(f => ({ ...f, name: e.target.value }))}
            />
            <Select
              value={newChannelForm.type}
              onValueChange={v => setNewChannelForm(f => ({ ...f, type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="carpool">Carpool</SelectItem>
                <SelectItem value="announcement">Announcement</SelectItem>
              </SelectContent>
            </Select>
            {(newChannelForm.type === "team" || newChannelForm.type === "announcement") && (
              <Select
                value={newChannelForm.team_id}
                onValueChange={v => setNewChannelForm(f => ({ ...f, team_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Link to team (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {orgTeams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreateChannel} disabled={createChannelMutation.isPending}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CarpoolRequestModal open={showCarpoolRequest} onOpenChange={setShowCarpoolRequest} currentUser={currentUser} />
      <NewDmDialog open={showNewDm} onOpenChange={setShowNewDm} currentUser={currentUser} />
    </Tabs>
  );
}