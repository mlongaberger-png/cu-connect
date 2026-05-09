import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, MessageSquare, Hash, ClipboardList, Globe,
  ChevronLeft, ChevronDown, ArrowDown
} from "lucide-react";
import { format } from "date-fns";
import AnnouncementsPanel from "@/components/messages/AnnouncementsPanel";
import MessageReadReceipts from "@/components/messages/MessageReadReceipts";
import EventMessageCard from "@/components/messages/EventMessageCard";
import MessageActions from "@/components/messages/MessageActions";

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
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const inputFocused = useRef(false);
  const prevMessageCount = useRef(0);
  const lastReadTs = useRef(getLastRead(channelId));
  const didInitialScroll = useRef(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => base44.entities.Message.filter({ channel_id: channelId }, "-created_date", 50),
    refetchInterval: 12000,         // poll every 12s
    refetchIntervalInBackground: false, // stop polling when tab is hidden
    staleTime: 10000,               // don't refetch if data is < 10s old
  });

  // ── Batch read-receipt tracking (once per channel, not per poll) ──────────
  const trackedChannelRef = useRef(null);
  useEffect(() => {
    if (!user?.email || messages.length === 0) return;
    if (trackedChannelRef.current === channelId) return; // only on channel change
    trackedChannelRef.current = channelId;

    const unreadMsgs = messages.filter(m => m.sender_email !== user.email && m.id && !m.id.startsWith("temp-"));
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
    staleTime: 60000, // blocked list rarely changes — cache for 60s
  });
  const allBlockedEmails = new Set([
    ...blockedUsers.map(b => b.blocked_email),
    ...(locallyBlockedEmails || []),
  ]);

  const sortedMessages = [...messages].reverse().filter(m => !allBlockedEmails.has(m.sender_email));

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

  // Initial scroll to bottom (instant, no animation)
  useEffect(() => {
    if (sortedMessages.length > 0 && !didInitialScroll.current) {
      didInitialScroll.current = true;
      // Use instant scroll so users always land at the bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 50);
    }
  }, [sortedMessages.length]);

  // When channel changes, reset and scroll to bottom
  useEffect(() => {
    didInitialScroll.current = false;
    lastReadTs.current = getLastRead(channelId);
    setNewMsgCount(0);
    setAtBottom(true);
    prevMessageCount.current = 0;
  }, [channelId]);

  // Track new messages when user is scrolled up
  useEffect(() => {
    const current = sortedMessages.length;
    const prev = prevMessageCount.current;
    if (prev > 0 && current > prev) {
      if (!atBottom) {
        setNewMsgCount(n => n + (current - prev));
      } else {
        // At bottom — smooth scroll to new messages
        scrollToBottom("smooth");
      }
    }
    prevMessageCount.current = current;
  }, [sortedMessages.length, atBottom, scrollToBottom]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMutation = useOptimisticMutation(
    (data) => base44.entities.Message.create(data),
    {
      queryClient,
      queryKey: ["messages", channelId],
      updater: (old, newMsg) => [
        ...old,
        { ...newMsg, id: "temp-" + Date.now(), created_date: new Date().toISOString() },
      ],
      onSuccess: () => {
        scrollToBottom("smooth");
      },
    }
  );

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate({
      content: newMessage.trim(),
      channel,
      channel_id: channelId,
      channel_name: channelName,
      sender_name: user?.full_name || "Staff",
      sender_email: user?.email || "",
      sender_avatar: user?.avatar_url || "",
    });
    setNewMessage("");
    // Ensure we stay at bottom after send
    setAtBottom(true);
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  // Channel icon
  const currentSport = sports.find(s => s.id === channelId);
  const ChannelIcon = () => {
    if (currentSport?.icon) return <span className="text-base leading-none">{currentSport.icon}</span>;
    if (channel === "room") return <Globe className="w-4 h-4 text-primary flex-shrink-0" />;
    return <Hash className="w-4 h-4 text-primary flex-shrink-0" />;
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
        </div>
      </div>

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
        className="flex-shrink-0 px-3 py-3 border-t border-border bg-card"
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