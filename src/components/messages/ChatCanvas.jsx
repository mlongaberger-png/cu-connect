import React, { useRef, useEffect, useCallback, useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { BellOff, Bell, ArrowLeft, MessageSquareText, RefreshCw, CornerUpLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import Composer from "./Composer";
import EventCard from "./cards/EventCard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import EmojiReactionPicker from "./EmojiReactionPicker";

function MessageBubble({ msg, isOwn, onOpenThread, replyCount, reactions, onReact }) {
  const [hovered, setHovered] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const longPressTimer = useRef(null);
  const startXRef = useRef(0);

  const handleBubbleTouchStart = (e) => {
    longPressTimer.current = setTimeout(() => setShowPicker(true), 500);
    startXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleBubbleTouchMove = (e) => {
    clearTimeout(longPressTimer.current);
    const deltaX = e.touches[0].clientX - startXRef.current;
    if (deltaX > 0) setSwipeX(Math.min(deltaX, 60));
  };

  const handleBubbleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    setIsSwiping(false);
    if (swipeX >= 40 && !msg.parent_message_id) {
      onOpenThread(msg);
    }
    setSwipeX(0);
  };

  if (msg.message_type === "event") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <EventCard msg={msg} />
      </div>
    );
  }

  const rawDate = msg.created_date;
  const timestamp = rawDate
    ? new Date(rawDate.endsWith("Z") ? rawDate : rawDate + "Z")
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;
  const isPhoto = /^!\[photo\]\((.+)\)$/.test(msg.content_text?.trim());

  // Group reactions by emoji
  const reactionGroups = reactions.reduce((acc, r) => {
    acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
    return acc;
  }, {});

  const swipeProgress = Math.min(swipeX / 40, 1); // 0–1 as user approaches threshold

  return (
    <div
      className={`relative flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[80%] ${isOwn ? "self-end" : "self-start"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Sender info — shown for others only */}
      {!isOwn && (
        <div className="flex items-center gap-1.5 mb-0.5 pl-1">
          <div className="w-5 h-5 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0 flex items-center justify-center">
            {msg.sender_avatar
              ? <img src={msg.sender_avatar} alt="" className="w-full h-full object-cover" />
              : <span className="text-[9px] font-bold text-primary">{(msg.sender_name || "?")[0].toUpperCase()}</span>
            }
          </div>
          <span className="text-[11px] font-semibold text-foreground">{msg.sender_name}</span>
          {timestamp && <span className="text-[10px] text-muted-foreground">{timestamp}</span>}
        </div>
      )}

      {/* Swipe reveal indicator (behind bubble) */}
      {swipeX > 0 && !msg.parent_message_id && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 flex items-center justify-center"
          style={{ opacity: swipeProgress, transform: `translateY(-50%) scale(${0.7 + 0.3 * swipeProgress})` }}
        >
          <CornerUpLeft className="w-4 h-4 text-primary" />
        </div>
      )}

      {/* Bubble + hover action */}
      <div
        className="relative"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {isPhoto ? (
          <div
            className={`rounded-2xl overflow-hidden ${msg.isPending ? "opacity-60" : "opacity-100"}`}
            onTouchStart={handleBubbleTouchStart}
            onTouchMove={handleBubbleTouchMove}
            onTouchEnd={handleBubbleTouchEnd}
          >
            <img
              src={msg.content_text.match(/^!\[photo\]\((.+)\)$/)[1]}
              alt="photo"
              className="max-w-[220px] max-h-[300px] object-cover rounded-2xl"
            />
          </div>
        ) : (
          <div
            onTouchStart={handleBubbleTouchStart}
            onTouchMove={handleBubbleTouchMove}
            onTouchEnd={handleBubbleTouchEnd}
            className={`px-4 py-2 text-sm leading-relaxed break-words select-none
              ${isOwn
                ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
                : "bg-muted text-foreground rounded-2xl rounded-tl-sm"
              }
              ${msg.isPending ? "opacity-60" : "opacity-100"}`}
          >
            {msg.content_text}
          </div>
        )}

        {/* Hover: Reply in Thread button (desktop) */}
        {hovered && !msg.parent_message_id && (
          <button
            onClick={() => onOpenThread(msg)}
            className={`absolute -top-3 ${isOwn ? "-left-8" : "-right-8"} 
              bg-card border border-border shadow-md rounded-full p-1.5 
              text-muted-foreground hover:text-primary hover:border-primary/40 
              transition-colors z-10`}
            title="Reply in thread"
          >
            <MessageSquareText className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Emoji picker (long-press) */}
        {showPicker && (
          <EmojiReactionPicker
            isOwn={isOwn}
            onSelect={(emoji) => onReact(msg.id, emoji)}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* Reaction badges */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-0.5 px-1">
          {Object.entries(reactionGroups).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => onReact(msg.id, emoji)}
              className="flex items-center gap-0.5 bg-surface border border-border rounded-full px-1.5 py-0 text-[11px] leading-5 hover:bg-surface-hover transition-colors"
            >
              <span className="text-[13px]">{emoji}</span>
              {count > 1 && <span className="text-muted-foreground text-[10px]">{count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Timestamp for own messages */}
      {isOwn && timestamp && (
        <span className="text-[10px] text-muted-foreground mt-0.5 pr-1">{timestamp}</span>
      )}

      {/* Thread reply count */}
      {replyCount > 0 && !msg.parent_message_id && (
        <button
          onClick={() => onOpenThread(msg)}
          className="text-xs text-primary font-semibold mt-1 hover:underline cursor-pointer pl-1"
        >
          💬 {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </button>
      )}
    </div>
  );
}

export default function ChatCanvas({ channelId, onOpenThread }) {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const myId = user?.id || user?.email;
  const topSentinelRef = useRef(null);
  const queryClient = useQueryClient();
  const [isMuted, setIsMuted] = useState(false);
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
    onSuccess: (ch) => setIsMuted(ch?.is_muted || false),
  });

  const toggleMuteMutation = useMutation({
    mutationFn: (muted) => base44.entities.Channel.update(channelId, { is_muted: muted }),
    onSuccess: () => {
      setIsMuted(!isMuted);
      queryClient.invalidateQueries({ queryKey: ["channel", channelId] });
    },
  });

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
      return { messages: res.data?.messages || [], hasMore: res.data?.has_more ?? false };
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

  const handleTouchStart = (e) => {
    const container = scrollContainerRef.current;
    // Only trigger pull-to-refresh when scrolled to bottom (flex-col-reverse: bottom = scrollTop near 0)
    if (container && container.scrollTop <= 10) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) {
      setPullDistance(Math.min(dist, 80));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 50) {
      setIsPulling(true);
      await refetchMessages();
      setIsPulling(false);
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
  });

  // Build reactions map: messageId -> array of reactions
  const reactionsMap = reactions.reduce((acc, r) => {
    if (!acc[r.message_id]) acc[r.message_id] = [];
    acc[r.message_id].push(r);
    return acc;
  }, {});

  // Build a map of parent_message_id -> reply count for thread badges
  const replyCountMap = allMessages.reduce((acc, msg) => {
    if (msg.parent_message_id) {
      acc[msg.parent_message_id] = (acc[msg.parent_message_id] || 0) + 1;
    }
    return acc;
  }, {});

  // Only show top-level messages in the main canvas
  const topLevelMessages = allMessages.filter(msg => !msg.parent_message_id);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSearchParams({})}
            className="md:hidden p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {channel?.avatar_url && (
            <img src={channel.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
          )}
          <span className="font-semibold text-sm text-foreground">
            {channel?.name || "Loading…"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Alerts On/Off toggle */}
          {isSupported && permission !== "denied" && (
            <button
              onClick={isSubscribed ? unsubscribePush : subscribePush}
              disabled={pushLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-medium text-xs ${
                isSubscribed
                  ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
              }`}
            >
              {pushLoading ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isSubscribed ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Alerts On
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  Alerts Off
                </>
              )}
            </button>
          )}

          {/* Mute toggle */}
          <button
            onClick={() => toggleMuteMutation.mutate(!isMuted)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
              isMuted
                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-surface"
            }`}
          >
            {isMuted ? (
              <>
                <BellOff className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Mute On</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span className="text-xs">Mute</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages — flex-col-reverse keeps latest at bottom */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
          <div className="flex justify-center py-8">
            <p className="text-sm text-muted-foreground">No messages yet. Say hello! 👋</p>
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
            {topLevelMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_user_id === myId}
                onOpenThread={onOpenThread || (() => {})}
                replyCount={replyCountMap[msg.id] || 0}
                reactions={reactionsMap[msg.id] || []}
                onReact={(messageId, emoji) => reactMutation.mutate({ messageId, emoji })}
              />
            ))}
          </>
        )}
      </div>

      {/* Composer */}
      <Composer channelId={channelId} channel={channel} />
    </div>
  );
}