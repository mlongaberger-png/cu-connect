import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { X } from "lucide-react";

/**
 * Global in-app message notifier.
 *
 * Subscribes to Message realtime events and shows a banner the instant a new
 * message lands in a channel the user belongs to (and isn't currently viewing),
 * no matter which page they're on. Clicking the banner jumps to that channel.
 *
 * This is a CLIENT-SIDE UI notification only — it fires independently of, and in
 * addition to, the server-side email + OS web-push dispatch in `onMessageCreated`.
 * It does NOT consult NotificationPreference.messages_method: the in-app banner
 * is always shown for eligible messages (own messages and the active channel
 * are suppressed).
 */
export default function MessageNotifier() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const myId = user?.id || user?.email;
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState(null);
  const lastSeenMessageId = useRef(null);
  const channelsRef = useRef([]);
  const membershipsRef = useRef(new Set());

  // All channels — for resolving the channel name shown in the banner
  const { data: allChannels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => base44.entities.Channel.list("-last_message_at"),
    enabled: !!user,
  });

  // The user's channel memberships — scopes the banner to channels they belong to
  const { data: myMemberships = [] } = useQuery({
    queryKey: ["channel-members", user?.email],
    queryFn: () => base44.entities.ChannelMember.filter({ user_email: user?.email }),
    enabled: !!user?.email,
    refetchInterval: () => (document.visibilityState === "hidden" ? false : 30000),
  });

  useEffect(() => { channelsRef.current = allChannels; }, [allChannels]);
  useEffect(() => {
    membershipsRef.current = new Set((myMemberships || []).map((m) => m.channel_id));
  }, [myMemberships]);

  // The channel the user is actively viewing (only meaningful on /Messages)
  const activeChannelId = location.pathname.startsWith("/Messages")
    ? new URLSearchParams(location.search).get("channelId")
    : null;

  useEffect(() => {
    if (!user) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.type && event.type !== "create") return;
      const msg = event.data;
      if (!msg || !msg.id) return;

      // Seed the dedupe ref on the first event so we never banner history
      if (!lastSeenMessageId.current) {
        lastSeenMessageId.current = msg.id;
        return;
      }
      if (msg.id === lastSeenMessageId.current) return;
      lastSeenMessageId.current = msg.id;

      // Never banner your own messages or the channel you're currently viewing
      const isOwn = msg.sender_user_id === myId || msg.sender_user_id === user?.email;
      if (isOwn) return;
      if (msg.channel_id === activeChannelId) return;

      // Only notify for channels the user is actually a member of
      if (!membershipsRef.current.has(msg.channel_id)) return;

      const channel = channelsRef.current.find((c) => c.id === msg.channel_id);
      const preview = (msg.content_text || "").replace(/^!\[photo\]\(.+\)$/, "📷 Photo");

      setBanner({
        ...msg,
        channel_name: channel?.name || "New message",
        content_text: preview,
      });

      // Refresh sidebar unread badges in real time
      queryClient.invalidateQueries({ queryKey: ["channel-members"] });
    });

    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, [user, myId, activeChannelId, queryClient]);

  // Auto-dismiss after 5s
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  if (!banner) return null;

  return (
    <div
      onClick={() => {
        navigate(`/Messages?channelId=${banner.channel_id}`);
        setBanner(null);
      }}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer
        bg-card border-2 border-primary/20 shadow-xl rounded-xl p-3
        flex items-center gap-3 w-80 max-w-[90vw]
        animate-in slide-in-from-top duration-300"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0 flex items-center justify-center">
        {banner.sender_avatar
          ? <img src={banner.sender_avatar} alt="" className="w-full h-full object-cover" />
          : <span className="text-sm font-bold text-primary">{(banner.sender_name || "?")[0].toUpperCase()}</span>}
      </div>

      {/* Channel name + sender + preview */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-primary truncate uppercase tracking-wide">{banner.channel_name}</p>
        <p className="text-sm font-bold text-foreground truncate">{banner.sender_name || "Someone"}</p>
        <p className="text-xs text-muted-foreground truncate">{banner.content_text}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); setBanner(null); }}
        className="text-muted-foreground hover:text-foreground shrink-0 p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}