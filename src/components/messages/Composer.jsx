import React, { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SendHorizonal, Image, Car } from "lucide-react";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";

export default function Composer({ channelId, channel }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showCarpool, setShowCarpool] = useState(false);
  const textareaRef = useRef(null);

  const isBroadcastOnly = channel?.is_broadcast_only && user?.role === "parent";

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
    onError: () => {
      // Rollback handled by invalidate
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    },
  });

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    const myId = user?.id || user?.email;
    const tempMsg = {
      id: `temp-${Date.now()}`,
      channel_id: channelId,
      sender_user_id: myId,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: text,
      message_type: "text",
      created_at: new Date().toISOString(),
      isPending: true,
    };

    const capturedText = text;
    setText("");

    await queryClient.cancelQueries({ queryKey: ["messages", channelId] });
    queryClient.setQueryData(["messages", channelId], (old) => {
      if (!old) return old;
      const newPages = [...old.pages];
      newPages[0] = [tempMsg, ...(newPages[0] || [])];
      return { ...old, pages: newPages };
    });

    sendMutation.mutate({
      channel_id: channelId,
      sender_user_id: myId,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: capturedText,
      message_type: "text",
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isBroadcastOnly) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-muted border-t border-border">
        📢 This is a read-only channel
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSend}
      className="border-t border-border bg-card p-3 flex gap-2 items-end"
    >
      <button
        type="button"
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0"
      >
        <Image className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setShowCarpool(true)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0"
      >
        <Car className="w-4 h-4" />
      </button>

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message…"
        className="flex-1 min-h-[40px] max-h-[120px] resize-none overflow-y-auto py-2 bg-background text-sm"
        rows={1}
      />

      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || sendMutation.isPending}
        className="shrink-0 h-9 w-9"
      >
        <SendHorizonal className="w-4 h-4" />
      </Button>
      <CarpoolRequestModal open={showCarpool} onOpenChange={setShowCarpool} />
    </form>
  );
}