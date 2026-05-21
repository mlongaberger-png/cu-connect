import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Enqueues snack notification tasks into NotificationQueue.
 * processNotifications (cron) handles actual push delivery.
 *
 * Payload:
 *   { type: "confirmation", snack_slot_id: string }
 *   { type: "bulk_reminder" }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { type, snack_slot_id } = body;

    if (type === 'confirmation' && snack_slot_id) {
      const slot = await base44.asServiceRole.entities.SnackAssignment.get(snack_slot_id);
      if (!slot || !slot.assigned_email) return Response.json({ skipped: true });

      const label = slot.slot_label || slot.slot_type;
      const dedupKey = `snack_confirm_${snack_slot_id}`;

      // Idempotency: skip if already queued/sent
      const existing = await base44.asServiceRole.entities.NotificationQueue.filter({ dedup_key: dedupKey });
      if (existing.length > 0) {
        console.log(`Snack confirmation already queued for slot ${snack_slot_id}`);
        return Response.json({ skipped: true, reason: 'already_queued' });
      }

      await base44.asServiceRole.entities.NotificationQueue.create({
        user_email: slot.assigned_email,
        title: `🍎 Snack Confirmed: ${label}`,
        body: `You're signed up for ${label} at ${slot.event_title} on ${slot.event_date}.`,
        url: '/ParentPortal',
        source: 'snack_reminder',
        dedup_key: dedupKey,
        status: 'pending',
      });

      console.log(`Queued snack confirmation for ${slot.assigned_email}, slot ${snack_slot_id}`);
      return Response.json({ success: true, queued: 1 });
    }

    if (type === 'bulk_reminder') {
      const now = new Date();
      const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in25 = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const allSlots = await base44.asServiceRole.entities.SnackAssignment.list();
      const dueSlots = allSlots.filter(s => {
        if (!s.assigned_email || s.reminder_sent) return false;
        const eventDate = new Date(s.event_date);
        return eventDate >= in24 && eventDate <= in25;
      });

      let queued = 0;
      for (const slot of dueSlots) {
        const label = slot.slot_label || slot.slot_type;
        const dedupKey = `snack_reminder_${slot.id}`;

        // Skip if already queued
        const existing = await base44.asServiceRole.entities.NotificationQueue.filter({ dedup_key: dedupKey });
        if (existing.length > 0) continue;

        await base44.asServiceRole.entities.NotificationQueue.create({
          user_email: slot.assigned_email,
          title: `⏰ Reminder: ${label} Tomorrow`,
          body: `Don't forget — you're bringing ${label} for ${slot.event_title} tomorrow${slot.event_time ? ` at ${slot.event_time}` : ''}.`,
          url: '/ParentPortal',
          source: 'snack_reminder',
          dedup_key: dedupKey,
          status: 'pending',
        });

        // Mark slot so it won't be re-queued next run
        await base44.asServiceRole.entities.SnackAssignment.update(slot.id, { reminder_sent: true });
        queued++;
      }

      console.log(`Bulk snack reminders queued: ${queued}`);
      return Response.json({ success: true, queued });
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('sendSnackReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});