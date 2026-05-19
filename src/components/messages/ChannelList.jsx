import React, { useEffect, useRef, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, CheckCircle2, Lock, Globe, Star, ImagePlus, Loader2, Trash2, MoreVertical } from "lucide-react";

const ICON_OPTIONS = [
  { group: "Sports", icons: ["⚽", "🏀", "🏈", "⚾", "🥎", "🏐", "🏉", "🎾", "🏊", "🏋️", "🤸", "🏇", "⛷️", "🏌️", "🥊", "🏒", "🎿", "🏑", "🥅", "🏟️"] },
  { group: "Volunteer & Events", icons: ["🙋", "🤝", "🎽", "📋", "🧢", "🍕", "🥤", "🍉", "🍪", "🎉", "📣", "🚗", "🏕️", "🎪", "📸", "🎤", "🎯", "🗓️", "📢", "💪"] },
  { group: "General", icons: ["⭐", "🔥", "💬", "📌", "🏆", "🎖️", "👋", "🌟", "💡", "📣", "🔔", "✅", "🎁", "🛡️", "🦁", "🌊", "❤️", "🤩", "👏", "🙌"] },
];

function getLastRead(channelId) {
  try { return parseInt(localStorage.getItem(`msg_read_${channelId}`) || "0", 10); } catch { return 0; }
}

