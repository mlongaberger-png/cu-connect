import React, { useRef, useEffect, useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { ChevronLeft, MessageSquareText, MessageSquare, RefreshCw, CornerUpLeft, SmilePlus, MoreVertical, Flag, UserX, Heart, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Composer from "./Composer";
import ChatSettingsSheet from "./ChatSettingsSheet";
import { useKeyboard, dismissKeyboard } from "@/hooks/useKeyboard";
import EventCard from "./cards/EventCard";
import ScoreCard from "./cards/ScoreCard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import EmojiReactionPicker from "./EmojiReactionPicker";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

const HEART = "\u2764\uFE0F";

function initialsOf(name) {
  const clean = displayNameOf(name);
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// sender_name is whatever the sender's profile name was when they posted; some older
// accounts only have their email there. Never show a raw email address in the chat.
function displayNameOf(name) {
  if (!name) return "Someone";
  return name.includes("@") ? name.split("@")[0] : name;
}

function parseMsgDate(raw) {
  if (!raw) return null;
  return new Date(raw.endsWith("Z") ? raw : raw + "Z");
}

function dayLabel(d, timeZone) {
  const tz = timeZone ?? undefined;
  const key = (x) => x.toLocaleDateString("en-US", { timeZone: tz });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  const sameYear = d.toLocaleDateString("en-US", { year: "numeric", timeZone: tz }) === today.toLocaleDateString("en-US", { year: "numeric", timeZone: tz });
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: tz });
}

function MessageBubble({ msg, isOwn, onOpenThread, replyCount, reactions, onReact, onReportMessage, onBlockUser, myUserId, isGroupStart = true, isGroupEnd = true }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const longPressTimer = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  // Locked once early movement clears a small threshold: 'horizontal' commits to the
  // swipe-to-reply gesture, 'vertical' means the user is scrolling the message list and this
  // gesture backs off entirely. See the touchmove effect below for why this exists.
  const swipeDirectionRef = useRef(null);
  const bubbleWrapRef = useRef(null);
  const { timeZone } = useOrgTimezone();

  const handleBubbleTouchStart = (e) => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 500);
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    swipeDirectionRef.current = null;
    setIsSwiping(true);
  };

  const handleBubbleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    setIsSwiping(false);
    if (swipeX >= 40 && !msg.parent_message_id) {
      onOpenThread(msg);
    }
    setSwipeX(0);
  };

  // Attached natively via useEffect/addEventListener instead of a React onTouchMove prop, so
  // e.preventDefault() actually has an effect. React 17+ registers onTouchMove at its
  // delegated root as a PASSIVE listener for scroll performance -- calling preventDefault()
  // from a plain JSX handler is silently ignored (with a console warning), so the swipe-to-
  // reply gesture below could never stop the browser/WKWebView from ALSO treating the same
  // touch sequence as a page scroll/pan, since this gesture starts on a bubble inside a
  // vertically-scrolling list (ChatCanvas's scrollContainerRef, overflow-y-auto) with nothing
  // arbitrating between "the user is swiping to reply" and "the OS is panning the page".
  // Best-supported explanation so far for the persistent horizontal layout shift reported
  // live 2026-09-08 (only reproducible on a real iPhone -- a desktop/mobile-width browser
  // test of open/close Thread found nothing wrong -- and confirmed to still happen on a
  // build that already shipped the earlier Capacitor Keyboard resize:'none' fix, which rules
  // out the keyboard-resize theory): WKWebView's own scroll machinery gets engaged alongside
  // this custom drag and is left in a stuck, offset state once the gesture ends. This is the
  // leading hypothesis, not a confirmed root cause -- worth watching for whether it recurs
  // once this ships. Fix: once the gesture is clearly horizontal (not a vertical scroll),
  // preventDefault() so the browser never also pans the page for it; normal vertical
  // scrolling through the message list is untouched, since preventDefault only fires after
  // the gesture locks to 'horizontal'.
  useEffect(() => {
    const el = bubbleWrapRef.current;
    if (!el) return;
    const onTouchMove = (e) => {
      if (!e.touches?.[0]) return;
      clearTimeout(longPressTimer.current);
      const deltaX = e.touches[0].clientX - startXRef.current;
      const deltaY = e.touches[0].clientY - startYRef.current;
      if (swipeDirectionRef.current === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
        swipeDirectionRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      if (swipeDirectionRef.current !== "horizontal") return; // let the page scroll normally
      e.preventDefault();
      if (deltaX > 0) setSwipeX(Math.min(deltaX, 60));
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, []);

  if (msg.message_type === "event") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <EventCard msg={msg} />
      </div>
    );
  }

  const sentAt = parseMsgDate(msg.created_date);
  const timestamp = sentAt
    ? sentAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timeZone ?? undefined })
    : null;
  const isPhoto = /^!\[photo\]\((.+)\)$/.test(msg.content_text?.trim());

  // GroupMe-style one-tap heart, kept separate from the other emoji reactions.
  const hearts = reactions.filter(r => r.reaction_type === HEART);
  const likedByMe = hearts.some(r => r.user_id === myUserId);
  const reactionGroups = reactions.reduce((acc, r) => {
    if (r.reaction_type === HEART) return acc;
    acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
    return acc;
  }, {});

  const swipeProgress = Math.min(swipeX / 40, 1); // 0–1 as user approaches threshold
  const senderName = displayNameOf(msg.sender_name);

  const heartButton = (
    <button
      type="button"
      onClick={() => onReact(msg.id, HEART)}
      aria-label={likedByMe ? `Unlike (${hearts.length})` : hearts.length ? `Like (${hearts.length})` : "Like"}
      className={`shrink-0 min-w-[32px] min-h-[32px] flex flex-col items-center justify-start pt-0.5 ${likedByMe || hearts.length ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}
    >
      <Heart className="w-[18px] h-[18px]" fill={likedByMe ? "currentColor" : "none"} strokeWidth={2} />
      {hearts.length > 0 && <span className="text-[11px] font-bold leading-tight">{hearts.length}</span>}
    </button>
  );

  const body = isPhoto ? (
    <div className={`rounded-2xl overflow-hidden ${msg.isPending ? "opacity-60" : "opacity-100"}`}>
      <img
        src={msg.content_text.match(/^!\[photo\]\((.+)\)$/)[1]}
        alt={`Photo from ${senderName}`}
        className="max-w-[240px] max-h-[320px] object-cover rounded-2xl"
      />
    </div>
  ) : isOwn ? (
    <div className={`px-3.5 py-2 text-base leading-snug break-words select-none bg-primary text-primary-foreground font-medium rounded-[18px] ${isGroupEnd ? "rounded-br-[4px]" : ""} ${msg.isPending ? "opacity-60" : "opacity-100"}`}>
      {msg.content_text}
    </div>
  ) : (
    <p className={`m-0 text-base leading-snug break-words whitespace-pre-wrap select-none text-foreground ${msg.isPending ? "opacity-60" : "opacity-100"}`}>
      {msg.content_text}
    </p>
  );

  const hoverActions = (
    <>
      {hovered && !msg.parent_message_id && (
        <button
          onClick={() => onOpenThread(msg)}
          className={`absolute -top-3 ${isOwn ? "-left-8" : "right-0"} hidden md:block
            bg-card border border-border shadow-md rounded-full p-1.5
            text-muted-foreground hover:text-primary hover:border-primary/40
            transition-colors z-10`}
          title="Reply in thread"
        >
          <MessageSquareText className="w-3.5 h-3.5" />
        </button>
      )}
      {hovered && (
        <button
          onClick={() => setShowPicker(true)}
          className={`absolute -top-3 ${isOwn ? "-left-16" : "right-8"} hidden md:block
            bg-card border border-border shadow-md rounded-full p-1.5
            text-muted-foreground hover:text-primary hover:border-primary/40
            transition-colors z-10`}
          title="React"
        >
          <SmilePlus className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Report/Block stays mounted (opacity-toggled) -- see the original comment in git
          history: unmounting the Radix trigger on mouseleave closes the menu mid-open. */}
      {!isOwn && (onReportMessage || onBlockUser) && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              className={`absolute -top-3 right-16 hidden md:block
                bg-card border border-border shadow-md rounded-full p-1.5
                text-muted-foreground hover:text-primary hover:border-primary/40
                transition-opacity z-10 ${(hovered || menuOpen) ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem onClick={() => onReportMessage?.(msg)} className="gap-2 cursor-pointer">
              <Flag className="w-3.5 h-3.5" /> Report message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBlockUser?.(msg)} className="gap-2 cursor-pointer text-red-400 focus:text-red-400">
              <UserX className="w-3.5 h-3.5" /> Block {senderName}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {showPicker && (
        <EmojiReactionPicker
          isOwn={isOwn}
          onSelect={(emoji) => onReact(msg.id, emoji)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );

  const extras = (
    <>
      {Object.keys(reactionGroups).length > 0 && (
        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
          {Object.entries(reactionGroups).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReact(msg.id, emoji)}
              className="flex items-center gap-0.5 bg-surface border border-border rounded-full px-2 py-0 text-[12px] leading-6 hover:bg-surface-hover transition-colors"
            >
              <span className="text-[13px]">{emoji}</span>
              {count > 1 && <span className="text-muted-foreground text-[11px]">{count}</span>}
            </button>
          ))}
        </div>
      )}
      {replyCount > 0 && !msg.parent_message_id && (
        <button
          onClick={() => onOpenThread(msg)}
          className={`text-[13px] text-primary font-semibold mt-1 hover:underline cursor-pointer ${isOwn ? "self-end" : "self-start"}`}
        >
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </button>
      )}
    </>
  );

  const swipeIndicator = swipeX > 0 && !msg.parent_message_id && (
    <div
      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 flex items-center justify-center"
      style={{ opacity: swipeProgress, transform: `translateY(-50%) scale(${0.7 + 0.3 * swipeProgress})` }}
    >
      <CornerUpLeft className="w-4 h-4 text-primary" />
    </div>
  );

  const swipeProps = {
    ref: bubbleWrapRef,
    onTouchStart: handleBubbleTouchStart,
    onTouchEnd: handleBubbleTouchEnd,
    style: { transform: `translateX(${swipeX}px)`, transition: isSwiping ? "none" : "transform 0.2s ease-out" },
  };

  if (isOwn) {
    return (
      <div
        className={`relative flex flex-col items-end self-end max-w-[80%] ${isGroupStart ? "" : "-mt-2"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {swipeIndicator}
        <div className="relative" {...swipeProps}>
          {body}
          {hoverActions}
        </div>
        {extras}
        {(isGroupEnd || hearts.length > 0) && (
          <div className="flex items-center gap-2 mt-1 pr-1">
            {hearts.length > 0 && (
              <button type="button" onClick={() => onReact(msg.id, HEART)} className="flex items-center gap-1 text-primary text-[12px] font-bold" aria-label={`${hearts.length} likes`}>
                <Heart className="w-3.5 h-3.5" fill="currentColor" /> {hearts.length}
              </button>
            )}
            {isGroupEnd && timestamp && <span className="text-[12px] text-muted-foreground">{timestamp}</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex gap-2.5 self-stretch ${isGroupStart ? "" : "-mt-2"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="w-8 shrink-0">
        {isGroupStart && (
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface border border-border flex items-center justify-center">
            {msg.sender_avatar
              ? <img src={msg.sender_avatar} alt="" className="w-full h-full object-cover" />
              : <span className="text-[12px] font-bold text-primary">{initialsOf(msg.sender_name)}</span>}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        {isGroupStart && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[14px] font-bold text-foreground truncate">{senderName}</span>
            {timestamp && <span className="text-[12px] text-muted-foreground shrink-0">{timestamp}</span>}
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="relative flex-1 min-w-0" {...swipeProps}>
            {swipeIndicator}
            {body}
            {hoverActions}
          </div>
          {heartButton}
        </div>
        {extras}
      </div>
    </div>
  );
}

export default function ChatCanvas({ channelId, onOpenThread }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setSearchParams] = useSearchParams();
  const myId = user?.id || user?.email;
  const topSentinelRef = useRef(null);
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const keyboard = useKeyboard();
  const { timeZone } = useOrgTimezone();
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("abusive");
  const [blockTarget, setBlockTarget] = useState(null);
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe: subscribePush, unsubscribe: unsubscribePush } = usePushNotifications();

  // Auto-clear unread when the user is actively viewing this channel
  const clearUnreadMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email || !channelId) return;
      const memberships = await base44.entities.ChannelMember.filter({ channel_id: channelId, user_email: user.email });
      const membership = memberships[0];
      if (membership && (membership.unread_count || 0) > 0) {
        await base44.entities.ChannelMember.update(membership.id, { unread_count: 0 });
      }
    },
    onMutate: async () => {
      if (!user?.email || !channelId) return {};
      const queryKey = ["channel-members", user.email];
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old = []) =>
        old.map(m => m.channel_id === channelId ? { ...m, unread_count: 0 } : m)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["channel-members", user?.email], ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-members"] });
    },
  });

  // Clear unread whenever this channel becomes active or new messages arrive
  useEffect(() => {
    if (channelId && user?.email) {
      clearUnreadMutation.mutate();
    }
  }, [channelId, user?.email]); // eslint-disable-line

  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => base44.entities.Channel.filter({ id: channelId }).then(r => r[0]),
    enabled: !!channelId,
  });

  // Member count/list for the header subtitle and the settings sheet. Computed server-side
  // (getChannelInfo, asServiceRole) because team-chat membership is derived from rosters +
  // guardians, which a parent's RLS can't read directly.
  const { data: channelInfo } = useQuery({
    queryKey: ["channel-info", channelId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getChannelInfo", { channel_id: channelId });
      return res.data || null;
    },
    enabled: !!channelId,
    staleTime: 5 * 60_000,
  });

  // Per-person mute lives on the viewer's own ChannelMember row (onMessageCreated skips
  // push for muted members but still counts unread). The old header "Mute" wrote
  // Channel.is_muted -- a shared field that nothing read, so it never silenced anything.
  const { data: myMembership } = useQuery({
    queryKey: ["my-channel-membership", channelId, user?.email],
    queryFn: () => base44.entities.ChannelMember.filter({ channel_id: channelId, user_email: user.email }).then(r => r[0] || null),
    enabled: !!channelId && !!user?.email,
  });
  const isMutedForMe = !!myMembership?.muted;
  const setMutedMutation = useMutation({
    mutationFn: async (muted) => {
      if (myMembership?.id) return base44.entities.ChannelMember.update(myMembership.id, { muted });
      return base44.entities.ChannelMember.create({ channel_id: channelId, user_email: user.email, unread_count: 0, muted });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-channel-membership", channelId] }),
    onError: (error) => toast({ title: "Couldn't update notifications", description: error?.message || "Please try again.", variant: "destructive" }),
  });

  // See ChatSidebar.jsx's matching comment: a direct channel's stored `name` was set once,
  // at creation, to whoever the CREATOR was messaging -- so the header showed the CURRENT
  // viewer's own name back at them whenever they weren't the one who started the DM. Resolve
  // the header title the same per-viewer way: the other member_emails entry, looked up in the
  // same getDmContacts contact list NewDmDialog/ChatSidebar already fetch (shared query cache,
  // so this is a no-op request once warm).
  const { data: dmContacts = [] } = useQuery({
    queryKey: ["dm-contacts", user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke("getDmContacts");
      return res.data?.contacts || [];
    },
    enabled: channel?.type === "direct" && !!user?.email,
  });
  let channelDisplayName = channel?.name;
  if (channel?.type === "direct") {
    try {
      const members = JSON.parse(channel.member_emails || "[]");
      const otherEmail = members.find(e => e && e.toLowerCase() !== user?.email?.toLowerCase());
      if (otherEmail) {
        const contact = dmContacts.find(c => c.email?.toLowerCase() === otherEmail.toLowerCase());
        channelDisplayName = contact?.full_name || otherEmail;
      }
    } catch { /* fall back to channel.name below */ }
  }

  const channelInitials = (() => {
    const name = (channelDisplayName || "").replace(/@.*$/, "").trim();
    const m = name.match(/^(\d+\s*u)\b/i); // "12u Lions" -> "12U"
    if (m) return m[1].replace(/\s/g, "").toUpperCase();
    const parts = name.split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  })();
  const memberCount = channelInfo?.member_count;
  const channelSubtitle =
    channel?.type === "direct" ? "Direct message"
    : channel?.type === "carpool" ? (memberCount ? `Carpool · ${memberCount} members` : "Carpool")
    : memberCount ? `${memberCount} members · tap for settings`
    : channel?.type === "announcement" ? "Announcements"
    : "Team chat";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch: refetchMessages,
  } = useInfiniteQuery({
    queryKey: ["messages", channelId],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await base44.functions.invoke('getMessagesFiltered', {
        channel_id: channelId,
        limit: 50,
        skip: pageParam,
      });
      return { messages: res.data?.messages || [], hasMore: res.data?.has_more ?? false, replyCounts: res.data?.reply_counts || {} };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.reduce((sum, p) => sum + p.messages.length, 0);
    },
    initialPageParam: 0,
    enabled: !!channelId,
  });

  // Realtime subscription — refetch messages only when actual changes occur
  useEffect(() => {
    if (!channelId) return;
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.data?.channel_id === channelId) {
        queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      }
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [channelId, queryClient]);

  // Pull-to-refresh state
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const scrollContainerRef = useRef(null);
  const touchStartY = useRef(null);

  // Closing the keyboard the way people expect from GroupMe/iMessage: a tap anywhere in the
  // conversation, or a downward swipe on it, dismisses it (plus the Done bar in Composer).
  const kbSwipeStartY = useRef(null);
  const handleTouchStart = (e) => {
    kbSwipeStartY.current = keyboard.open ? e.touches[0].clientY : null;
    const container = scrollContainerRef.current;
    // Only trigger pull-to-refresh when scrolled to bottom (flex-col-reverse: bottom = scrollTop near 0)
    if (container && container.scrollTop <= 10) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (kbSwipeStartY.current !== null && e.touches[0].clientY - kbSwipeStartY.current > 40) {
      kbSwipeStartY.current = null;
      dismissKeyboard();
    }
    if (touchStartY.current === null) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) {
      setPullDistance(Math.min(dist, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 50) {
      navigator.vibrate?.(10);
      setIsPulling(true);
      refetchMessages().finally(() => {
        setIsPulling(false);
        navigator.vibrate?.(15);
      });
    }
    setPullDistance(0);
    touchStartY.current = null;
  };

  // IntersectionObserver to load more when scrolling to top
  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allMessages = data?.pages?.flatMap(p => p.messages) ?? [];
  // Server-computed reply counts (see getMessagesFiltered) -- every page's reply_counts is
  // derived from the same near-complete per-channel message set, so pages agree; just take
  // the first page's rather than trying to merge N identical objects.
  const serverReplyCounts = data?.pages?.[0]?.replyCounts ?? {};

  // When new messages arrive while viewing, clear unread immediately
  useEffect(() => {
    if (allMessages.length > 0 && channelId && user?.email) {
      clearUnreadMutation.mutate();
    }
  }, [allMessages.length]); // eslint-disable-line

  // Reactions — only fetch for messages currently loaded in this channel
  const msgIds = allMessages.map(m => m.id);
  const { data: reactions = [] } = useQuery({
    queryKey: ["reactions", channelId, msgIds],
    queryFn: () => base44.entities.MessageReaction.filter({ message_id: { $in: msgIds } }),
    enabled: msgIds.length > 0,
    staleTime: 30000,
  });

  // Realtime subscription — refetch reactions only when changes occur
  useEffect(() => {
    if (!channelId) return;
    const unsubscribe = base44.entities.MessageReaction.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["reactions", channelId] });
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [channelId, queryClient]);

  const reactMutation = useMutation({
    mutationFn: async ({ messageId, emoji }) => {
      if (!user?.id) return;
      // Toggle: remove if already reacted with same emoji, else add
      const existing = reactions.find(
        r => r.message_id === messageId && r.user_id === user.id && r.reaction_type === emoji
      );
      if (existing) {
        await base44.entities.MessageReaction.delete(existing.id);
      } else {
        await base44.entities.MessageReaction.create({
          message_id: messageId,
          user_id: user.id,
          user_email: user.email,
          reaction_type: emoji,
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reactions", channelId] }),
    onError: (error) => {
      toast({
        title: "Couldn't react to that message",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async ({ msg, reason }) => {
      return base44.entities.MessageReport.create({
        message_id: msg.id,
        message_content: msg.content_text,
        reported_sender_name: msg.sender_name,
        reporter_email: user.email,
        reporter_name: user?.full_name || user?.email,
        channel_id: channelId,
        channel_name: channelDisplayName,
        reason,
      });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Admins will review this message." });
      setReportTarget(null);
      setReportReason("abusive");
    },
    onError: (error) => {
      toast({
        title: "Couldn't submit report",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // blockUser is a dedicated asServiceRole function (not a raw entity create) because it
  // also needs to check for an existing block (idempotent) and reject self-blocking --
  // see base44/functions/blockUser/entry.ts.
  const blockMutation = useMutation({
    mutationFn: async (msg) => {
      const res = await base44.functions.invoke("blockUser", {
        blocked_id: msg.sender_user_id,
        blocked_name: msg.sender_name,
        reason: "Blocked from chat",
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "User blocked", description: "You won't see their messages anymore, and they won't see yours." });
      setBlockTarget(null);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      toast({
        title: "Couldn't block that user",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Build reactions map: messageId -> array of reactions
  const reactionsMap = reactions.reduce((acc, r) => {
    if (!acc[r.message_id]) acc[r.message_id] = [];
    acc[r.message_id].push(r);
    return acc;
  }, {});

  // Reply counts per parent message, from the server (see getMessagesFiltered) -- allMessages
  // here is the TOP-LEVEL feed only (getMessagesFiltered deliberately excludes replies from it),
  // so counting parent_message_id occurrences in allMessages itself would always be zero; the
  // server computes this from the full per-channel set instead, before applying that filter.
  const replyCountMap = serverReplyCounts;

  // Only show top-level messages in the main canvas
  const topLevelMessages = allMessages.filter(msg => !msg.parent_message_id);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header — slim, GroupMe-style: back, avatar, name + one line of context. Tapping the
          name (or the info button) opens this chat's settings: alerts, mute, members, photos.
          On phones this replaces the app TopBar (see AppLayout), so it carries the top safe area. */}
      <div className="flex items-center gap-1 pl-1 pr-2 py-1.5 border-b border-border bg-background shrink-0 safe-area-top">
        <button
          onClick={() => setSearchParams({})}
          aria-label="Back to chats"
          className="md:hidden w-11 h-11 rounded-full flex items-center justify-center text-primary"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2.4} />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg px-1 py-1 md:px-3"
        >
          {channel?.avatar_url ? (
            <img src={channel.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <span className="w-9 h-9 rounded-full bg-primary text-primary-foreground text-[12px] font-extrabold flex items-center justify-center shrink-0">
              {channelInitials}
            </span>
          )}
          <span className="min-w-0 flex flex-col">
            <span className="font-bold text-[16px] leading-tight truncate" title={channelDisplayName}>
              {channelDisplayName || "Loading…"}
            </span>
            <span className="text-[12px] text-muted-foreground truncate">
              {channelSubtitle}
              {isMutedForMe && " · Muted"}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Chat settings"
          className="w-11 h-11 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Messages — flex-col-reverse keeps latest at bottom */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 md:px-4 py-3 flex flex-col-reverse gap-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // Tap on the conversation (not on a button/link/photo) closes the keyboard.
          if (keyboard.open && !e.target.closest("button, a, input, textarea, img")) dismissKeyboard();
        }}
        style={{ position: 'relative' }}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 10 || isPulling) && (
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 shadow-md z-10 transition-all"
            style={{ top: `${60 + Math.min(pullDistance, 60)}px` }}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isPulling ? "animate-spin" : ""}`} />
            <span className="text-xs text-muted-foreground">{isPulling ? "Refreshing…" : pullDistance > 50 ? "Release to refresh" : "Pull to refresh"}</span>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : topLevelMessages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <MessageSquare className="w-10 h-10 opacity-30" />
            <p className="text-base text-center">No messages in this channel yet.</p>
            <p className="text-sm text-center opacity-70">Be the first to say something!</p>
          </div>
        ) : (
          <>
            {/* Top sentinel for infinite scroll */}
            <div ref={topSentinelRef} className="h-1 shrink-0" />
            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            )}
            {topLevelMessages.map((msg, i) => {
              // topLevelMessages is newest-first and the list is flex-col-reverse, so the
              // message visually ABOVE this one is i + 1 (older) and BELOW is i - 1 (newer).
              const older = topLevelMessages[i + 1];
              const newer = topLevelMessages[i - 1];
              const d = parseMsgDate(msg.created_date);
              const dOlder = older ? parseMsgDate(older.created_date) : null;
              const dNewer = newer ? parseMsgDate(newer.created_date) : null;
              const dayKey = (x) => x ? x.toLocaleDateString("en-US", { timeZone: timeZone ?? undefined }) : "";
              const newDay = !older || dayKey(d) !== dayKey(dOlder);
              const sameRun = (a, b, da, db) =>
                a && b && a.sender_user_id === b.sender_user_id &&
                a.message_type !== "event" && b.message_type !== "event" &&
                da && db && Math.abs(da - db) < 5 * 60 * 1000;
              const isGroupStart = newDay || !sameRun(msg, older, d, dOlder);
              const isGroupEnd = !newer || dayKey(d) !== dayKey(dNewer) || !sameRun(msg, newer, d, dNewer);

              const item = (msg.sender_name === "Score Bot" || msg.message_type === "score_update")
                ? <ScoreCard key={msg.id} message={msg} />
                : (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.sender_user_id === myId}
                    myUserId={user?.id}
                    isGroupStart={isGroupStart}
                    isGroupEnd={isGroupEnd}
                    onOpenThread={onOpenThread || (() => {})}
                    replyCount={replyCountMap[msg.id] || 0}
                    reactions={reactionsMap[msg.id] || []}
                    onReact={(messageId, emoji) => reactMutation.mutate({ messageId, emoji })}
                    onReportMessage={(m) => setReportTarget(m)}
                    onBlockUser={(m) => setBlockTarget(m)}
                  />
                );
              if (!newDay || !d) return item;
              // Column is reversed: the divider comes AFTER the message in DOM order so it
              // renders ABOVE it on screen.
              return (
                <React.Fragment key={msg.id}>
                  {item}
                  <div className="flex items-center gap-3 text-[12px] font-bold text-muted-foreground select-none" role="separator">
                    <span className="flex-1 h-px bg-border" />
                    {dayLabel(d, timeZone)}
                    <span className="flex-1 h-px bg-border" />
                  </div>
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>

      {/* Composer */}
      <Composer channelId={channelId} channel={channel} channelDisplayName={channelDisplayName} />

      <ChatSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        channel={channel}
        displayName={channelDisplayName}
        initials={channelInitials}
        subtitle={channelSubtitle.replace(" · tap for settings", "")}
        info={channelInfo}
        photos={allMessages
          .map(m => m.content_text?.trim().match(/^!\[photo\]\((.+)\)$/)?.[1])
          .filter(Boolean)
          .slice(0, 8)}
        push={{ isSupported, isSubscribed, pushLoading, permission, subscribePush, unsubscribePush }}
        muted={isMutedForMe}
        onSetMuted={(v) => setMutedMutation.mutate(v)}
        mutePending={setMutedMutation.isPending}
      />

      {/* Report message dialog */}
      <Dialog open={!!reportTarget} onOpenChange={(open) => { if (!open) { setReportTarget(null); setReportReason("abusive"); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Report message</DialogTitle>
            <DialogDescription>
              Report this message from {reportTarget?.sender_name || "this user"} to admins for review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {reportTarget?.content_text && (
              <div className="bg-surface rounded-lg border border-border p-3 text-sm text-muted-foreground italic">
                "{reportTarget.content_text}"
              </div>
            )}
            <Select value={reportReason} onValueChange={setReportReason}>
              <SelectTrigger className="bg-surface border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="abusive">Abusive</SelectItem>
                <SelectItem value="harassment">Harassment</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="inappropriate">Inappropriate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={reportMutation.isPending}
              onClick={() => reportMutation.mutate({ msg: reportTarget, reason: reportReason })}
            >
              Submit report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block user confirmation */}
      <AlertDialog open={!!blockTarget} onOpenChange={(open) => !open && setBlockTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {blockTarget?.sender_name || "this user"}?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't see their messages anymore, and they won't see yours, in any channel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={blockMutation.isPending}
              onClick={() => blockMutation.mutate(blockTarget)}
            >
              Block user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}