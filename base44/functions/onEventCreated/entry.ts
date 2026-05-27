import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Triggered by entity automation on Event.create
// Resolves all parent/guardian recipients for the event's team_id,
// sends a push notification deep-linking to the event detail view,
// and bumps last_viewed_schedule on users who haven't seen it (handled client-side via badge).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const event = body.data || body;
    const { id: event_id, title, type, date, start_time, location, team_id, team_name, is_cancelled } = event;

    if (!team_id) {
      console.log('No team_id on event — skipping notification');
      return Response.json({ skipped: true, reason: 'no team_id' });
    }

    if (is_cancelled) {
      console.log('Event is cancelled — skipping notification');
      return Response.json({ skipped: true, reason: 'cancelled' });
    }

    console.log(`onEventCreated: event="${title}" type=${type} team_id=${team_id}`);

    // Resolve all guardian/parent emails for this team
    const [players, allGuardians] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ team_id, is_active: true }),
      base44.asServiceRole.entities.PlayerGuardian.filter({}),
    ]);

    const playerIds = new Set(players.map(p => p.id));
    const emailSet = new Set();

    // Direct parent_email on Player records
    players.forEach(p => { if (p.parent_email) emailSet.add(p.parent_email.toLowerCase()); });

    // Guardian links
    allGuardians
      .filter(g => playerIds.has(g.player_id) && g.user_email)
      .forEach(g => emailSet.add(g.user_email.toLowerCase()));

    const recipientEmails = Array.from(emailSet);
    console.log(`Recipients resolved: ${recipientEmails.length} emails`);

    if (recipientEmails.length === 0) {
      return Response.json({ skipped: true, reason: 'no recipients' });
    }

    // Load VAPID keys
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    if (!configs.length) {
      console.log('No VAPID keys — skipping push');
      return Response.json({ success: true, push_skipped: true, recipients: recipientEmails.length });
    }

    const { publicKey, privateKey } = JSON.parse(configs[0].value);
    webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

    // Build notification content
    const typeLabel = { practice: 'Practice', game: 'Game', tournament: 'Tournament Game', meeting: 'Meeting', fundraiser: 'Fundraiser', other: 'Event' }[type] || 'Event';
    const notifTitle = `📅 New ${typeLabel}: ${title}`;
    let bodyParts = [];
    if (date) bodyParts.push(new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    if (start_time) {
      const [h, m] = start_time.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      bodyParts.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);
    }
    if (location) bodyParts.push(location);
    const notifBody = bodyParts.join(' · ') || 'Tap to view details';

    // Deep-link URL — opens ParentPortal and surfaces the event detail panel
    const deepLinkUrl = `/ParentPortal?eventId=${event_id}`;

    const notifPayload = JSON.stringify({
      title: notifTitle,
      body: notifBody.length > 120 ? notifBody.slice(0, 117) + '…' : notifBody,
      url: deepLinkUrl,
    });

    // Load all active push subscriptions in bulk
    const [allPrefs, allActiveSubs] = await Promise.all([
      base44.asServiceRole.entities.NotificationPreference.filter({}),
      base44.asServiceRole.entities.PushSubscription.filter({ is_active: true }),
    ]);

    const prefsMap = {};
    allPrefs.forEach(p => { if (p.user_email) prefsMap[p.user_email.toLowerCase()] = p; });

    const subsMap = {};
    allActiveSubs.forEach(s => {
      if (!s.user_email) return;
      const k = s.user_email.toLowerCase();
      if (!subsMap[k]) subsMap[k] = [];
      subsMap[k].push(s);
    });

    // Also load users to check allow_schedule_notifications preference
    const allUsers = await base44.asServiceRole.entities.User.filter({});
    const userPrefsMap = {};
    allUsers.forEach(u => { if (u.email) userPrefsMap[u.email.toLowerCase()] = u; });

    let pushSent = 0;
    let skipped = 0;
    const pushPromises = [];

    for (const email of recipientEmails) {
      const key = email.toLowerCase();

      // Check user-level schedule notification preference (default: true)
      const userRecord = userPrefsMap[key];
      const scheduleNotifEnabled = userRecord ? userRecord.allow_schedule_notifications !== false : true;

      // Also check NotificationPreference entity
      const pref = prefsMap[key];
      const prefEnabled = pref ? pref.schedule_enabled !== false : true;

      if (!scheduleNotifEnabled || !prefEnabled) {
        skipped++;
        continue;
      }

      const subs = subsMap[key] || [];
      for (const sub of subs) {
        pushPromises.push(
          webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            notifPayload
          ).then(() => { pushSent++; }).catch(async (err) => {
            console.error(`Push failed for ${email}:`, err.message);
            if (err.statusCode === 410 || err.statusCode === 404) {
              await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
            }
          })
        );
      }
    }

    await Promise.all(pushPromises);

    console.log(`onEventCreated done. Push sent: ${pushSent}, skipped (prefs off): ${skipped}, total recipients: ${recipientEmails.length}`);
    return Response.json({ success: true, push_sent: pushSent, skipped, recipients: recipientEmails.length });
  } catch (error) {
    console.error('onEventCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});