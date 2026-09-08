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

  // Was two separate ternaries concatenated (`${!channelId ? "hidden md:flex" : "flex"}
  // ${activeThreadParent ? "hidden lg:flex" : ""}`), which meant an unprefixed "flex" AND an
  // unprefixed "hidden" could both land on the same element at once whenever a channel was
  // open with its Thread also open. Two same-specificity display utilities on one element is
  // decided by which rule Tailwind happens to emit LATER in the compiled stylesheet, not by
  // the order the class names appear in this string -- fragile, and something a future
  // Tailwind/build change could silently flip. Rewritten as a single exclusive conditional so
  // exactly one display utility is ever applied per breakpoint, with the same intended result:
  // hidden entirely with no channel open (until md), always visible with a channel open and no
  // thread, and hidden below lg specifically while the Thread pane is open (so Thread can take
  // the full mobile/tablet width without the canvas fighting it for space underneath).
  const canvasVisibilityClass = !channelId
    ? "hidden md:flex"
    : activeThreadParent
      ? "hidden lg:flex"
      : "flex";

  return (
    <MessagingTermsGate>
      <div className="flex h-[calc(100dvh-4rem-56px)] min-h-0 w-full overflow-hidden bg-background text-foreground">
        {/* Left Pane — Sidebar */}
        <div className={`flex-shrink-0 min-h-0 border-r border-border bg-card w-full md:w-80 flex-col ${channelId ? "hidden md:flex" : "flex"}`}>
          <ChatSidebar activeChannelId={channelId} />
        </div>

        {/* Center Pane — Canvas */}
        <div className={`flex-1 min-h-0 flex-col min-w-0 bg-background ${canvasVisibilityClass}`}>
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