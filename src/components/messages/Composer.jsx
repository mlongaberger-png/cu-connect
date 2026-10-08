import React, { useState, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Image, Car, Plus, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useKeyboard, dismissKeyboard } from "@/hooks/useKeyboard";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";

export default function Composer({ channelId, channel, channelDisplayName }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [showCarpool, setShowCarpool] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const keyboard = useKeyboard();

  // Fetch current user full profile to pass into the Carpool Modal
  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // Fetch teams for the carpool modal context
  const { data: orgTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Same scoping bug/fix as ChatSidebar.jsx's carpoolTeams (see that file's comment) --
  // orgTeams above is every team in the org, unscoped. Composer has its own separate
  // "Request a Ride" entry point (the car icon), so it needs the same parent-vs-staff
  // scoping independently rather than relying on ChatSidebar having already fixed it.
  const isScopedRole = ["parent", "grandparent", "relative"].includes(user?.role);
  const { data: myPlayers = [] } = useQuery({
    queryKey: ["my-players-guardian", user?.email],
    queryFn: async () => {
      const res = await base44.functions.invoke("getMyPlayers", {});
      return res.data?.players || [];
    },
    enabled: isScopedRole,
  });
  const { data: myAthletePlayers = [] } = useQuery({
    queryKey: ["my-players-by-athlete-email", user?.email],
    queryFn: () => base44.entities.Player.filter({ athlete_email: user.email }),
    enabled: user?.role === "athlete",
  });
  const allowedTeamIds = new Set([
    ...myPlayers.map(p => p.team_id).filter(Boolean),
    ...myAthletePlayers.map(p => p.team_id).filter(Boolean),
  ]);
  const myTeams = (isScopedRole || user?.role === "athlete")
    ? orgTeams.filter(t => allowedTeamIds.has(t.id))
    : orgTeams;

  // Staff (admin/AD/coach) can post into a broadcast-only announcement channel; every
  // other role (parent/grandparent/athlete/etc.) is read-only. Previously this only
  // checked role === "parent", so grandparent/athlete/relative viewers of the same
  // announcement channel could still reply even though parents on the same channel couldn't.
  const isStaffRole = ["admin", "athletic_director", "coach"].includes(user?.role);
  const isBroadcastOnly = channel?.is_broadcast_only && !isStaffRole;

  // Same per-viewer name bug as ChatSidebar.jsx/ChatCanvas.jsx's header: a direct channel's
  // stored `channel.name` is only correct from whoever created the DM, so this placeholder
  // used to read "Message matthew longaberger…" for the recipient of a DM they didn't start.
  // ChatCanvas.jsx already resolves the correct per-viewer name (channelDisplayName) once and
  // passes it down -- fall back to channel.name for non-direct channels, which are shared/
  // symmetric and don't have this problem.
  const shortName = (channelDisplayName ?? channel?.name)?.slice(0, 30) ?? "";
  const placeholder =
    channel?.type === "direct"
      ? `Message ${shortName}`
      : shortName
        ? `Message ${shortName}`
        : "Message…";

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      sendMutation.mutate({
        channel_id: channelId,
        sender_user_id: user?.id || user?.email,
        sender_name: user?.full_name || user?.email,
        sender_avatar: user?.profile_photo_url || "",
        content_text: `![photo](${file_url})`,
        message_type: "text",
      });
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    const capturedText = text;
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMutation.mutate({
      channel_id: channelId,
      sender_user_id: user?.id || user?.email,
      sender_name: user?.full_name || user?.email,
      sender_avatar: user?.profile_photo_url || "",
      content_text: capturedText,
      message_type: "text",
    });
  };

  if (isBroadcastOnly) return <div className="p-4 text-center text-sm text-muted-foreground bg-card border-t border-border">Only coaches and admins can post in this channel.</div>;

  const canSend = !!text.trim() && !sendMutation.isPending;

  return (
    <div className="shrink-0 bg-background">
      {/* While typing on a phone: a bar right above the keyboard with an obvious way out
          (Done), plus the hint that tapping or swiping down on the chat also closes it. */}
      {keyboard.open && (
        <div className="lg:hidden flex items-center justify-between h-11 pl-4 pr-2 bg-card border-t border-border">
          <span className="text-[13px] text-muted-foreground">Tap the chat or swipe down to close</span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={dismissKeyboard}
            className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-primary font-bold text-base"
          >
            <ChevronDown className="w-4 h-4" /> Done
          </button>
        </div>
      )}
      <form onSubmit={handleSend} className="border-t border-border px-3 py-2 flex gap-2 items-end">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={uploading}
              aria-label="Add photo or ride request"
              className="w-11 h-11 rounded-full bg-surface text-primary flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              {uploading
                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Plus className="w-5 h-5" strokeWidth={2.5} />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="bg-popover border-border">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer py-2.5">
              <Image className="w-4 h-4" /> Photo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCarpool(true)} className="gap-2 cursor-pointer py-2.5">
              <Car className="w-4 h-4" /> Request a ride
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            // grow with the text, up to max-h
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          enterKeyHint="send"
          className="flex-1 min-h-[44px] max-h-[120px] resize-none overflow-y-auto rounded-[22px] px-4 py-[10px] bg-surface border-border text-base md:text-sm leading-snug focus-visible:ring-1 focus-visible:ring-primary"
          rows={1}
        />

        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          onMouseDown={(e) => e.preventDefault()}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            canSend ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"
          }`}
        >
          <ArrowUp className="w-5 h-5" strokeWidth={2.6} />
        </button>

        <CarpoolRequestModal
          open={showCarpool}
          onOpenChange={setShowCarpool}
          currentUser={currentUser}
          myTeams={myTeams}
          myTeamIds={myTeams.map(t => t.id)}
        />
      </form>
    </div>
  );
}