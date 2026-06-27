import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      onClick={onOpen}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 cursor-pointer
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

      {/* Text */}
      <div className="flex-1 min-w-0">
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
  const [banner, setBanner] = useState(null);
  const [activeThreadParent, setActiveThreadParent] = useState(null);
  const lastSeenMessageId = useRef(null);

  // Poll latest messages across all channels to detect new ones
  const { data: latestMessages = [] } = useQuery({
    queryKey: ["global-latest-messages"],
    queryFn: () => base44.entities.Message.list("-created_date", 5),
    refetchInterval: 15000,
    staleTime: 10000,
    enabled: !!user && localStorage.getItem("alerts_enabled") === "true",
  });

  useEffect(() => {
    if (!latestMessages.length || !myId) return;
    const newest = latestMessages[0];

    // Skip on first load — just seed the ref
    if (!lastSeenMessageId.current) {
      lastSeenMessageId.current = newest.id;
      return;
    }

    // Already seen this one
    if (newest.id === lastSeenMessageId.current) return;
    lastSeenMessageId.current = newest.id;

    const alertsEnabled = localStorage.getItem("alerts_enabled") === "true";
    const isOwnMessage = newest.sender_user_id === myId || newest.sender_user_id === user?.email;
    const isActiveChannel = newest.channel_id === channelId;

    if (alertsEnabled && !isOwnMessage && !isActiveChannel) {
      setBanner(newest);
    }
  }, [latestMessages, myId, channelId, user?.email]);

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