export default function ChannelList({ sports, teams, filterTeamIds, userRole, userEmail, activeChannelId, onSelectChannel }) {
  const [starredChats, setStarredChats] = useState({});
  const [userId, setUserId] = useState(null);
  const [iconPickerFor, setIconPickerFor] = useState(null);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [contextMenuFor, setContextMenuFor] = useState(null);
  const fileInputRef = useRef();
  const pendingUploadChannel = useRef(null);
  const queryClient = useQueryClient();

  const isAdmin = userRole === "admin";
  const isAthlDir = userRole === "athletic_director";
  const isCoach = userRole === "coach";
  const isParent = userRole === "parent" || userRole === "user";
  // Only admins can edit icons/names
  const canEditChannels = isAdmin;

  const deleteRoomMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageRoom.update(id, { is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-rooms"] }),
  });

  const updateIconMutation = useMutation({
    mutationFn: ({ type, id, icon }) => {
      if (type === "room") return base44.entities.MessageRoom.update(id, { icon });
      if (type === "sport") return base44.entities.Sport.update(id, { icon });
      if (type === "team") return base44.entities.Team.update(id, { icon });
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setIconPickerFor(null);
    },
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadChannel.current) return;
    const ch = pendingUploadChannel.current;
    setUploadingFor(ch.id);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      updateIconMutation.mutate({ type: ch.type, id: ch.id, icon: file_url });
    } finally {
      setUploadingFor(null);
      pendingUploadChannel.current = null;
      e.target.value = "";
    }
  };

  const triggerPhotoUpload = (ch) => {
    pendingUploadChannel.current = ch;
    setIconPickerFor(null);
    // Small delay so the picker closes before triggering the file dialog
    setTimeout(() => fileInputRef.current?.click(), 80);
  };

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
    staleTime: 15000,
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

  const visibleRooms = useMemo(() => allRooms.filter(room => {
    if (!room.is_private) return true;
    if (room.allowed_roles) {
      try { if (JSON.parse(room.allowed_roles).includes(userRole)) return true; } catch { }
    }
    if (room.allowed_emails) {
      try { if (JSON.parse(room.allowed_emails).includes(userEmail)) return true; } catch { }
    }
    return isAdmin || room.created_by === userEmail;
  }), [allRooms, userRole, userEmail, isAdmin]);

  const allChannels = useMemo(() => {
    const channels = [];

    // Org + sport channels: only for admins/athletic directors
    if (isAdmin || isAthlDir) {
      channels.push({ id: "org", name: "Organization", type: "org", icon: null, canEditIcon: false });
      sports.forEach(s => channels.push({ id: s.id, name: s.name, type: "sport", icon: s.icon, canEditIcon: isAdmin }));
    }

    // Team channels: everyone sees their relevant teams
    visibleTeams.forEach(t => channels.push({
      id: t.id,
      name: t.name,
      type: "team",
      icon: t.icon || null,
      canEditIcon: isAdmin,
    }));

    // Rooms: not shown to parents (only org admins/AD create official rooms)
    if (!isParent) {
      visibleRooms.forEach(r => channels.push({
        id: r.id,
        name: r.name,
        type: "room",
        icon: r.icon || null,
        isPrivate: r.is_private,
        canEditIcon: isAdmin,
      }));
    }

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
    const showPicker = iconPickerFor === ch.id;
    const isUploading = uploadingFor === ch.id;

    // Determine if icon is a URL (uploaded image) vs emoji
    const iconIsUrl = ch.icon && (ch.icon.startsWith("http://") || ch.icon.startsWith("https://"));

    return (
      <div key={ch.id} className={`relative border-b border-border/50 last:border-0 ${isActive ? "bg-primary/10" : "hover:bg-surface"} group`}>
        <button
          onClick={() => onSelectChannel(ch.type, ch.id, ch.name)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        >
          {/* Icon */}
          <div
            onClick={ch.canEditIcon ? (e) => { e.stopPropagation(); setIconPickerFor(showPicker ? null : ch.id); } : undefined}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden transition-colors ${ch.unread > 0 ? "bg-primary/20" : "bg-surface"} ${ch.canEditIcon ? "cursor-pointer hover:bg-primary/30 hover:ring-1 hover:ring-primary/40" : ""}`}
            title={ch.canEditIcon ? "Change icon" : undefined}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : iconIsUrl ? (
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
            ) : ch.id === activeChannelId ? (
              <CheckCircle2 className="w-4 h-4 text-green-500/60" />
            ) : null}
          </div>
        </button>

        {/* Admin context menu for rooms */}
        {canEditChannels && ch.type === "room" && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); setContextMenuFor(contextMenuFor === ch.id ? null : ch.id); }}
              className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {contextMenuFor === ch.id && (
              <div
                className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl py-1 min-w-[130px] z-50"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => { triggerPhotoUpload(ch); setContextMenuFor(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Upload Photo
                </button>
                <button
                  onClick={() => { setIconPickerFor(ch.id); setContextMenuFor(null); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface transition-colors"
                >
                  <span className="text-base leading-none">😀</span> Change Emoji
                </button>
                {ch.icon && (
                  <button
                    onClick={() => { updateIconMutation.mutate({ type: ch.type, id: ch.id, icon: "" }); setContextMenuFor(null); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-surface transition-colors"
                  >
                    Remove Icon
                  </button>
                )}
                <div className="h-px bg-border my-1" />
                <button
                  onClick={() => {
                    if (confirm(`Delete room "${ch.name}"? This cannot be undone.`)) {
                      deleteRoomMutation.mutate(ch.id);
                      setContextMenuFor(null);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Room
                </button>
              </div>
            )}
          </div>
        )}

        {/* Inline icon picker — admin only */}
        {showPicker && ch.canEditIcon && (
          <div
            className="absolute left-2 right-2 z-50 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-3 max-h-64 overflow-y-auto"
            style={{ top: "calc(100% - 4px)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-foreground">Pick an icon</p>
              <div className="flex items-center gap-2">
                {/* Photo upload button */}
                <button
                  onClick={(e) => { e.stopPropagation(); triggerPhotoUpload(ch); }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                  <ImagePlus className="w-3 h-3" /> Upload Photo
                </button>
                {ch.icon && (
                  <button
                    onClick={() => updateIconMutation.mutate({ type: ch.type, id: ch.id, icon: "" })}
                    className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <button onClick={() => setIconPickerFor(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
            </div>
            {ICON_OPTIONS.map(group => (
              <div key={group.group}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{group.group}</p>
                <div className="flex flex-wrap gap-1">
                  {group.icons.map(icon => (
                    <button
                      key={icon}
                      onClick={() => updateIconMutation.mutate({ type: ch.type, id: ch.id, icon })}
                      disabled={updateIconMutation.isPending}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-primary/20 transition-colors ${ch.icon === icon ? "bg-primary/30 ring-1 ring-primary" : ""}`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hidden file input — rendered at top level so picker closing doesn't swallow the click */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
        style={{ position: "fixed", top: -9999, left: -9999 }}
      />

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