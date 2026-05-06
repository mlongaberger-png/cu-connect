import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Sends a push notification to one or more users by email.
// Payload: { user_emails: string[], title: string, body: string, url?: string, team_id?: string }
// If team_id is provided, only sends to users who have a guardian link for a player on that team.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_emails, title, body, url, team_id } = await req.json();

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

    // If team_id is provided, build the set of emails that are actually guardians of players on that team
    let allowedEmails = null;
    if (team_id) {
      const players = await base44.asServiceRole.entities.Player.filter({ team_id, is_active: true });
      const playerIds = new Set(players.map(p => p.id));
      const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({});
      allowedEmails = new Set(
        guardians
          .filter(g => playerIds.has(g.player_id))
          .map(g => g.user_email)
          .filter(Boolean)
      );
      // Also include direct parent_email from player record as fallback
      players.forEach(p => { if (p.parent_email) allowedEmails.add(p.parent_email); });
      console.log(`team_id filter active: ${allowedEmails.size} allowed email(s) for team ${team_id}`);
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '' });
    let sent = 0;
    let skipped = 0;

    for (const email of user_emails) {
      // Skip if this email isn't associated with the team
      if (allowedEmails && !allowedEmails.has(email)) {
        skipped++;
        continue;
      }

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
          if (sendError.statusCode === 410 || sendError.statusCode === 404) {
            await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
          }
        }
      }
    }

    console.log(`Push sent to ${sent} subscription(s), skipped ${skipped} (not on team)`);
    return Response.json({ success: true, sent, skipped });
  } catch (error) {
    console.error('sendPushNotification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});