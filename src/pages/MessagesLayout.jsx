import React from "react";
import { useSearchParams } from "react-router-dom";
import ChatSidebar from "@/components/messages/ChatSidebar";

export default function MessagesLayout() {
  const [searchParams] = useSearchParams();
  const activeChannelId = searchParams.get("channelId");

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* Left Pane — Sidebar */}
      <div className={`w-full md:w-80 flex-shrink-0 border-r border-border bg-card flex flex-col ${activeChannelId ? "hidden md:flex" : "flex"}`}>
        <ChatSidebar activeChannelId={activeChannelId} />
      </div>

      {/* Right Pane — Canvas */}
      <div className={`flex-1 flex-col min-w-0 bg-background ${!activeChannelId ? "hidden md:flex" : "flex"}`}>
        {activeChannelId ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {/* ChatCanvas will be mounted here */}
            Chat canvas coming soon…
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}