import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

/**
 * Scheduled cron function (runs every 5 minutes).
 * Reads all pending NotificationQueue tasks, deduplicates per user,
 * consolidates into one push notification per user per cycle, then marks tasks as sent/failed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch VAPID keys
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    if (!configs.length) {
      console.warn('processNotifications: no VAPID keys configured, skipping');
      return Response.json({ skipped: true, reason: 'no_vapid' });
    }
    const { publicKey, privateKey } = JSON.parse(configs[0].value);
    webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

    // Fetch all pending tasks
    const pending = await base44.asServiceRole.entities.NotificationQueue.filter({ status: 'pending' });
    if (pending.length === 0) {
      console.log('processNotifications: no pending tasks');
      return Response.json({ success: true, processed: 0 });
    }

    console.log(`processNotifications: processing ${pending.length} pending task(s)`);

    // Group tasks by user_email — consolidate into one notification per user
    const byUser = {};
    for (const task of pending) {
      const key = task.user_email.toLowerCase();
      if (!byUser[key]) byUser[key] = [];
      byUser[key].push(task);
    }

    // Fetch all active push subscriptions in one query, build map
    const allSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
    const subsMap = {};
    allSubs.forEach(s => {
      if (!s.user_email) return;
      const k = s.user_email.toLowerCase();
      if (!subsMap[k]) subsMap[k] = [];
      subsMap[k].push(s);
    });

    const now = new Date().toISOString();
    let totalSent = 0;
    let totalFailed = 0;

    for (const [emailKey, tasks] of Object.entries(byUser)) {
      const subs = subsMap[emailKey] || [];

      // Consolidate: if multiple tasks for same user, combine into one notification
      let title, body;
      if (tasks.length === 1) {
        title = tasks[0].title;
        body = tasks[0].body;
      } else {
        title = `You have ${tasks.length} reminders`;
        body = tasks.map(t => `• ${t.title}`).join('\n');
      }

      const url = tasks[0].url || '/ParentPortal';
      const payload = JSON.stringify({ title, body, url });

      let success = false;

      if (subs.length > 0) {
        // Send push to all this user's devices
        const pushResults = await Promise.allSettled(
          subs.map(sub =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
              payload
            ).catch(async err => {
              console.error(`Push failed for ${emailKey}:`, err.message);
              if (err.statusCode === 410 || err.statusCode === 404) {
                await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
              }
              throw err;
            })
          )
        );
        success = pushResults.some(r => r.status === 'fulfilled');
        if (success) totalSent++;
        else totalFailed++;
      } else {
        // No push subscription — mark as failed so the caller can fall back to email
        totalFailed++;
      }

      // Mark all tasks for this user as sent or failed
      await Promise.all(
        tasks.map(task =>
          base44.asServiceRole.entities.NotificationQueue.update(task.id, {
            status: success ? 'sent' : 'failed',
            processed_at: now,
            error: success ? undefined : 'No active push subscription',
          })
        )
      );
    }

    console.log(`processNotifications done: ${totalSent} users notified, ${totalFailed} failed`);
    return Response.json({ success: true, users_notified: totalSent, users_failed: totalFailed });
  } catch (error) {
    console.error('processNotifications error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});