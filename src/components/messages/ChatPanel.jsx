import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, MessageSquare, ClipboardList, Globe,
  ChevronLeft, ChevronDown, MoreVertical, Lock, X, Check
} from "lucide-react";
import { format } from "date-fns";
import AnnouncementsPanel from "@/components/messages/AnnouncementsPanel";
import MessageReadReceipts from "@/components/messages/MessageReadReceipts";
import EventMessageCard from "@/components/messages/EventMessageCard";
import MessageActions from "@/components/messages/MessageActions";

const ICON_OPTIONS = [
  { group: "Sports", icons: ["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🏊","🏋️","🤸","🏇","⛷️","🏌️","🥊","🏒","🎿","🏑","🥅","🏟️"] },
  { group: "Volunteer & Events", icons: ["🙋","🤝","🎽","📋","🧢","🍕","🥤","🍉","🍪","🎉","📣","🚗","🏕️","🎪","📸","🎤","🎯","🗓️","📢","💪"] },
  { group: "General", icons: ["⭐","🔥","💬","📌","🏆","🎖️","👋","🌟","💡","📣","🔔","✅","🎁","🛡️","🦁","🌊","❤️","🤩","👏","🙌"] },
];

// ─── Read/unread helpers ────────────────────────────────────────────────────
function getLastRead(channelId) {
  try { return parseInt(localStorage.getItem(`msg_read_${channelId}`) || "0", 10); } catch { return 0; }
}
function markChannelRead(channelId) {
  try { localStorage.setItem(`msg_read_${channelId}`, String(Date.now())); } catch {}
}

// ─── Role badge styles ──────────────────────────────────────────────────────
const ROLE_STYLES = {
  staff:  { border: "border-primary/50",    nameCls: "text-primary",    badge: "Staff" },
  coach:  { border: "border-yellow-500/50", nameCls: "text-yellow-400", badge: "Coach" },
  parent: { border: "border-blue-500/30",   nameCls: "text-foreground",  badge: null },
  me:     { border: "border-primary",        nameCls: "text-primary",    badge: "You" },
};

// ─── MessageRow ─────────────────────────────────────────────────────────────
function MessageRow({ msg, isMe, senderAvatar, senderInitial, isStaff, user, channelId, channelName, senderRole, onBlock }) {

  const style = isMe ? ROLE_STYLES.me : (ROLE_STYLES[senderRole] || ROLE_STYLES.parent);

  return (
    <div className="flex gap-2.5 group">
      <div className={`w-8 h-8 rounded-full overflow-hidden bg-surface flex items-center justify-center flex-shrink-0 mt-0.5 border ${style.border}`}>
        {senderAvatar
          ? <img src={senderAvatar} alt={msg.sender_name} className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-primary">{senderInitial}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${style.nameCls}`}>{msg.sender_name || "Unknown"}</span>
          {style.badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-muted-foreground uppercase tracking-wider">
              {style.badge}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}
          </span>
          <MessageActions
            msg={msg}
            currentUser={user}
            channelId={channelId}
            channelName={channelName}
            onBlock={onBlock}
          />
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 break-words leading-relaxed">{msg.content}</p>
        {isMe && isStaff && (
          <MessageReadReceipts messageId={msg.id} channelId={channelId} isStaff={isStaff} />
        )}
      </div>
    </div>
  );
}

// ─── System / event message (compact) ───────────────────────────────────────
function EventRow({ msg, user, isStaff }) {
  return (
    <div className="space-y-1 opacity-90">
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-primary">{(msg.sender_name || "?")[0].toUpperCase()}</span>
        </div>
        <span className="text-xs font-medium text-primary">{msg.sender_name || "Staff"}</span>
        <span className="text-[10px] text-muted-foreground">{msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}</span>
      </div>
      <div className="pl-7">
        <EventMessageCard
          attendanceRequestId={msg.attendance_request_id}
          currentUser={user}
          isStaff={isStaff}
        />
      </div>
    </div>
  );
}

// ─── Last Read Divider ───────────────────────────────────────────────────────
function LastReadDivider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-primary/40" />
      <span className="text-[10px] font-semibold text-primary uppercase tracking-widest whitespace-nowrap px-1">
        Last Read
      </span>
      <div className="flex-1 h-px bg-primary/40" />
    </div>
  );
}

