import React, { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch current user full profile to pass into the Carpool Modal
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // Fetch teams for the carpool modal context
  const { data: myTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const isBroadcastOnly = channel?.is_broadcast_only && user?.role === "parent";

  const shortName = channel?.name?.slice(0, 30) ?? "";
  const placeholder =
    channel?.type === "direct"
      ? `Message ${shortName}…`
      : shortName
        ? `Message #${shortName}…`
        : "Message…";

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sendMutation.mutate({
      channel_id: channelId,
      sender_user_id: user?.id || user?.email,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: `![photo](${file_url})`,
      message_type: "text",
    });
    setUploading(false);
    e.target.value = "";
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    const capturedText = text;
    setText("");
    sendMutation.mutate({
      channel_id: channelId,
      sender_user_id: user?.id || user?.email,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: capturedText,
      message_type: "text",
    });
  };

  if (isBroadcastOnly) return <div className="p-4 text-center text-sm text-muted-foreground bg-muted border-t border-border">📢 Read-only channel</div>;

  return (
    <form onSubmit={handleSend} className="border-t border-border bg-card p-3 flex gap-2 items-end" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Photo Upload */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0 disabled:opacity-50">
        <Image className="w-4 h-4" />
      </button>

      {/* Carpool Button */}
      <button type="button" onClick={() => setShowCarpool(true)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors shrink-0">
        <Car className="w-4 h-4" />
      </button>

      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder={placeholder}
        className="flex-1 min-h-[40px] max-h-[120px] resize-none overflow-y-auto py-2 bg-background text-sm"
        rows={1}
      />

      <Button type="submit" size="icon" disabled={!text.trim() || sendMutation.isPending} className="shrink-0 h-9 w-9">
        <SendHorizonal className="w-4 h-4" />
      </Button>

      {/* FIXED: Now passing necessary props so the modal knows who the user is */}
      <CarpoolRequestModal 
        open={showCarpool} 
        onOpenChange={setShowCarpool} 
        currentUser={currentUser}
        myTeams={myTeams}
        myTeamIds={myTeams.map(t => t.id)}
      />
    </form>
  );
}