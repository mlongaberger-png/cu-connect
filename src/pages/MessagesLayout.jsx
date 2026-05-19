import React from "react";
import { useSearchParams } from "react-router-dom";
import MessagingTermsGate from "@/components/messages/MessagingTermsGate";
import ChatSidebar from "@/components/messages/ChatSidebar";
import ChatCanvas from "@/components/messages/ChatCanvas";
import EmptyState from "@/components/messages/EmptyState";

export default function MessagesLayout() {
  const [searchParams] = useSearchParams();
  const channelId = searchParams.get("channelId");

  return (
    <MessagingTermsGate>
      <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background text-foreground">
        {/* Left Pane — Sidebar */}
        <div className={`flex-shrink-0 border-r border-border bg-card w-full md:w-80 flex-col ${channelId ? "hidden md:flex" : "flex"}`}>
          <ChatSidebar activeChannelId={channelId} />
        </div>

        {/* Right Pane — Canvas */}
        <div className={`flex-1 flex-col min-w-0 bg-background ${!channelId ? "hidden md:flex" : "flex"}`}>
          {channelId
            ? <ChatCanvas channelId={channelId} />
            : <EmptyState text="Select a conversation to start messaging" />
          }
        </div>
      </div>
    </MessagingTermsGate>
  );
}