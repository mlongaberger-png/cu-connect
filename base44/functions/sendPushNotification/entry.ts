import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import webpush from 'npm:web-push@3.6.7';

// Sends a push notification to one or more users by email.
// Payload: { user_emails: string[], title: string, body: string, url?: string }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_emails, title, body, url } = await req.json();

    if (!user_emails?.length || !title) {
      return Response.json({ error: 'user_emails and title are required' }, { status: 400 });
    }

    // Get VAPID keys
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    if (!configs.length) {
      return Response.json({ error: 'Push not configured yet (no VAPID keys)' }, { status: 500 });
    }

    const { publicKey, privateKey } = JSON.parse(configs[0].value);
    webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

    const payload = JSON.stringify({ title, body: body || '', url: url || '' });
    let sent = 0;

    for (const email of user_emails) {
      const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: email,
        is_active: true,
      });

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            payload
          );
          sent++;
        } catch (sendError) {
          console.error(`Push send error for ${email}:`, sendError.message);
          // Deactivate expired subscriptions
          if (sendError.statusCode === 410 || sendError.statusCode === 404) {
            await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
          }
        }
      }
    }

    console.log(`Push sent to ${sent} subscription(s) for ${user_emails.length} user(s)`);
    return Response.json({ success: true, sent });
  } catch (error) {
    console.error('sendPushNotification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});