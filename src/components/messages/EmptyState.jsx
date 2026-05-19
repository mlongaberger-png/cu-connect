import React from "react";
import { MessageSquare } from "lucide-react";

export default function EmptyState({ text = "Select a conversation to start messaging" }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <MessageSquare className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground text-sm">{text}</p>
    </div>
  );
}