// ─── Main ChatPanel ──────────────────────────────────────────────────────────
export default function ChatPanel({
  channel,
  channelId,
  channelName,
  user,
  isStaff,
  teams,
  sports,
  canPostAttendance,
  onBack,
  onShowAttendance,
  onBlockUser,
  locallyBlockedEmails,
}) {
  const [newMessage, setNewMessage] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [editForm, setEditForm] = useState(null); // null = not editing
  const [showIconPicker, setShowIconPicker] = useState(false);

  const queryClient = useQueryClient();
  const isAdmin = ["admin", "athletic_director"].includes(user?.role);

  // Load current room/sport/team data for editing
  const { data: currentRoom } = useQuery({
    queryKey: ["message-room-single", channelId],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }).then(rooms => rooms.find(r => r.id === channelId) || null),
    enabled: isAdmin && channel === "room",
    staleTime: 30000,
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    staleTime: 30000,
  });

  // Always fetch fresh sport data for icon display (not just when editing)
  const { data: freshSports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
    staleTime: 30000,
  });
  const currentSportForEdit = freshSports.find(s => s.id === channelId);
  const currentTeamForEdit = allTeams.find(t => t.id === channelId);

  const updateMutation = useMutation({
    mutationFn: ({ type, id, data }) => {
      if (type === "room") return base44.entities.MessageRoom.update(id, data);
      if (type === "sport") return base44.entities.Sport.update(id, data);
      if (type === "team") return base44.entities.Team.update(id, data);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["message-room-single", channelId] });
      setEditForm(null);
      setShowEditMenu(false);
    },
  });

  const openEdit = () => {
    if (channel === "room" && currentRoom) {
      setEditForm({
        type: "room",
        name: currentRoom.name,
        description: currentRoom.description || "",
        icon: currentRoom.icon || "",
        is_private: currentRoom.is_private || false,
        allowed_roles: currentRoom.allowed_roles || "",
        allowed_emails: currentRoom.allowed_emails || "",
      });
    } else if (channel === "sport" && currentSportForEdit) {
      setEditForm({
        type: "sport",
        name: currentSportForEdit.name,
        icon: currentSportForEdit.icon || "",
      });
    } else if (channel === "team" && currentTeamForEdit) {
      setEditForm({
        type: "team",
        name: currentTeamForEdit.name,
        icon: currentTeamForEdit.icon || "",
      });
    } else if (channel === "org") {
      setEditForm({
        type: "org",
        name: channelName,
        icon: "",
      });
    }
    setShowEditMenu(false);
    setShowIconPicker(false);
  };

  const saveEdit = () => {
    if (!editForm) return;
    if (editForm.type === "org") return; // org not editable
    updateMutation.mutate({ type: editForm.type, id: channelId, data: editForm });
  };

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const inputFocused = useRef(false);
  const lastReadTs = useRef(getLastRead(channelId));
  const didInitialScroll = useRef(false);
  const userSentRef = useRef(false); // tracks explicit send — triggers scroll

  // ── Local message cache — keyed by channelId ──────────────────────────────
  const [messageCache, setMessageCache] = useState({}); // { [channelId]: Message[] }

  const cachedMessages = messageCache[channelId] || [];

  // ── Initial fetch — runs ONCE per channelId change ───────────────────────
  const { data: fetchedMessages } = useQuery({
    queryKey: ["messages-init", channelId],
    queryFn: () => base44.entities.Message.filter({ channel_id: channelId }, "-created_date", 50),
    staleTime: Infinity,      // never auto-refetch; real-time subscription handles updates
    gcTime: 0,                // don't keep stale cache across channel switches
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Seed the local cache when the initial fetch completes
  useEffect(() => {
    if (!fetchedMessages) return;
    setMessageCache(prev => ({ ...prev, [channelId]: fetchedMessages }));
  }, [fetchedMessages, channelId]);

  // ── Real-time subscription — appends deltas, never re-fetches ─────────────
  useEffect(() => {
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.channel_id !== channelId) return;
      if (event.type === "create") {
        setMessageCache(prev => {
          const existing = prev[channelId] || [];
          // Deduplicate: skip if already in cache (optimistic temp or real id)
          if (existing.some(m => m.id === event.id || (event.data.sender_email === m.sender_email && m.id?.startsWith("temp-") && m.content === event.data.content))) {
            // Replace temp optimistic message with real one
            return {
              ...prev,
              [channelId]: existing.map(m =>
                m.id?.startsWith("temp-") && m.content === event.data.content && m.sender_email === event.data.sender_email
                  ? event.data
                  : m
              ),
            };
          }
          return { ...prev, [channelId]: [...existing, event.data] };
        });
      } else if (event.type === "delete") {
        setMessageCache(prev => ({
          ...prev,
          [channelId]: (prev[channelId] || []).filter(m => m.id !== event.id),
        }));
      }
    });
    return () => unsub();
  }, [channelId]);

  // ── Batch read-receipt tracking (once per channel, not per poll) ──────────
  const trackedChannelRef = useRef(null);
  useEffect(() => {
    if (!user?.email || cachedMessages.length === 0) return;
    if (trackedChannelRef.current === channelId) return; // only on channel change
    trackedChannelRef.current = channelId;

    const unreadMsgs = cachedMessages.filter(m => m.sender_email !== user.email && m.id && !m.id.startsWith("temp-"));
    if (unreadMsgs.length === 0) return;

    base44.entities.MessageReadReceipt.filter({ channel_id: channelId, reader_email: user.email })
      .then(existing => {
        const trackedIds = new Set(existing.map(r => r.message_id));
        const toCreate = unreadMsgs.filter(m => !trackedIds.has(m.id));
        toCreate.slice(0, 10).forEach(m => {
          base44.entities.MessageReadReceipt.create({
            message_id: m.id,
            channel_id: channelId,
            reader_email: user.email,
            reader_name: user.full_name || user.email,
            reader_avatar: user.avatar_url || "",
          });
        });
      })
      .catch(() => {});
  }, [channelId, user?.email]); // ← removed messages.length — only fires on channel change

  const { data: blockedUsers = [] } = useQuery({
    queryKey: ["blocked-users", user?.email],
    queryFn: () => base44.entities.BlockedUser.filter({ blocker_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 60000,
  });
  const allBlockedEmails = useMemo(() => new Set([
    ...blockedUsers.map(b => b.blocked_email),
    ...(locallyBlockedEmails || []),
  ]), [blockedUsers, locallyBlockedEmails]);

  // cachedMessages arrives newest-first from the API — reverse for display
  const sortedMessages = useMemo(() =>
    [...cachedMessages].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      .filter(m => !allBlockedEmails.has(m.sender_email)),
    [cachedMessages, allBlockedEmails]
  );

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setNewMsgCount(0);
    markChannelRead(channelId);
  }, [channelId]);

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAtBottom(isBottom);
    if (isBottom) {
      setNewMsgCount(0);
      markChannelRead(channelId);
    }
  }, [channelId]);

  // Reset state when channel changes
  useEffect(() => {
    didInitialScroll.current = false;
    userSentRef.current = false;
    lastReadTs.current = getLastRead(channelId);
    setNewMsgCount(0);
    setAtBottom(true);
  }, [channelId]);

  // Initial scroll — fires exactly once after the first batch of messages loads
  useEffect(() => {
    if (sortedMessages.length > 0 && !didInitialScroll.current) {
      didInitialScroll.current = true;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMessages.length === 0]); // only re-evaluate when transitioning from empty → non-empty

  // After user explicitly sends — always scroll to bottom
  useEffect(() => {
    if (!userSentRef.current) return;
    userSentRef.current = false;
    setTimeout(() => scrollToBottom("smooth"), 80);
  });

  // New incoming messages (not sent by user) — show badge or auto-scroll
  const prevLengthRef = useRef(0);
  useEffect(() => {
    const prev = prevLengthRef.current;
    const curr = sortedMessages.length;
    prevLengthRef.current = curr;
    if (prev === 0 || curr <= prev) return; // ignore initial load / deletions
    if (atBottom) {
      scrollToBottom("smooth");
    } else {
      setNewMsgCount(n => n + (curr - prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedMessages.length]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onMutate: (newMsg) => {
      // Optimistically append to local cache
      const tempMsg = { ...newMsg, id: "temp-" + Date.now(), created_date: new Date().toISOString() };
      setMessageCache(prev => ({ ...prev, [channelId]: [...(prev[channelId] || []), tempMsg] }));
    },
    onError: () => {
      // Remove optimistic message on failure
      setMessageCache(prev => ({
        ...prev,
        [channelId]: (prev[channelId] || []).filter(m => !m.id?.startsWith("temp-")),
      }));
    },
    // onSuccess: real message arrives via subscription — temp msg gets replaced there
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    userSentRef.current = true;
    setAtBottom(true);
    setNewMessage("");
    sendMutation.mutate({
      content: newMessage.trim(),
      channel,
      channel_id: channelId,
      channel_name: channelName,
      sender_name: user?.full_name || "Staff",
      sender_email: user?.email || "",
      sender_avatar: user?.avatar_url || "",
    });
  };

  // Channel icon — resolve from the freshest data source per channel type
  const resolvedIcon = (() => {
    if (channel === "sport") return freshSports.find(s => s.id === channelId)?.icon || "";
    if (channel === "room") return currentRoom?.icon || "";
    if (channel === "team") return (currentTeamForEdit || teams.find(t => t.id === channelId))?.icon || "";
    return "";
  })();
  const ChannelIcon = () => {
    const icon = resolvedIcon;
    if (icon) return <span className="text-base leading-none">{icon}</span>;
    if (channel === "room") return <Globe className="w-4 h-4 text-primary flex-shrink-0" />;
    return <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />;
  };

  // Build message list with "Last Read" divider
  const renderMessages = () => {
    const dividerTs = lastReadTs.current;
    let dividerInserted = false;

    return sortedMessages.map((msg, idx) => {
      const msgTs = msg.created_date ? new Date(msg.created_date).getTime() : 0;
      const isUnread = msgTs > dividerTs && !dividerInserted && dividerTs > 0 && msg.sender_email !== user?.email;
      let divider = null;
      if (isUnread) {
        dividerInserted = true;
        divider = <LastReadDivider key={`divider-${idx}`} />;
      }

      let row;
      if (msg.attendance_request_id) {
        row = <EventRow key={msg.id} msg={msg} user={user} isStaff={isStaff} />;
      } else {
        const senderInitial = (msg.sender_name || "?")[0].toUpperCase();
        const isMe = msg.sender_email === user?.email;
        const senderAvatar = isMe ? (user?.avatar_url || msg.sender_avatar) : msg.sender_avatar;
        const isCoachSender = teams.some(t => t.coach_email?.toLowerCase() === msg.sender_email?.toLowerCase());
        const senderRole = isCoachSender ? "coach" : (["admin", "athletic_director", "coach"].includes(user?.role) ? "staff" : "parent");
        row = (
          <MessageRow
            key={msg.id}
            msg={msg}
            isMe={isMe}
            senderAvatar={senderAvatar}
            senderInitial={senderInitial}
            isStaff={isStaff}
            user={user}
            channelId={channelId}
            channelName={channelName}
            senderRole={senderRole}
            onBlock={onBlockUser}
          />
        );
      }

      return divider ? [divider, row] : row;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-card flex items-center gap-2 flex-shrink-0 min-h-[48px]">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <ChannelIcon />
        <h3 className="font-semibold text-foreground truncate flex-1">{channelName}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canPostAttendance && (
            <button
              onClick={onShowAttendance}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
            </button>
          )}
          <AnnouncementsPanel channel={channel} channelId={channelId} channelName={channelName} sports={sports} teams={teams} />
          {/* Admin edit button — all channels */}
          {isAdmin && (
            <div className="relative">
              <button
                onClick={() => { setShowEditMenu(p => !p); setEditForm(null); }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
                title="Edit channel"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {showEditMenu && !editForm && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-xl shadow-xl z-50 py-1">
                  <button
                    onClick={openEdit}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-surface transition-colors"
                  >
                    ✏️ Edit Channel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inline edit panel */}
      {editForm && (
        <div className="flex-shrink-0 border-b border-border bg-card/95 p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">Edit Channel</p>
            <button onClick={() => setEditForm(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Icon picker */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIconPicker(p => !p)}
              className="w-10 h-10 rounded-xl border border-border bg-surface flex items-center justify-center text-xl hover:border-primary/50 transition-colors flex-shrink-0"
            >
              {editForm.icon || <span className="text-muted-foreground text-sm">+</span>}
            </button>
            {editForm.icon && (
              <button onClick={() => setEditForm(f => ({ ...f, icon: "" }))} className="text-xs text-muted-foreground hover:text-red-400">Remove icon</button>
            )}
            {!editForm.icon && <span className="text-xs text-muted-foreground">Tap to set icon</span>}
          </div>

          {showIconPicker && (
            <div className="border border-border rounded-xl bg-surface p-3 space-y-2 max-h-44 overflow-y-auto">
              {ICON_OPTIONS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{group.group}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.icons.map(icon => (
                      <button
                        key={icon}
                        onClick={() => { setEditForm(f => ({ ...f, icon })); setShowIconPicker(false); }}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-primary/20 transition-colors ${editForm.icon === icon ? "bg-primary/30 ring-1 ring-primary" : ""}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Name */}
          <Input
            value={editForm.name}
            onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
            className="bg-surface border-border text-sm"
            placeholder="Channel name"
          />

          {/* Room-specific fields */}
          {editForm.type === "room" && (
            <>
              <Input
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="bg-surface border-border text-sm"
                placeholder="Description (optional)"
              />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={!editForm.is_private} onChange={() => setEditForm(f => ({ ...f, is_private: false }))} />
                  <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Public
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={editForm.is_private} onChange={() => setEditForm(f => ({ ...f, is_private: true }))} />
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Private
                </label>
              </div>
              {editForm.is_private && (
                <Input
                  value={editForm.allowed_emails}
                  onChange={e => setEditForm(f => ({ ...f, allowed_emails: e.target.value }))}
                  className="bg-surface border-border text-sm"
                  placeholder="Allowed emails (comma-separated)"
                />
              )}
            </>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditForm(null)} className="border-border">Cancel</Button>
            <Button size="sm" onClick={saveEdit} disabled={!editForm.name || updateMutation.isPending} className="bg-primary text-primary-foreground">
              <Check className="w-3.5 h-3.5 mr-1" />
              {updateMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable message list */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto overscroll-contain p-4 space-y-4"
          onScroll={checkAtBottom}
          onMouseDown={(e) => { if (inputFocused.current) e.preventDefault(); }}
        >
          {sortedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No messages yet in #{channelName}</p>
              <p className="text-xs text-muted-foreground mt-1">Send the first message</p>
            </div>
          )}

          {renderMessages()}
          <div ref={messagesEndRef} className="h-px" />
        </div>

        {/* Floating: new messages indicator (when scrolled up and new messages arrive) */}
        {newMsgCount > 0 && !atBottom && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg hover:bg-primary/90 transition-all z-10 animate-bounce"
          >
            {newMsgCount} new message{newMsgCount !== 1 ? "s" : ""} ↓
          </button>
        )}

        {/* Floating: scroll-to-bottom button (when scrolled up, no new messages) */}
        {!atBottom && newMsgCount === 0 && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 right-4 w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-all z-10"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fixed input bar */}
      <form
        onSubmit={handleSend}
        className="flex-shrink-0 px-3 pt-3 pb-3 border-t border-border bg-card"
      >
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${channelName}…`}
            className="bg-surface border-border text-foreground flex-1"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(e); }}
            onFocus={() => {
              inputFocused.current = true;
              // When keyboard appears, keep view at bottom
              if (atBottom) setTimeout(() => scrollToBottom("smooth"), 300);
            }}
            onBlur={() => { inputFocused.current = false; }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0 w-10 h-10"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}