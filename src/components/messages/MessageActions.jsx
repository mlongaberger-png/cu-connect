import React, { useState } from "react";
import { Flag, UserX, MoreHorizontal, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function MessageActions({ msg, currentUser, channelId, channelName, onBlock }) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [reportReason, setReportReason] = useState("abusive");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // "reported" | "blocked"

  const isOwnMessage = msg.sender_email === currentUser?.email;
  if (isOwnMessage) return null;

  const handleReport = async () => {
    setSubmitting(true);
    await base44.entities.MessageReport.create({
      message_id: msg.id,
      message_content: msg.content,
      reported_sender_email: msg.sender_email,
      reported_sender_name: msg.sender_name,
      reporter_email: currentUser.email,
      reporter_name: currentUser.full_name || currentUser.email,
      channel_id: channelId,
      channel_name: channelName,
      reason: reportReason,
      status: "pending",
    });
    setSubmitting(false);
    setShowReportDialog(false);
    setDone("reported");
    setTimeout(() => setDone(null), 3000);
  };

  const handleBlock = async () => {
    setSubmitting(true);
    // Check if already blocked
    const existing = await base44.entities.BlockedUser.filter({
      blocker_email: currentUser.email,
      blocked_email: msg.sender_email,
    });
    if (existing.length === 0) {
      await base44.entities.BlockedUser.create({
        blocker_email: currentUser.email,
        blocked_email: msg.sender_email,
        blocked_name: msg.sender_name || msg.sender_email,
      });
    }
    setSubmitting(false);
    setShowBlockDialog(false);
    setDone("blocked");
    setTimeout(() => setDone(null), 3000);
    if (onBlock) onBlock(msg.sender_email);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface transition-all flex-shrink-0"
            aria-label="Message options"
          >
            {done === "reported" ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : done === "blocked" ? (
              <Check className="w-3.5 h-3.5 text-orange-400" />
            ) : (
              <MoreHorizontal className="w-3.5 h-3.5" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-popover border-border w-44">
          <DropdownMenuItem
            onClick={() => setShowReportDialog(true)}
            className="gap-2 text-orange-400 focus:text-orange-400 focus:bg-orange-500/10 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" /> Flag Message
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={() => setShowBlockDialog(true)}
            className="gap-2 text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
          >
            <UserX className="w-3.5 h-3.5" /> Block User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-orange-400" /> Flag Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-surface rounded-xl border border-border text-sm text-muted-foreground italic break-words max-h-24 overflow-y-auto">
              "{msg.content}"
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Reason for report</p>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="abusive">Abusive or threatening</SelectItem>
                  <SelectItem value="harassment">Harassment or bullying</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">This report is private. Administrators will review it within 24 hours.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setShowReportDialog(false)}>Cancel</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleReport} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-red-400" /> Block User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to block <span className="font-semibold text-foreground">{msg.sender_name || msg.sender_email}</span>? Their messages will be hidden from your view immediately.
            </p>
            <p className="text-xs text-muted-foreground">This action is private and will not notify other users. You can unblock users in your account settings.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={handleBlock} disabled={submitting}>
                {submitting ? "Blocking…" : "Block User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}