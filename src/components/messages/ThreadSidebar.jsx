import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { X, SendHorizonal } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function ThreadMessage({ msg, isOwn }) {
  const timestamp = msg.created_date ? format(new Date(msg.created_date), "h:mm a") : null;
  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
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
      <div className={`px-3 py-2 text-sm leading-relaxed break-words max-w-[85%]
        ${isOwn
          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm"
          : "bg-muted text-foreground rounded-2xl rounded-tl-sm"
        }`}
      >
        {msg.content_text}
      </div>
      {isOwn && timestamp && (
        <span className="text-[10px] text-muted-foreground mt-0.5 pr-1">{timestamp}</span>
      )}
    </div>
  );
}

export default function ThreadSidebar({ parentMessage, channelId, onClose }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const myId = user?.id || user?.email;
  const parentTimestamp = parentMessage?.created_date
    ? format(new Date(parentMessage.created_date), "MMM d, h:mm a")
    : null;

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["thread-replies", parentMessage?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMessagesFiltered', {
        channel_id: channelId,
        parent_message_id: parentMessage.id,
        limit: 100,
        sort: "created_date",
      });
      return res.data?.messages || [];
    },
    enabled: !!parentMessage?.id,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["thread-replies", parentMessage?.id] });
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    const capturedText = text;
    setText("");
    sendMutation.mutate({
      channel_id: channelId,
      parent_message_id: parentMessage.id,
      sender_user_id: user?.id || user?.email,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: capturedText,
      message_type: "text",
    });
  };

  return (
    <div className="w-full md:w-96 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="font-semibold text-sm text-foreground">Thread</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Pinned parent message */}
        <div className="bg-primary/5 border-b border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0 flex items-center justify-center">
              {parentMessage.sender_avatar
                ? <img src={parentMessage.sender_avatar} alt="" className="w-full h-full object-cover" />
                : <span className="text-[9px] font-bold text-primary">{(parentMessage.sender_name || "?")[0].toUpperCase()}</span>
              }
            </div>
            <span className="text-xs font-semibold text-foreground">{parentMessage.sender_name}</span>
            {parentTimestamp && <span className="text-[10px] text-muted-foreground">{parentTimestamp}</span>}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{parentMessage.content_text}</p>
        </div>

        {/* Replies */}
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : replies.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No replies yet. Start the thread!</p>
          ) : (
            replies.map(msg => (
              <ThreadMessage
                key={msg.id}
                msg={msg}
                isOwn={msg.sender_user_id === myId || msg.sender_user_id === user?.email}
              />
            ))
          )}
        </div>
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t border-border bg-card p-3 flex gap-2 items-end shrink-0">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Reply in thread…"
          className="flex-1 min-h-[40px] max-h-[100px] resize-none overflow-y-auto py-2 bg-background text-sm"
          rows={1}
        />
        <Button type="submit" size="icon" disabled={!text.trim() || sendMutation.isPending} className="shrink-0 h-9 w-9">
          <SendHorizonal className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}