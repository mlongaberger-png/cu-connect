import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Lock, ImagePlus, Loader2, Trash2, Check, X } from "lucide-react";

const ICON_OPTIONS = [
  { group: "Sports", icons: ["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🏊","🏋️","🤸","🏇","⛷️","🏌️","🥊","🏒","🎿","🏑","🥅","🏟️"] },
  { group: "Volunteer & Events", icons: ["🙋","🤝","🎽","📋","🧢","🍕","🥤","🍉","🍪","🎉","📣","🚗","🏕️","🎪","📸","🎤","🎯","🗓️","📢","💪"] },
  { group: "General", icons: ["⭐","🔥","💬","📌","🏆","🎖️","👋","🌟","💡","📣","🔔","✅","🎁","🛡️","🦁","🌊","❤️","🤩","👏","🙌"] },
];

/**
 * ChannelEditModal — full-featured admin editor for any channel type
 * Props:
 *   channel: { id, name, type, icon, is_private?, allowed_roles?, allowed_emails?, description?, isPrivate? }
 *   open: boolean
 *   onOpenChange: (open) => void
 *   onDeleted?: () => void  — called after successful room deletion
 */
export default function ChannelEditModal({ channel, open, onOpenChange, onDeleted }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [form, setForm] = useState(null);

  // Reset form when channel changes or modal opens
  useEffect(() => {
    if (!channel || !open) return;
    setForm({
      name: channel.name || "",
      description: channel.description || "",
      icon: channel.icon || "",
      is_private: channel.is_private || channel.isPrivate || false,
      allowed_roles: channel.allowed_roles || "",
      allowed_emails: channel.allowed_emails || "",
    });
    setShowIconPicker(false);
    setDeleteConfirm(false);
  }, [channel, open]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { name: form.name.trim(), icon: form.icon };
      if (channel.type === "room") {
        payload.description = form.description;
        payload.is_private = form.is_private;
        payload.allowed_roles = form.allowed_roles;
        payload.allowed_emails = form.allowed_emails;
        return base44.entities.MessageRoom.update(channel.id, payload);
      }
      if (channel.type === "sport") return base44.entities.Sport.update(channel.id, payload);
      if (channel.type === "team") return base44.entities.Team.update(channel.id, { name: form.name.trim(), icon: form.icon, practice_location: channel.practice_location });
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["message-room-single", channel.id] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (channel.type === "room") return base44.entities.MessageRoom.delete(channel.id);
      if (channel.type === "sport") return base44.entities.Sport.delete(channel.id);
      if (channel.type === "team") return base44.entities.Team.delete(channel.id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      onOpenChange(false);
      onDeleted?.();
    },
  });

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, icon: file_url }));
      setShowIconPicker(false);
    } finally {
      setUploadingIcon(false);
      e.target.value = "";
    }
  };

  if (!form || !channel) return null;

  const iconIsUrl = form.icon && (form.icon.startsWith("http://") || form.icon.startsWith("https://"));
  const typeLabel = channel.type === "room" ? "Room" : channel.type === "sport" ? "Sport" : "Team";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-sm w-full">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">Edit {typeLabel}: {channel.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Icon picker area */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setShowIconPicker(p => !p)}
              className="w-14 h-14 rounded-xl border-2 border-border bg-surface flex items-center justify-center flex-shrink-0 overflow-hidden hover:border-primary/50 transition-colors"
            >
              {uploadingIcon ? (
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              ) : iconIsUrl ? (
                <img src={form.icon} alt="" className="w-full h-full object-cover" />
              ) : form.icon ? (
                <span className="text-2xl leading-none">{form.icon}</span>
              ) : (
                <span className="text-muted-foreground text-xs text-center leading-tight">No icon</span>
              )}
            </button>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <ImagePlus className="w-4 h-4" /> Upload Photo
              </button>
              <button
                onClick={() => setShowIconPicker(p => !p)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                😀 Pick Emoji
              </button>
              {form.icon && (
                <button
                  onClick={() => setForm(f => ({ ...f, icon: "" }))}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
          </div>

          {/* Emoji picker grid */}
          {showIconPicker && (
            <div className="border border-border rounded-xl bg-surface p-3 space-y-2 max-h-48 overflow-y-auto">
              {ICON_OPTIONS.map(group => (
                <div key={group.group}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{group.group}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.icons.map(icon => (
                      <button
                        key={icon}
                        onClick={() => { setForm(f => ({ ...f, icon })); setShowIconPicker(false); }}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-primary/20 transition-colors ${form.icon === icon ? "bg-primary/30 ring-1 ring-primary" : ""}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Channel Name</label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="bg-surface border-border"
              placeholder="Channel name"
            />
          </div>

          {/* Room-specific fields */}
          {channel.type === "room" && (
            <>
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">Description</label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="bg-surface border-border"
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Visibility</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!form.is_private}
                      onChange={() => setForm(f => ({ ...f, is_private: false }))}
                      className="accent-primary"
                    />
                    <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground">Public</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_private}
                      onChange={() => setForm(f => ({ ...f, is_private: true }))}
                      className="accent-primary"
                    />
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground">Private</span>
                  </label>
                </div>
              </div>

              {form.is_private && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Allowed Roles (JSON array)</label>
                    <Input
                      value={form.allowed_roles}
                      onChange={e => setForm(f => ({ ...f, allowed_roles: e.target.value }))}
                      className="bg-surface border-border text-sm"
                      placeholder='e.g. ["admin","coach"]'
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Allowed Emails (JSON array)</label>
                    <Input
                      value={form.allowed_emails}
                      onChange={e => setForm(f => ({ ...f, allowed_emails: e.target.value }))}
                      className="bg-surface border-border text-sm"
                      placeholder='e.g. ["user@email.com"]'
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border">
            {deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Confirm delete?</span>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  {deleteMutation.isPending ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="text-xs px-2 py-1 rounded bg-surface text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(true)}
                className="text-red-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete {typeLabel}
              </Button>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-border">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!form.name.trim() || saveMutation.isPending || uploadingIcon}
                className="bg-primary text-primary-foreground gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}