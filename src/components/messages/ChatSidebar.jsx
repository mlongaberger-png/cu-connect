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
import { Plus, Hash, MessageSquare, Car, Crown, MessageSquarePlus, EyeOff, Eye } from "lucide-react";
import { formatDistanceToNowStrict, isToday, isYesterday, format } from "date-fns";
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
  const [hiddenChannels, setHiddenChannels] = useState(() => JSON.parse(localStorage.getItem("cu_hidden_channels") || "[]"));
  const [showHiddenRecords, setShowHiddenRecords] = useState(false);

  const toggleHideChannel = (id, e) => {
    e.stopPropagation();
    const updated = hiddenChannels.includes(id)
      ? hiddenChannels.filter(cid => cid !== id)
      : [...hiddenChannels, id];
    setHiddenChannels(updated);
    localStorage.setItem("cu_hidden_channels", JSON.stringify(updated));
  };

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
    refetchInterval: 5000,
  });

  // Only count unreads for channels that actually exist and are visible
  const visibleChannelIds = new Set(allChannels.map(ch => ch.id));
  const unreadMap = myMemberships.reduce((acc, m) => {
    if (m.unread_count > 0 && visibleChannelIds.has(m.channel_id)) {
      acc[m.channel_id] = m.unread_count;
    }
    return acc;
  }, {});

  const resetUnreadMutation = useMutation({
    mutationFn: (channelId) => {
      const membership = myMemberships.find(m => m.channel_id === channelId);
      if (membership && membership.unread_count > 0) {
        return base44.entities.ChannelMember.update(membership.id, { unread_count: 0 });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channel-members"] }),
  });

  const select = (id) => {
    setSearchParams({ channelId: id });
    resetUnreadMutation.mutate(id);
  };

  // Filter channels by type
  const userEmail = currentUser?.email;
  const teamChannels = allChannels.filter(ch => ch.type === "team");
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

  const formatLastMessageTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return "Yesterday";
    return format(d, "MMM d");
  };

  const ChannelBtn = ({ ch, pinned }) => {
    const isActive = ch.id === activeChannelId;
    const unread = unreadMap[ch.id] || 0;
    const isHidden = hiddenChannels.includes(ch.id);
    const linkedTeam = (ch.type === "team" || ch.type === "announcement") && ch.team_id
      ? orgTeams.find(t => t.id === ch.team_id)
      : null;
    const teamAvatarUrl = linkedTeam?.avatar_url || ch.avatar_url;
    const teamAvatarType = linkedTeam?.avatar_type;
    const lastTime = formatLastMessageTime(ch.last_message_at);
    const preview = ch.last_message_preview || "";

    return (
      <button
        onClick={() => select(ch.id)}
        className={`group w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors
          ${isActive ? "bg-primary/15" : "hover:bg-surface"}
          ${isHidden ? "opacity-50" : ""}`}
      >
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full overflow-hidden bg-surface flex items-center justify-center shrink-0 border border-border/50">
          {teamAvatarUrl ? (
            <img src={teamAvatarUrl} alt="" className="w-full h-full object-cover" />
          ) : linkedTeam ? (
            <span className="text-xl">{getTeamAvatarEmoji(teamAvatarType, linkedTeam?.sport_name)}</span>
          ) : pinned ? (
            <Crown className="w-5 h-5 text-yellow-400" />
          ) : ch.type === "carpool" ? (
            <Car className="w-5 h-5 text-primary" />
          ) : (
            <Hash className="w-5 h-5 text-primary" />
          )}
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${unread > 0 ? "font-bold text-foreground" : isActive ? "font-semibold text-primary" : "font-medium text-foreground"}`}>
              {ch.name || "Unnamed"}
            </span>
            <span className="text-[11px] text-muted-foreground shrink-0">{lastTime}</span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <span className={`text-xs truncate ${unread > 0 ? "text-foreground/80" : "text-muted-foreground"}`}>
              {preview || <span className="italic opacity-50">No messages yet</span>}
            </span>
            {unread > 0 && (
              <span className="shrink-0 bg-primary text-primary-foreground text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>

        {/* Hide/unhide on hover */}
        <span
          onClick={(e) => toggleHideChannel(ch.id, e)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background shrink-0"
          title={isHidden ? "Unhide" : "Hide"}
        >
          {isHidden
            ? <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </span>
      </button>
    );
  };

  return (
    <Tabs defaultValue="teams" className="h-full flex flex-col bg-card overflow-hidden">

      <div className="flex-shrink-0 border-b border-border bg-card z-20 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Messages
            {Object.values(unreadMap).reduce((a, b) => a + b, 0) > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center">
                {Object.values(unreadMap).reduce((a, b) => a + b, 0) > 99 ? "99+" : Object.values(unreadMap).reduce((a, b) => a + b, 0)}
              </span>
            )}
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
            <TabsTrigger value="direct">💬 DMs</TabsTrigger>
            <TabsTrigger value="carpool">🚗 Carpool</TabsTrigger>
            <TabsTrigger value="announce">📢 News</TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col">
        <div className="flex-1">
          <TabsContent value="teams" className="m-0 space-y-1">
            {teamChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No team channels yet</p>
            ) : (
              teamChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).map(ch => <ChannelBtn key={ch.id} ch={ch} />)
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
            {directChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No direct messages yet</p>
            ) : (
              directChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).map(ch => <ChannelBtn key={ch.id} ch={ch} />)
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
            {carpoolChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No carpool channels yet</p>
            ) : (
              carpoolChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).map(ch => <ChannelBtn key={ch.id} ch={ch} />)
            )}
          </TabsContent>

          <TabsContent value="announce" className="m-0 space-y-1">
            {announceChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <p className="text-xs text-muted-foreground px-3 py-4 text-center">No announcement channels yet</p>
            ) : (
              announceChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).map(ch => <ChannelBtn key={ch.id} ch={ch} />)
            )}
          </TabsContent>
        </div>

        {/* Manage hidden channels */}
        <div className="pt-2 border-t border-border mt-2">
          <Button
            variant="link"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowHiddenRecords(!showHiddenRecords)}
          >
            {showHiddenRecords ? "Hide Archived Lists" : `Manage Hidden Channels (${hiddenChannels.length})`}
          </Button>
        </div>
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

      <CarpoolRequestModal
        open={showCarpoolRequest}
        onOpenChange={setShowCarpoolRequest}
        currentUser={currentUser}
        myTeamIds={orgTeams.map(t => t.id)}
        myTeams={orgTeams}
      />
      <NewDmDialog open={showNewDm} onOpenChange={setShowNewDm} currentUser={currentUser} />
    </Tabs>
  );
}