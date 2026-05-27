# SW Push Patch Instructions

Replace your existing `self.addEventListener('push', ...)` and `self.addEventListener('notificationclick', ...)` blocks in **public/sw.js** with the following:

```js
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  // Guard: drop schedule updates if parent disabled them
  if (data.type === 'schedule_update' && data.user_allows_schedule === false) {
    return;
  }

  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/badge.png',
    data: { url: data.url },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));

  // Set app icon badge dot
  if ('setAppBadge' in self.navigator) {
    const combinedCount = (data.unreadMessages || 0) + (data.unreadScheduleAlerts || 0);
    if (combinedCount > 0) {
      self.navigator.setAppBadge(combinedCount);
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge();
  }
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
```

Also ensure your **`gameReminder`** and **`sendPushNotification`** backend functions include these fields in their push payload:
- `type`: `'schedule_update'` for schedule events, `'message'` for chat
- `user_allows_schedule`: pass the target user's `allow_schedule_notifications` value
- `unreadMessages`: total unread message count for the user
- `unreadScheduleAlerts`: count of events created after `last_viewed_schedule`
