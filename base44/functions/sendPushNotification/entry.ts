import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Sends a push notification to one or more users by email.
// Payload: { user_emails: string[], title: string, body: string, url?: string, team_id?: string, room_id?: string }
// If team_id provided, only sends to guardians of players on that team.
// If room_id provided, resolves room access (allowed_team_ids, allowed_emails, allowed_roles) and only sends to those users.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Auth guard — only staff roles may send push notifications
    const caller = await base44.auth.me();
    if (!caller || !["admin", "athletic_director", "coach"].includes(caller.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { user_emails, title, body, url, team_id, room_id } = await req.json();

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
      players.forEach(p => { if (p.parent_email) allowedEmails.add(p.parent_email); });
      console.log(`team_id filter: ${allowedEmails.size} allowed emails for team ${team_id}`);
    }

    // If room_id is provided, build allowed emails from room access rules
    if (room_id) {
      const rooms = await base44.asServiceRole.entities.MessageRoom.filter({ is_active: true });
      const room = rooms.find(r => r.id === room_id);
      if (room) {
        allowedEmails = new Set();
        // Add emails from allowed_team_ids — fetch guardians ONCE outside the loop
        if (room.allowed_team_ids) {
          try {
            const tids = JSON.parse(room.allowed_team_ids);
            if (tids.length > 0) {
              const allGuardians = await base44.asServiceRole.entities.PlayerGuardian.filter({});
              for (const tid of tids) {
                const players = await base44.asServiceRole.entities.Player.filter({ team_id: tid, is_active: true });
                const playerIds = new Set(players.map(p => p.id));
                allGuardians.filter(g => playerIds.has(g.player_id)).forEach(g => { if (g.user_email) allowedEmails.add(g.user_email); });
                players.forEach(p => { if (p.parent_email) allowedEmails.add(p.parent_email); });
              }
            }
          } catch {}
        }
        // Add directly allowed emails
        if (room.allowed_emails) {
          try { JSON.parse(room.allowed_emails).forEach(e => allowedEmails.add(e)); } catch {}
        }
        console.log(`room_id filter: ${allowedEmails.size} allowed emails for room ${room_id}`);
      }
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '' });
    let sent = 0;
    let skipped = 0;

    // Fetch ALL active subscriptions in one query, then filter in memory — avoids N+1
    const allActiveSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
    const subsMap = {};
    allActiveSubs.forEach(s => {
      if (!s.user_email) return;
      const k = s.user_email.toLowerCase();
      if (!subsMap[k]) subsMap[k] = [];
      subsMap[k].push(s);
    });

    const pushPromises = [];
    for (const email of user_emails) {
      if (allowedEmails && !allowedEmails.has(email)) {
        skipped++;
        continue;
      }
      const subs = subsMap[email.toLowerCase()] || [];
      for (const sub of subs) {
        pushPromises.push(
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            payload
          ).then(() => { sent++; }).catch(async (sendError) => {
            console.error(`Push send error for ${email}:`, sendError.message);
            if (sendError.statusCode === 410 || sendError.statusCode === 404) {
              await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
            }
          })
        );
      }
    }
    await Promise.all(pushPromises);

    console.log(`Push sent to ${sent} subscription(s), skipped ${skipped} (not on team)`);
    return Response.json({ success: true, sent, skipped });
  } catch (error) {
    console.error('sendPushNotification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});