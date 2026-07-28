import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';
import { GoogleAuth } from 'npm:google-auth-library@9';

// --- FCM (native iOS/Android) helpers ---
let cachedFcmAuth = null;

async function getFcmAccessToken(base44) {
  const now = Date.now();
  if (cachedFcmAuth && cachedFcmAuth.expiresAt > now) return cachedFcmAuth;

  const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'fcm_service_account' });
  if (!configs.length) return null;

  const serviceAccount = JSON.parse(configs[0].value);
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const tokenResp = await client.getAccessToken();

  cachedFcmAuth = {
    projectId: serviceAccount.project_id,
    accessToken: tokenResp.token,
    expiresAt: now + 50 * 60 * 1000,
  };
  return cachedFcmAuth;
}

async function sendFcm({ base44, fcmToken, title, body, url }) {
  const auth = await getFcmAccessToken(base44);
  if (!auth) return { ok: false, skipped: true };
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        data: { url: url || '' },
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, errText };
  }
  return { ok: true };
}

/**
 * Scheduled cron function (runs every 5 minutes).
 * Reads all pending NotificationQueue tasks, deduplicates per user,
 * consolidates into one push notification per user per cycle, then marks tasks as sent/failed.
 * Delivers via native FCM for iOS/Android subscriptions, and web push (VAPID) for web subscriptions.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
      const callerRole = callerUsers[0]?.role;
      if (!['admin'].includes(callerRole)) {
        console.error(`processNotifications: forbidden role '${callerRole}' for ${caller.email}`);
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    const vapidConfigured = configs.length > 0;
    if (vapidConfigured) {
      const { publicKey, privateKey } = JSON.parse(configs[0].value);
      webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);
    }

    const pending = await base44.asServiceRole.entities.NotificationQueue.filter({ status: 'pending' });
    if (pending.length === 0) {
      console.log('processNotifications: no pending tasks');
      return Response.json({ success: true, processed: 0 });
    }

    console.log(`processNotifications: processing ${pending.length} pending task(s)`);

    const byUser = {};
    for (const task of pending) {
      const key = task.user_email.toLowerCase();
      if (!byUser[key]) byUser[key] = [];
      byUser[key].push(task);
    }

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
        const pushResults = await Promise.allSettled(
          subs.map(sub => {
            if (sub.platform === 'ios' || sub.platform === 'android') {
              return sendFcm({ base44, fcmToken: sub.fcm_token, title, body, url }).then((result) => {
                if (!result.ok) throw new Error(`FCM failed: ${result.status || result.skipped}`);
              });
            }
            return webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
              payload
            ).catch(async err => {
              console.error(`Push failed for ${emailKey}:`, err.message);
              if (err.statusCode === 410 || err.statusCode === 404) {
                await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
              }
              throw err;
            });
          })
        );
        success = pushResults.some(r => r.status === 'fulfilled');
        if (success) totalSent++;
        else totalFailed++;
      } else {
        totalFailed++;
      }

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
