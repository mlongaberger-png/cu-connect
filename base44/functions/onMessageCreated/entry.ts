import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';
import { GoogleAuth } from 'npm:google-auth-library@9';

// --- FCM (native iOS/Android) helpers ---
let cachedFcmAuth = null; // { projectId, accessToken, expiresAt }

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
    expiresAt: now + 50 * 60 * 1000, // refresh a bit before the usual 1hr expiry
  };
  return cachedFcmAuth;
}

async function sendFcm({ base44, fcmToken, title, body, url }) {
  const auth = await getFcmAccessToken(base44);
  if (!auth) {
    console.log('No fcm_service_account configured in AppConfig, skipping native push');
    return { ok: false, skipped: true };
  }
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

// Triggered by entity automation on Message.create
// For team/announcement channels: resolves recipients from PlayerGuardian + Player records linked to the team
// For direct channels: uses ChannelMember records
// Sends push notifications (web push + native FCM) and increments unread_count for all recipients (except sender)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const message = body.data || body;
    const { channel_id, sender_user_id, sender_name, content_text } = message;

    if (!channel_id) {
      return Response.json({ error: 'No channel_id in payload' }, { status: 400 });
    }

    console.log(`onMessageCreated: channel=${channel_id} sender=${sender_user_id}`);

    const channels = await base44.asServiceRole.entities.Channel.filter({ id: channel_id });
    const channel = channels[0];
    if (!channel) {
      console.log('Channel not found, skipping');
      return Response.json({ skipped: true });
    }

    console.log(`Channel type: ${channel.type}, team_id: ${channel.team_id}, name: ${channel.name}`);

    let recipientEmails = [];

    if (channel.type === 'team' || channel.type === 'announcement') {
      if (channel.team_id) {
        const players = await base44.asServiceRole.entities.Player.filter({ team_id: channel.team_id, is_active: true });
        console.log(`Found ${players.length} active players for team ${channel.team_id}`);

        const playerIds = players.map(p => p.id);
        const emailSet = new Set();

        players.forEach(p => { if (p.parent_email) emailSet.add(p.parent_email.toLowerCase()); });

        if (playerIds.length > 0) {
          const allGuardians = await base44.asServiceRole.entities.PlayerGuardian.filter({});
          allGuardians
            .filter(g => playerIds.includes(g.player_id) && g.user_email)
            .forEach(g => emailSet.add(g.user_email.toLowerCase()));
        }

        const memberRecords = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id });
        memberRecords.forEach(m => { if (m.user_email) emailSet.add(m.user_email.toLowerCase()); });

        recipientEmails = Array.from(emailSet);
        console.log(`Team channel recipients: ${recipientEmails.length} emails`);
      } else {
        const memberRecords = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id });
        recipientEmails = memberRecords.map(m => m.user_email).filter(Boolean);
        console.log(`Team channel (no team_id) recipients from ChannelMember: ${recipientEmails.length}`);
      }
    } else if (channel.type === 'direct' || channel.type === 'carpool') {
      const memberRecords = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id });
      recipientEmails = memberRecords.map(m => m.user_email).filter(Boolean);
      console.log(`Direct/carpool channel recipients: ${recipientEmails.length}`);
    } else {
      console.log(`Unsupported channel type: ${channel.type}, skipping`);
      return Response.json({ skipped: true, reason: 'unsupported channel type' });
    }

    if (recipientEmails.length === 0) {
      console.log('No recipients found, skipping');
      return Response.json({ skipped: true, reason: 'no recipients' });
    }

    let senderEmail = '';
    try {
      const senderUsers = await base44.asServiceRole.entities.User.filter({ id: sender_user_id });
      if (senderUsers.length > 0) {
        senderEmail = (senderUsers[0].email || '').toLowerCase();
      }
    } catch (_) {}
    if (!senderEmail && sender_user_id && sender_user_id.includes('@')) {
      senderEmail = sender_user_id.toLowerCase();
    }
    console.log(`Sender email resolved: ${senderEmail}`);

    const finalRecipients = recipientEmails.filter(email => email.toLowerCase() !== senderEmail);
    console.log(`Final recipients after excluding sender: ${finalRecipients.length}`);

    const existingMembers = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id });
    const memberMap = {};
    existingMembers.forEach(m => { if (m.user_email) memberMap[m.user_email.toLowerCase()] = m; });

    const unreadUpdates = [];
    for (const email of finalRecipients) {
      const member = memberMap[email.toLowerCase()];
      if (member) {
        unreadUpdates.push(
          base44.asServiceRole.entities.ChannelMember.update(member.id, {
            unread_count: (member.unread_count || 0) + 1
          }).catch(err => console.error(`unread update failed for ${email}:`, err.message))
        );
      } else {
        unreadUpdates.push(
          base44.asServiceRole.entities.ChannelMember.create({
            channel_id,
            user_email: email,
            unread_count: 1
          }).catch(err => console.error(`ChannelMember create failed for ${email}:`, err.message))
        );
      }
    }
    await Promise.all(unreadUpdates);
    console.log(`Unread counts updated for ${finalRecipients.length} recipients`);

    // Web push (VAPID) setup — still used for desktop/Android-Chrome subscribers
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    const vapidConfigured = configs.length > 0;
    if (vapidConfigured) {
      const { publicKey, privateKey } = JSON.parse(configs[0].value);
      webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);
    } else {
      console.log('No VAPID keys configured, web push will be skipped');
    }

    await base44.asServiceRole.entities.Channel.update(channel_id, {
      last_message_at: new Date().toISOString(),
      last_message_preview: sender_name ? `${sender_name}: ${(content_text || '').slice(0, 80)}` : (content_text || '').slice(0, 80),
    }).catch(() => {});

    const escapeHtml = (str) => String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    const channelLabel = escapeHtml(channel.name || 'Team Chat');
    const notifTitle = channelLabel;
    const rawNotifBody = sender_name ? `${sender_name}: ${content_text || ''}` : (content_text || 'New message');
    const notifBody = rawNotifBody.length > 120 ? rawNotifBody.slice(0, 117) + '…' : rawNotifBody;
    const notifUrl = `/messages?channelId=${channel_id}`;
    const notifPayload = JSON.stringify({ title: notifTitle, body: notifBody, url: notifUrl });

    const [allPrefs, allActiveSubs] = await Promise.all([
      base44.asServiceRole.entities.NotificationPreference.filter({}),
      base44.asServiceRole.entities.PushSubscription.filter({ is_active: true }),
    ]);

    const prefsMap = {};
    allPrefs.forEach(p => { if (p.user_email) prefsMap[p.user_email.toLowerCase()] = p; });

    const subsMap = {};
    allActiveSubs.forEach(s => {
      if (!s.user_email) return;
      const key = s.user_email.toLowerCase();
      if (!subsMap[key]) subsMap[key] = [];
      subsMap[key].push(s);
    });

    let pushSent = 0;
    let emailSent = 0;
    let skipped = 0;

    const pushPromises = [];
    const emailPromises = [];

    for (const email of finalRecipients) {
      const key = email.toLowerCase();
      const prefs = prefsMap[key];
      const messagesEnabled = prefs ? prefs.messages_enabled !== false : true;
      const method = prefs?.messages_method || 'push';

      if (!messagesEnabled) { skipped++; continue; }

      const userSubs = subsMap[key] || [];
      const hasPush = userSubs.length > 0;
      const shouldPush = (method === 'push' || method === 'both') && hasPush;
      const shouldEmail = method === 'email' || method === 'both' || (method === 'push' && !hasPush);

      if (shouldPush) {
        for (const sub of userSubs) {
          if (sub.platform === 'ios' || sub.platform === 'android') {
            // Native delivery via FCM
            pushPromises.push(
              sendFcm({ base44, fcmToken: sub.fcm_token, title: notifTitle, body: notifBody, url: notifUrl })
                .then((result) => {
                  if (result.ok) { pushSent++; }
                  else console.error(`FCM push failed for ${email}:`, result.status, result.errText);
                })
            );
          } else {
            // Web push (VAPID) delivery
            if (!vapidConfigured) continue;
            pushPromises.push(
              webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                notifPayload
              ).then(() => { pushSent++; }).catch(async (err) => {
                console.error(`Web push failed for ${email}:`, err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                  await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
                }
              })
            );
          }
        }
      }

      if (shouldEmail) {
        emailPromises.push(
          base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `New message in ${channelLabel}`,
            body: `<p><strong>${escapeHtml(sender_name || 'Someone')}</strong> sent a message in <strong>${channelLabel}</strong>:</p>
<blockquote style="border-left:3px solid #c8a84b;margin:8px 0;padding:8px 12px;color:#555;">${escapeHtml((content_text || '').slice(0, 300))}</blockquote>
<p><a href="https://app.cornerstone-athletics.com/messages?channelId=${escapeHtml(channel_id)}" style="background:#c8a84b;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Chat</a></p>`,
          }).then(() => { emailSent++; }).catch(err => console.error(`Email failed for ${email}:`, err.message))
        );
      }
    }

    await Promise.all([...pushPromises, ...emailPromises]);

    console.log(`Done. Push sent: ${pushSent}, email sent: ${emailSent}, skipped (disabled): ${skipped}, unread updated: ${finalRecipients.length}`);
    return Response.json({ success: true, push_sent: pushSent, email_sent: emailSent, skipped, unread_updated: finalRecipients.length });
  } catch (error) {
    console.error('onMessageCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
