import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import webpush from 'npm:web-push@3.6.7';

// Sends a snack assignment confirmation or 24hr reminder push notification.
// Payload:
//   { type: "confirmation" | "reminder", snack_slot_id: string }
// Or for bulk reminder pass:
//   { type: "bulk_reminder" } — checks all upcoming slots and sends 24hr reminders

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { type, snack_slot_id } = body;

    // Get VAPID keys
    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
    if (!configs.length) {
      console.warn('Push not configured (no VAPID keys)');
      return Response.json({ skipped: true, reason: 'no_vapid' });
    }
    const { publicKey, privateKey } = JSON.parse(configs[0].value);
    webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

    const sendPush = async (email, title, body) => {
      const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: email, is_active: true });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
            JSON.stringify({ title, body, url: '/ParentPortal' })
          );
        } catch (err) {
          console.error(`Push failed for ${email}:`, err.message);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
          }
        }
      }
    };

    if (type === 'confirmation' && snack_slot_id) {
      const slot = await base44.asServiceRole.entities.SnackAssignment.get(snack_slot_id);
      if (!slot || !slot.assigned_email) return Response.json({ skipped: true });
      const label = slot.slot_label || slot.slot_type;
      await sendPush(
        slot.assigned_email,
        `🍎 Snack Confirmed: ${label}`,
        `You're signed up for ${label} at ${slot.event_title} on ${slot.event_date}.`
      );
      console.log(`Confirmation sent to ${slot.assigned_email} for slot ${snack_slot_id}`);
      return Response.json({ success: true });
    }

    if (type === 'bulk_reminder') {
      // Find all slots with an assigned parent whose event is ~24hrs away and reminder not yet sent
      const now = new Date();
      const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25 = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const allSlots = await base44.asServiceRole.entities.SnackAssignment.list();
      const dueSlots = allSlots.filter(s => {
        if (!s.assigned_email || s.reminder_sent) return false;
        const eventDate = new Date(s.event_date);
        return eventDate >= in24 && eventDate <= in25;
      });

      let sent = 0;
      for (const slot of dueSlots) {
        const label = slot.slot_label || slot.slot_type;
        await sendPush(
          slot.assigned_email,
          `⏰ Reminder: ${label} Tomorrow`,
          `Don't forget — you're bringing ${label} for ${slot.event_title} tomorrow${slot.event_time ? ` at ${slot.event_time}` : ''}.`
        );
        await base44.asServiceRole.entities.SnackAssignment.update(slot.id, { reminder_sent: true });
        sent++;
      }
      console.log(`Bulk snack reminders sent: ${sent}`);
      return Response.json({ success: true, sent });
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('sendSnackReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});