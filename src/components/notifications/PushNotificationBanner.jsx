import React, { useState, useEffect } from 'react';
import { Bell, X, BellRing } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Shows a bottom-sheet prompt asking parents to enable push notifications.
// - Never shows if already subscribed or permission denied.
// - Re-prompts every 7 days if dismissed (not permanent).
// - Appears after a 2s delay so it doesn't flash on load.
export default function PushNotificationBanner() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed || permission === 'denied') return;

    const lastDismissed = localStorage.getItem('push_banner_dismissed_at');
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const tooRecent = lastDismissed && Date.now() - parseInt(lastDismissed, 10) < SEVEN_DAYS;
    if (tooRecent) return;

    // Delay appearance so the page has time to settle
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, [isSupported, isSubscribed, permission]);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('push_banner_dismissed_at', Date.now().toString());
  };

  const handleEnable = async () => {
    setSubscribing(true);
    await subscribe();
    setSubscribing(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={handleDismiss}
      />
      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-1 safe-area-bottom animate-in slide-in-from-bottom duration-300">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-5 max-w-lg mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
              <BellRing className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-base">Stay in the loop</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Get instant alerts for game schedules, team announcements, payment reminders, and more — right on your phone.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleEnable}
              disabled={subscribing || isLoading}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Bell className="w-4 h-4" />
              {subscribing || isLoading ? 'Enabling…' : 'Enable Notifications'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-3 rounded-xl bg-surface border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </>
  );
}