import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, CheckCircle2, Lock, Globe, Star } from "lucide-react";

function getLastRead(channelId) {
  try { return parseInt(localStorage.getItem(`msg_read_${channelId}`) || "0", 10); } catch { return 0; }
}

export default function ChannelList({ sports, teams, filterTeamIds, userRole, userEmail, activeChannelId, onSelectChannel }) {
  const [starredChats, setStarredChats] = useState({});
  const [userId, setUserId] = useState(null);

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
  });

  // Fetch recent messages for all channels to compute unread counts + last activity
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["messages-recent-all"],
    queryFn: () => base44.entities.Message.list("-created_date", 200),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });

  const visibleTeams = filterTeamIds ? teams.filter(t => filterTeamIds.includes(t.id)) : teams;

  const visibleRooms = allRooms.filter(room => {
    if (!room.is_private) return true;
    if (room.allowed_roles) {
      try { if (JSON.parse(room.allowed_roles).includes(userRole)) return true; } catch { }
    }
    if (room.allowed_emails) {
      try { if (JSON.parse(room.allowed_emails).includes(userEmail)) return true; } catch { }
    }
    return userRole === "admin" || room.created_by === userEmail;
  });

  const allChannels = useMemo(() => {
    const channels = [
      { id: "org", name: "Organization", type: "org", icon: null },
      ...sports.map(s => ({ id: s.id, name: s.name, type: "sport", icon: s.icon })),
      ...visibleTeams.map(t => ({ id: t.id, name: t.name, type: "team", icon: null })),
      ...visibleRooms.map(r => ({ id: r.id, name: r.name, type: "room", icon: null, isPrivate: r.is_private })),
    ];

    // Compute unread count and last message time per channel
    return channels.map(ch => {
      const chMsgs = recentMessages.filter(m => m.channel_id === ch.id || (ch.id === "org" && m.channel === "org"));
      const lastMsgTime = chMsgs.length > 0 ? new Date(chMsgs[0].created_date).getTime() : 0;
      const lastRead = getLastRead(ch.id);
      const unread = chMsgs.filter(m => new Date(m.created_date).getTime() > lastRead && m.sender_email !== userEmail).length;
      return { ...ch, unread, lastMsgTime };
    }).sort((a, b) => {
      // Unread first, then by recency
      if (a.unread > 0 && b.unread === 0) return -1;
      if (b.unread > 0 && a.unread === 0) return 1;
      return b.lastMsgTime - a.lastMsgTime;
    });
  }, [sports, visibleTeams, visibleRooms, recentMessages, userEmail]);

  const starredIds = new Set(Object.keys(starredChats));
  const starredChannels = allChannels.filter(c => starredIds.has(c.id));
  const otherChannels = allChannels.filter(c => !starredIds.has(c.id));

  const renderChannel = (ch) => {
    const isActive = ch.id === activeChannelId;
    return (
      <button
        key={ch.id}
        onClick={() => onSelectChannel(ch.type, ch.id, ch.name)}
        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-border/50 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-surface active:bg-surface"}`}
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ch.unread > 0 ? "bg-primary/20" : "bg-surface"}`}>
          {ch.icon
            ? <span className="text-lg leading-none">{ch.icon}</span>
            : ch.type === "room"
              ? ch.isPrivate ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />
              : <MessageSquare className={`w-4 h-4 ${ch.unread > 0 ? "text-primary" : "text-muted-foreground"}`} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${ch.unread > 0 ? "font-semibold text-foreground" : isActive ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {ch.name}
          </p>
          {ch.lastMsgTime > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatRelative(ch.lastMsgTime)}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {starredIds.has(ch.id) && <Star className="w-3 h-3 fill-primary text-primary opacity-60" />}
          {ch.unread > 0 ? (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
              {ch.unread > 99 ? "99+" : ch.unread}
            </span>
          ) : ch.id === activeChannelId ? (
            <CheckCircle2 className="w-4 h-4 text-green-500/60" />
          ) : null}
        </div>
      </button>
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