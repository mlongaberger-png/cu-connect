import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Bell, BellOff, Users } from "lucide-react";

// Chat settings (opened from the chat header). Replaces the old always-visible
// "Alerts On" / "Mute" header buttons: alerts for this phone, per-person mute,
// shared photos and the member list live here, GroupMe-style.
export default function ChatSettingsSheet({
  open, onOpenChange, channel, displayName, initials, subtitle, info, photos = [],
  push, muted, onSetMuted, mutePending,
}) {
  const members = info?.members || [];
  const shownMembers = members.slice(0, 12);
  const { isSupported, isSubscribed, pushLoading, permission, subscribePush, unsubscribePush } = push || {};

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-background border-border p-0 overflow-y-auto">
        <div className="safe-area-top" />
        <SheetHeader className="items-center text-center px-6 pt-8 pb-5 space-y-1.5">
          {channel?.avatar_url ? (
            <img src={channel.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <span className="w-20 h-20 rounded-full bg-primary text-primary-foreground text-2xl font-extrabold flex items-center justify-center">
              {initials}
            </span>
          )}
          <SheetTitle className="text-xl font-extrabold pt-1">{displayName}</SheetTitle>
          <SheetDescription className="text-sm">{subtitle}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-10 space-y-6">
          <section className="space-y-2">
            <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-muted-foreground">NOTIFICATIONS</h3>
            <div className="rounded-2xl bg-card border border-border divide-y divide-border">
              {isSupported && permission !== "denied" && (
                <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer">
                  <Bell className="w-5 h-5 text-primary shrink-0" />
                  <span className="flex-1 flex flex-col">
                    <span className="text-[15px] font-bold">Alerts on this device</span>
                    <span className="text-[13px] text-muted-foreground">Push notifications for CU Connect on this phone</span>
                  </span>
                  <Switch
                    checked={!!isSubscribed}
                    disabled={pushLoading}
                    onCheckedChange={(v) => (v ? subscribePush?.() : unsubscribePush?.())}
                    aria-label="Alerts on this device"
                  />
                </label>
              )}
              {permission === "denied" && (
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <BellOff className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="text-[13px] text-muted-foreground">
                    Notifications are turned off for CU Connect in your phone's Settings app.
                  </span>
                </div>
              )}
              <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer">
                <BellOff className="w-5 h-5 text-primary shrink-0" />
                <span className="flex-1 flex flex-col">
                  <span className="text-[15px] font-bold">Mute this chat</span>
                  <span className="text-[13px] text-muted-foreground">No notifications from {channel?.type === "direct" ? "this conversation" : "this chat"}. Unread counts still show.</span>
                </span>
                <Switch checked={!!muted} disabled={mutePending} onCheckedChange={(v) => onSetMuted?.(v)} aria-label="Mute this chat" />
              </label>
            </div>
          </section>

          {photos.length > 0 && (
            <section className="space-y-2">
              <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-muted-foreground">RECENT PHOTOS</h3>
              <div className="grid grid-cols-4 gap-1.5">
                {photos.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="aspect-square rounded-xl overflow-hidden bg-card">
                    <img src={src} alt="Shared in this chat" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {channel?.type !== "direct" && (
            <section className="space-y-2">
              <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-muted-foreground">
                MEMBERS{info?.member_count ? ` · ${info.member_count}` : ""}
              </h3>
              <div className="rounded-2xl bg-card border border-border divide-y divide-border">
                {!info && (
                  <div className="px-4 py-4 text-[13px] text-muted-foreground">Loading members…</div>
                )}
                {info && shownMembers.length === 0 && (
                  <div className="flex items-center gap-3 px-4 py-4 text-[13px] text-muted-foreground">
                    <Users className="w-4 h-4" /> No members found yet.
                  </div>
                )}
                {shownMembers.map((m, i) => (
                  <div key={`${m.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-9 h-9 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 ${m.is_staff ? "bg-primary/20 text-primary" : "bg-surface text-foreground"}`}>
                      {m.initials}
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[15px] font-bold truncate">{m.name}</span>
                      {m.role_label && <span className="text-[13px] text-muted-foreground truncate">{m.role_label}</span>}
                    </span>
                  </div>
                ))}
                {members.length > shownMembers.length && (
                  <div className="px-4 py-3 text-[13px] text-muted-foreground">+ {members.length - shownMembers.length} more</div>
                )}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
