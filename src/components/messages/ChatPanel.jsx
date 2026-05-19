import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, MessageSquare, ClipboardList, Globe,
  ChevronLeft, ChevronDown, MoreVertical
} from "lucide-react";
import { format } from "date-fns";
import AnnouncementsPanel from "@/components/messages/AnnouncementsPanel";
import MessageReadReceipts from "@/components/messages/MessageReadReceipts";
import EventMessageCard from "@/components/messages/EventMessageCard";
import MessageActions from "@/components/messages/MessageActions";
import ChannelEditModal from "@/components/messages/ChannelEditModal";

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
  const [showEditModal, setShowEditModal] = useState(false);

  const queryClient = useQueryClient();
  // Only admins can rename/edit channels; coaches & parents cannot
  const isAdmin = user?.role === "admin";

  // Load current room/sport/team data for editing
  const { data: currentRoom } = useQuery({
    queryKey: ["message-room-single", channelId],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }).then(rooms => rooms.find(r => r.id === channelId) || null),
    enabled: channel === "room",
    staleTime: 0,
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

  // Build the channel object for the edit modal
  const editChannelObj = (() => {
    if (channel === "room" && currentRoom) return { ...currentRoom, type: "room" };
    if (channel === "sport" && currentSportForEdit) return { ...currentSportForEdit, type: "sport" };
    if (channel === "team" && currentTeamForEdit) return { ...currentTeamForEdit, type: "team" };
    return null;
  })();

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

  // Reset state when channel changes — also cancel any in-flight fetches for the previous channel
  useEffect(() => {
    didInitialScroll.current = false;
    userSentRef.current = false;
    lastReadTs.current = getLastRead(channelId);
    setNewMsgCount(0);
    setAtBottom(true);
    // Cancel any still-pending queries keyed to other channels to stop rate-limit pileup
    queryClient.cancelQueries({ queryKey: ["messages-init"] });
  }, [channelId, queryClient]);

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
    onSuccess: (_, sentData) => {
      // Fire push notifications to team members (non-blocking)
      if (sentData.channel === "team" && sentData.channel_id) {
        base44.functions.invoke("sendPushNotification", {
          user_emails: [], // sendPushNotification with team_id will figure out recipients
          title: `${sentData.channel_name || "Team"}: ${sentData.sender_name || "Staff"}`,
          body: sentData.content,
          url: "/Messages",
          team_id: sentData.channel_id,
        }).catch(() => {});
      }
    },
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
          {/* Admin edit button */}
          {isAdmin && editChannelObj && (
            <button
              onClick={() => setShowEditModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
              title="Edit channel"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Channel edit modal */}
      {isAdmin && editChannelObj && (
        <ChannelEditModal
          channel={editChannelObj}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onDeleted={() => {}}
        />
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

      {/* Fixed input bar — anchored at bottom with safe-area support */}
      <form
        onSubmit={handleSend}
        className="flex-shrink-0 px-3 pt-3 border-t border-border bg-card"
        style={{ paddingBottom: "0.75rem" }}
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