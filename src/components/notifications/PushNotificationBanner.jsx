import React, { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationBanner() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('push_banner_dismissed') === 'true');

  if (!isSupported || isSubscribed || permission === 'denied' || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push_banner_dismissed', 'true');
  };

  return (
    <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 text-sm">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <p className="flex-1 text-foreground text-xs">
        <span className="font-medium">Enable push notifications</span> to get real-time updates for schedules, payments, and team announcements.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={subscribe}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {isLoading ? 'Enabling...' : 'Enable'}
        </button>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}