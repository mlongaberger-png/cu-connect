import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Triggered by entity automation on Message.create
// Sends push notifications to all channel members (except sender)
// and increments their unread_count in ChannelMember
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Accept both direct calls and automation payloads
    const message = body.data || body;
    const { channel_id, sender_user_id, sender_name, content_text } = message;

    if (!channel_id) {
      return Response.json({ error: 'No channel_id in payload' }, { status: 400 });
    }

    console.log(`onMessageCreated: channel=${channel_id} sender=${sender_user_id}`);

    // Fetch channel to determine type
    const channels = await base44.asServiceRole.entities.Channel.filter({ id: channel_id });
    const channel = channels[0];
    if (!channel) {
      console.log('Channel not found, skipping');
      return Response.json({ skipped: true });
    }

    // Only handle team, direct, announcement channels
    if (!['team', 'direct', 'announcement'].includes(channel.type)) {
      return Response.json({ skipped: true, reason: 'channel type not supported' });
    }

    // Fetch all channel members
    const members = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id });

    if (members.length === 0) {
      console.log('No channel members found, skipping');
      return Response.json({ skipped: true, reason: 'no members' });
    }

    // Separate sender from recipients
    const recipients = members.filter(m => m.user_id !== sender_user_id && m.user_email !== sender_user_id);

    console.log(`Dispatching to ${recipients.length} recipients (${members.length} total members)`);

    // Increment unread counts for all recipients
    const unreadUpdates = recipients.map(m =>
      base44.asServiceRole.entities.ChannelMember.update(m.id, {
        unread_count: (m.unread_count || 0) + 1
      }).catch(err => console.error(`unread update failed for ${m.user_email}:`, err.message))
    );
    await Promise.all(unreadUpdates);

    // Get VAPID keys for push
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    if (!configs.length) {
      console.log('No VAPID keys configured, skipping push');
      return Response.json({ success: true, push_skipped: true, unread_updated: recipients.length });
    }

    const { publicKey, privateKey } = JSON.parse(configs[0].value);
    webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

    const notifPayload = JSON.stringify({
      title: sender_name || 'New Message',
      body: content_text || '',
      url: `/messages?channelId=${channel_id}`
    });

    let sent = 0;
    for (const member of recipients) {
      const subs = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: member.user_email,
        is_active: true,
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            notifPayload
          );
          sent++;
        } catch (err) {
          console.error(`Push failed for ${member.user_email}:`, err.message);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
          }
        }
      }
    }

    console.log(`Push sent: ${sent}, unread incremented: ${recipients.length}`);
    return Response.json({ success: true, push_sent: sent, unread_updated: recipients.length });
  } catch (error) {
    console.error('onMessageCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});