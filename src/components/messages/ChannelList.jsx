import React, { useEffect, useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, CheckCircle2, Lock, Globe, Star, Loader2, MoreVertical, Pencil } from "lucide-react";
import ChannelEditModal from "@/components/messages/ChannelEditModal";

function getLastRead(channelId) {
  try { return parseInt(localStorage.getItem(`msg_read_${channelId}`) || "0", 10); } catch { return 0; }
}

export default function ChannelList({ sports: sportsProp, teams: teamsProp, filterTeamIds, userRole, userEmail, activeChannelId, onSelectChannel }) {
  const [starredChats, setStarredChats] = useState({});
  const [userId, setUserId] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null); // full channel object for modal
  const [contextMenuFor, setContextMenuFor] = useState(null);
  const queryClient = useQueryClient();

  const isAdmin = userRole === "admin";
  const isAthlDir = userRole === "athletic_director";
  const isCoach = userRole === "coach";
  const isParent = userRole === "parent" || userRole === "user";
  const canEditChannels = isAdmin;

  // Always fetch fresh data internally so icon changes reflect immediately
  const { data: freshSports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
    staleTime: 0,
  });
  const { data: freshTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    staleTime: 0,
  });
  // Use internal fresh data if available, fall back to props
  const sports = freshSports.length > 0 ? freshSports : sportsProp;
  const teams = freshTeams.length > 0 ? freshTeams : teamsProp;

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) return;
      setUserId(u.id);
      base44.entities.UserChatPreference.filter({ user_id: u.id, is_starred: true }).then(prefs => {
        const map = {};
        prefs.forEach(p => { map[p.chat_id] = p.id; });
        setStarredChats(map);
      });
    }).catch(() => {});
  }, []);

  const { data: allRooms = [] } = useQuery({
    queryKey: ["message-rooms"],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }),
    staleTime: 0,
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: ["messages-recent-all"],
    queryFn: () => base44.entities.Message.list("-created_date", 200),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });

  // ── Visibility rules by role ──────────────────────────────────────────────
  const visibleTeams = useMemo(() => {
    if (filterTeamIds) return teams.filter(t => filterTeamIds.includes(t.id));
    if (isCoach) return teams.filter(t => t.coach_email?.toLowerCase() === userEmail?.toLowerCase());
    return teams;
  }, [teams, filterTeamIds, isCoach, userEmail]);

  const visibleRooms = useMemo(() => {
    // Build the set of team IDs this user belongs to (for parent team-based room access)
    const myTeamIds = new Set((filterTeamIds || visibleTeams.map(t => t.id)));

    return allRooms.filter(room => {
      // Check team-based access first (works for parents)
      if (room.allowed_team_ids) {
        try {
          const tids = JSON.parse(room.allowed_team_ids);
          if (Array.isArray(tids) && tids.some(tid => myTeamIds.has(tid))) return true;
        } catch {}
      }
      if (!room.is_private) {
        // Public rooms: staff always; parents only if they have team access (covered above) or no team filter
        if (!isParent) return true;
        return false; // parents only see public rooms if they have team membership (handled above)
      }
      if (room.allowed_roles) {
        try { if (JSON.parse(room.allowed_roles).includes(userRole)) return true; } catch {}
      }
      if (room.allowed_emails) {
        try { if (JSON.parse(room.allowed_emails).includes(userEmail)) return true; } catch {}
      }
      return isAdmin || room.created_by === userEmail;
    });
  }, [allRooms, userRole, userEmail, isAdmin, isParent, filterTeamIds, visibleTeams]);

  const allChannels = useMemo(() => {
    const channels = [];

    // Team channels: everyone sees their relevant teams
    visibleTeams.forEach(t => channels.push({
      id: t.id,
      name: t.name,
      type: "team",
      icon: t.icon || null,
      canEditIcon: isAdmin,
    }));

    // Rooms: staff always see all; parents see rooms they have access to
    visibleRooms.forEach(r => channels.push({
      id: r.id,
      name: r.name,
      type: "room",
      icon: r.icon || null,
      isPrivate: r.is_private,
      canEditIcon: isAdmin,
    }));

    return channels.map(ch => {
      const chMsgs = recentMessages.filter(m => m.channel_id === ch.id || (ch.id === "org" && m.channel === "org"));
      const lastMsgTime = chMsgs.length > 0 ? new Date(chMsgs[0].created_date).getTime() : 0;
      const lastRead = getLastRead(ch.id);
      const unread = chMsgs.filter(m => new Date(m.created_date).getTime() > lastRead && m.sender_email !== userEmail).length;
      return { ...ch, unread, lastMsgTime };
    }).sort((a, b) => {
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      return b.lastMsgTime - a.lastMsgTime;
    });
  }, [sports, visibleTeams, visibleRooms, recentMessages, userEmail, isAdmin, isAthlDir, isParent]);

  const starredIds = new Set(Object.keys(starredChats));
  const starredChannels = allChannels.filter(c => starredIds.has(c.id));
  const otherChannels = allChannels.filter(c => !starredIds.has(c.id));

  const renderChannel = (ch) => {
    const isActive = ch.id === activeChannelId;
    const iconIsUrl = ch.icon && (ch.icon.startsWith("http://") || ch.icon.startsWith("https://"));

    return (
      <div key={ch.id} className={`relative border-b border-border/50 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-surface"} group`}>
        <button
          onClick={() => onSelectChannel(ch.type, ch.id, ch.name)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        >
          {/* Icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${ch.unread > 0 ? "bg-primary/20" : "bg-surface"}`}>
            {iconIsUrl ? (
              <img src={ch.icon} alt="" className="w-full h-full object-cover" />
            ) : ch.icon ? (
              <span className="text-lg leading-none">{ch.icon}</span>
            ) : ch.type === "room" ? (
              ch.isPrivate ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />
            ) : (
              <MessageSquare className={`w-4 h-4 ${ch.unread > 0 ? "text-primary" : "text-muted-foreground"}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm truncate ${ch.unread > 0 ? "font-semibold text-foreground" : isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {ch.name}
            </p>
            {ch.lastMsgTime > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(ch.lastMsgTime)}</p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center gap-1.5">
            {starredIds.has(ch.id) && <Star className="w-3 h-3 fill-primary text-primary opacity-60" />}
            {ch.unread > 0 ? (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {ch.unread > 99 ? "99+" : ch.unread}
              </span>
            ) : isActive ? (
              <CheckCircle2 className="w-4 h-4 text-green-500/60" />
            ) : null}
          </div>
        </button>

        {/* Admin edit button — teams, sports, and rooms */}
        {canEditChannels && (ch.type === "room" || ch.type === "team" || ch.type === "sport") && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); setEditingChannel(ch); }}
              className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-primary transition-colors"
              title="Edit channel"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {starredChannels.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-primary text-primary" /> Starred
          </p>
          {starredChannels.map(renderChannel)}
        </div>
      )}
      <div>
        {starredChannels.length > 0 && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">All Channels</p>
        )}
        {otherChannels.map(renderChannel)}
      </div>
      {allChannels.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No channels available</p>
        </div>
      )}

      {/* Full edit modal */}
      <ChannelEditModal
        channel={editingChannel}
        open={!!editingChannel}
        onOpenChange={(open) => { if (!open) setEditingChannel(null); }}
        onDeleted={() => setEditingChannel(null)}
      />
    </div>
  );
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}