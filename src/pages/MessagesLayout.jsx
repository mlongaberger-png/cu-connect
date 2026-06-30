import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import MessagingTermsGate from "@/components/messages/MessagingTermsGate";
import ChatSidebar from "@/components/messages/ChatSidebar";
import ChatCanvas from "@/components/messages/ChatCanvas";
import ThreadSidebar from "@/components/messages/ThreadSidebar";
import EmptyState from "@/components/messages/EmptyState";
import { X } from "lucide-react";

function InAppBanner({ message, onDismiss, onOpen }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      onClick={onOpen}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer
        bg-card border-2 border-primary/20 shadow-xl rounded-xl p-3 
        flex items-center gap-3 w-80 max-w-[90vw] 
        animate-in slide-in-from-top duration-300"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0 flex items-center justify-center">
        {message.sender_avatar
          ? <img src={message.sender_avatar} alt="" className="w-full h-full object-cover" />
          : <span className="text-sm font-bold text-primary">{(message.sender_name || "?")[0].toUpperCase()}</span>
        }
      </div>

      {/* Text — channel name + sender + preview */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-primary truncate uppercase tracking-wide">{message.channel_name || "New message"}</p>
        <p className="text-sm font-bold text-foreground truncate">{message.sender_name || "Someone"}</p>
        <p className="text-xs text-muted-foreground truncate">{message.content_text}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="text-muted-foreground hover:text-foreground shrink-0 p-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function MessagesLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const channelId = searchParams.get("channelId");
  const { user } = useAuth();
  const myId = user?.id || user?.email;
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState(null);
  const [activeThreadParent, setActiveThreadParent] = useState(null);
  const lastSeenMessageId = useRef(null);
  const channelsRef = useRef([]);

  // Cache all channels so we can resolve the channel name for the in-app banner.
  const { data: allChannels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => base44.entities.Channel.list("-last_message_at"),
    enabled: !!user,
  });
  useEffect(() => { channelsRef.current = allChannels; }, [allChannels]);

  // Realtime in-app notification: the instant a new message is created in any
  // channel other than the one currently open, show a banner and refresh the
  // sidebar unread badges. This is purely a client-side UI notification and
  // fires INDEPENDENTLY of email/push (handled server-side by onMessageCreated)
  // and of the NotificationPreference messages_method setting — both always fire.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = base44.entities.Message.subscribe((event) => {
      // Only react to brand-new messages
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

      // Don't notify for your own messages or the channel you're already viewing
      const isOwn = msg.sender_user_id === myId || msg.sender_user_id === user?.email;
      const isActiveChannel = msg.channel_id === channelId;
      if (isOwn || isActiveChannel) return;

      const channel = channelsRef.current.find(c => c.id === msg.channel_id);
      const preview = (msg.content_text || "").replace(/^!\[photo\]\(.+\)$/, "📷 Photo");

      setBanner({
        ...msg,
        channel_name: channel?.name || "New message",
        content_text: preview,
      });

      // Refresh channel-members so sidebar unread badges update in real time
      queryClient.invalidateQueries({ queryKey: ["channel-members"] });
    });

    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [user, myId, channelId, queryClient]);

  return (
    <MessagingTermsGate>
      {banner && (
        <InAppBanner
          message={banner}
          onDismiss={() => setBanner(null)}
          onOpen={() => {
            setSearchParams({ channelId: banner.channel_id });
            setBanner(null);
          }}
        />
      )}
      <div className="flex h-[calc(100dvh-4rem-56px)] min-h-0 w-full overflow-hidden bg-background text-foreground">
        {/* Left Pane — Sidebar */}
        <div className={`flex-shrink-0 min-h-0 border-r border-border bg-card w-full md:w-80 flex-col ${channelId ? "hidden md:flex" : "flex"}`}>
          <ChatSidebar activeChannelId={channelId} />
        </div>

        {/* Center Pane — Canvas */}
        <div className={`flex-1 min-h-0 flex-col min-w-0 bg-background ${!channelId ? "hidden md:flex" : "flex"} ${activeThreadParent ? "hidden lg:flex" : ""}`}>
          {channelId
            ? <ChatCanvas channelId={channelId} onOpenThread={setActiveThreadParent} />
            : <EmptyState text="Select a conversation to start messaging" />
          }
        </div>

        {/* Right Pane — Thread Sidebar */}
        {activeThreadParent && channelId && (
          <ThreadSidebar
            parentMessage={activeThreadParent}
            channelId={channelId}
            onClose={() => setActiveThreadParent(null)}
          />
        )}
      </div>
    </MessagingTermsGate>
  );
}