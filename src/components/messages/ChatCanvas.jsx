import React, { useRef, useEffect, useCallback, useState } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { BellOff, Bell, ArrowLeft } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import Composer from "./Composer";
import EventCard from "./cards/EventCard";

async function subscribeToNativePush(userEmail, userId) {
  try {
    const permResult = await Notification.requestPermission();
    if (permResult !== "granted") return false;

    // Fetch VAPID public key from backend
    const res = await base44.functions.invoke("getPushConfig", {});
    const vapidPublicKey = res?.data?.publicKey;
    if (!vapidPublicKey) return false;

    const registration = await navigator.serviceWorker.ready;

    // Convert base64 VAPID key to Uint8Array
    const urlBase64ToUint8Array = (base64String) => {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
    };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subJson = subscription.toJSON();
    await base44.entities.PushSubscription.create({
      user_email: userEmail,
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh_key: subJson.keys?.p256dh,
      auth_key: subJson.keys?.auth,
      is_active: true,
      device_type: "web",
    });

    localStorage.setItem("alerts_enabled", "true");
    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

function MessageBubble({ msg, isOwn }) {
  if (msg.message_type === "event") {
    return (
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
        <EventCard msg={msg} />
      </div>
    );
  }

  const timestamp = msg.created_date ? format(new Date(msg.created_date), "h:mm a") : null;

  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[80%] ${isOwn ? "self-end" : "self-start"}`}>
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

      {/* Bubble */}
      {/^!\[photo\]\((.+)\)$/.test(msg.content_text?.trim()) ? (
        <div className={`rounded-2xl overflow-hidden ${msg.isPending ? "opacity-60" : "opacity-100"}`}>
          <img
            src={msg.content_text.match(/^!\[photo\]\((.+)\)$/)[1]}
            alt="photo"
            className="max-w-[220px] max-h-[300px] object-cover rounded-2xl"
          />
        </div>
      ) : (
        <div
          className={`px-4 py-2 text-sm leading-relaxed break-words
            ${isOwn
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
              : "bg-muted text-foreground rounded-2xl rounded-tl-sm"
            }
            ${msg.isPending ? "opacity-60" : "opacity-100"}`}
        >
          {msg.content_text}
        </div>
      )}

      {/* Timestamp for own messages */}
      {isOwn && timestamp && (
        <span className="text-[10px] text-muted-foreground mt-0.5 pr-1">{timestamp}</span>
      )}
    </div>
  );
}

export default function ChatCanvas({ channelId }) {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const myId = user?.id || user?.email;
  const topSentinelRef = useRef(null);
  const queryClient = useQueryClient();
  const [isMuted, setIsMuted] = useState(false);
  const [alertsOn, setAlertsOn] = useState(() => localStorage.getItem("alerts_enabled") === "true");

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
  } = useInfiniteQuery({
    queryKey: ["messages", channelId],
    queryFn: async ({ pageParam = 0 }) => {
      const msgs = await base44.entities.Message.filter(
        { channel_id: channelId },
        "-created_at",
        50
      );
      // Simple offset pagination
      return msgs.slice(pageParam, pageParam + 50);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < 50) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: !!channelId,
  });

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

  const allMessages = data?.pages.flat() ?? [];

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
          <button
            onClick={async () => {
              if (!alertsOn) {
                const success = await subscribeToNativePush(user?.email, myId);
                if (success) setAlertsOn(true);
              } else {
                localStorage.setItem("alerts_enabled", "false");
                setAlertsOn(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${
              alertsOn
                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-surface"
            }`}
          >
            {alertsOn ? (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">Alerts On</span>
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5" />
                <span className="text-xs">Alerts Off</span>
              </>
            )}
          </button>

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
      <div className="flex-1 overflow-y-auto p-4 flex flex-col-reverse gap-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : allMessages.length === 0 ? (
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
            {allMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_user_id === myId}
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