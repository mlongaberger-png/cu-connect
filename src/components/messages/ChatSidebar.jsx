import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Hash, MessageSquare, Car, Crown, MessageSquarePlus, EyeOff, Eye, Trash2, Users, Newspaper } from "lucide-react";
import { formatDistanceToNowStrict, isToday, isYesterday, format } from "date-fns";
import { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";
import MultiTeamSelect from "@/components/messages/MultiTeamSelect";
import EmptyChannelState from "@/components/messages/EmptyChannelState";
import NewDmDialog from "@/components/messages/NewDmDialog";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";
import { useToast } from "@/components/ui/use-toast";

export default function ChatSidebar({ activeChannelId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "teams";
  const handleTabChange = (value) => {
    setSearchParams(prev => { prev.set("tab", value); return prev; });
  };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showCarpoolRequest, setShowCarpoolRequest] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: "", type: "team", team_id: "" });
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
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

  // Unread schedule events since user last viewed schedule
  const { data: unreadScheduleEvents = [] } = useQuery({
    queryKey: ["unread-schedule", currentUser?.last_viewed_schedule],
    queryFn: () => base44.entities.Event.list("-created_date", 100),
    enabled: !!currentUser && currentUser.allow_schedule_notifications !== false,
    select: (events) => {
      const since = currentUser?.last_viewed_schedule
        ? new Date(currentUser.last_viewed_schedule)
        : null;
      if (!since) return [];
      return events.filter(e => new Date(e.created_date) > since);
    },
    refetchInterval: 30000,
  });

  const unreadScheduleCount = unreadScheduleEvents.length;

  const canCreate = ["admin", "athletic_director", "coach"].includes(currentUser?.role);
  const isAdmin = currentUser?.role === "admin";

  const { data: orgTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!user,
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
    refetchInterval: () => document.visibilityState === 'hidden' ? false : 30000,
  });

  // Only count unreads for channels that actually exist and are visible
  const visibleChannelIds = new Set(allChannels.map(ch => ch.id));
  const unreadMap = myMemberships.reduce((acc, m) => {
    if (m.unread_count > 0 && visibleChannelIds.has(m.channel_id)) {
      acc[m.channel_id] = m.unread_count;
    }
    return acc;
  }, {});

  // Combined app icon badge effect
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    const messageTotal = Object.values(unreadMap).reduce((a, b) => a + b, 0);
    const scheduleTotal = currentUser?.allow_schedule_notifications !== false ? unreadScheduleCount : 0;
    const finalBadgeCount = messageTotal + scheduleTotal;
    if (finalBadgeCount > 0) {
      navigator.setAppBadge(finalBadgeCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [unreadMap, unreadScheduleCount, currentUser?.allow_schedule_notifications]);

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
    setSearchParams(prev => { prev.set("channelId", id); return prev; });
    resetUnreadMutation.mutate(id);
  };

  // Build a Set of channel IDs the current user is a member of
  const myChannelIds = new Set((myMemberships || []).map(m => m.channel_id));

  // Filter channels by type — only show channels the user is a member of
  const userEmail = currentUser?.email;
  const teamChannels = allChannels.filter(ch => ch.type === "team" && myChannelIds.has(ch.id));
  const directChannels = allChannels.filter(ch => {
    if (ch.type !== "direct") return false;
    if (!myChannelIds.has(ch.id)) return false;
    try {
      const members = JSON.parse(ch.member_emails || "[]");
      return members.includes(userEmail);
    } catch { return false; }
  });
  const carpoolChannels = allChannels.filter(ch => ch.type === "carpool" && myChannelIds.has(ch.id));
  const announceChannels = allChannels.filter(ch => ch.type === "announcement" && myChannelIds.has(ch.id));

  const { toast } = useToast();

  const createChannelMutation = useMutation({
    mutationFn: async (data) => {
      if (Array.isArray(data)) {
        return Promise.all(data.map(ch => base44.entities.Channel.create(ch)));
      }
      return base44.entities.Channel.create(data);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      setShowCreate(false);
      setNewChannelForm({ name: "", type: "team", team_id: "" });
      setSelectedTeamIds([]);
      const count = Array.isArray(variables) ? variables.length : 1;
      toast({ title: `${count} channel${count > 1 ? "s" : ""} created successfully` });
    },
    onError: (error) => {
      toast({ title: "Failed to create channel. Please try again.", description: error?.message, variant: "destructive" });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: (channelId) => base44.entities.Channel.delete(channelId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channels"] }),
  });

  const handleCreateChannel = () => {
    if (!newChannelForm.name.trim()) return;
    const name = newChannelForm.name.trim();
    const type = newChannelForm.type;

    if (selectedTeamIds.length > 0) {
      // Create one channel per selected team
      const channels = selectedTeamIds.map(id => {
        const team = orgTeams.find(t => t.id === id);
        return { name, type, team_id: id };
      });
      createChannelMutation.mutate(channels);
    } else {
      createChannelMutation.mutate({
        name,
        type,
        team_id: newChannelForm.team_id || undefined,
      });
    }
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
              {preview || <span>No messages yet</span>}
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
          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150 p-1 rounded hover:bg-background shrink-0"
          title={isHidden ? "Unhide" : "Hide"}
        >
          {isHidden
            ? <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </span>

        {/* Admin delete */}
        {isAdmin && ch.type !== "direct" && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${ch.name}"? This cannot be undone.`)) {
                deleteChannelMutation.mutate(ch.id);
              }
            }}
            className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150 p-1 rounded hover:bg-red-500/10 shrink-0"
            title="Delete channel"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </span>
        )}
      </button>
    );
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col bg-card overflow-hidden">

      <div className="flex-shrink-0 border-b border-border bg-card relative z-[60] shadow-sm">
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

      <div className="flex-1 overflow-y-auto p-2 flex flex-col" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 8px)' }}>
        <div className="flex-1">
          <TabsContent value="teams" className="m-0 space-y-1">
            {teamChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <EmptyChannelState icon={Users} message="No team channels yet" />
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
              <EmptyChannelState icon={MessageSquare} message="No direct messages yet" ctaLabel="New Direct Message" onCta={() => setShowNewDm(true)} />
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
              <EmptyChannelState icon={Car} message="No carpool channels yet" ctaLabel="Request a Ride" onCta={() => setShowCarpoolRequest(true)} />
            ) : (
              carpoolChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).map(ch => <ChannelBtn key={ch.id} ch={ch} />)
            )}
          </TabsContent>

          <TabsContent value="announce" className="m-0 space-y-1">
            {announceChannels.filter(ch => showHiddenRecords || !hiddenChannels.includes(ch.id)).length === 0 ? (
              <EmptyChannelState icon={Newspaper} message="No news posts yet" />
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
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) setSelectedTeamIds([]); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Channel name (e.g. Lions - Fall 2026)"
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
                <SelectItem value="team">🛡️ Team Chat</SelectItem>
                <SelectItem value="announcement">📢 Announcements</SelectItem>
                {(currentUser?.role === "admin" || currentUser?.role === "athletic_director") && (
                  <SelectItem value="carpool">🚗 Carpool</SelectItem>
                )}
              </SelectContent>
            </Select>
            {(newChannelForm.type === "team" || newChannelForm.type === "announcement") && (
              <MultiTeamSelect
                teams={orgTeams}
                selectedIds={selectedTeamIds}
                onChange={setSelectedTeamIds}
                placeholder="Link to teams (optional)"
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreateChannel} disabled={createChannelMutation.isPending}>
                {createChannelMutation.isPending
                  ? "Creating…"
                  : selectedTeamIds.length > 1
                    ? `Create (${selectedTeamIds.length})`
                    : "Create"}
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