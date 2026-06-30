import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import MessagingTermsGate from "@/components/messages/MessagingTermsGate";
import ChatSidebar from "@/components/messages/ChatSidebar";
import ChatCanvas from "@/components/messages/ChatCanvas";
import ThreadSidebar from "@/components/messages/ThreadSidebar";
import EmptyState from "@/components/messages/EmptyState";

export default function MessagesLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const channelId = searchParams.get("channelId");
  const { user } = useAuth();
  const [activeThreadParent, setActiveThreadParent] = useState(null);

  return (
    <MessagingTermsGate>
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