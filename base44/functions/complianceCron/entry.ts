import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Daily cron: checks coach compliance expiration windows and sends push reminders
// Trigger: scheduled automation every day at 8am

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const profiles = await base44.asServiceRole.entities.CoachProfile.list();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let processed = 0, reminders = 0;

    for (const profile of profiles) {
      const updates = {};
      let needsReminder = false;
      let reminderTier  = null;
      let reminderMsg   = "";

      const checkDate = (dateStr, fieldName) => {
        if (!dateStr) return;
        const expiry = new Date(dateStr);
        const days   = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

        if (days >= 0 && days <= 30 && profile.last_reminder_sent !== 'one_month') {
          if (!reminderTier || reminderTier === 'two_month') {
            reminderTier = 'one_month';
            needsReminder = true;
            reminderMsg = `⚠️ Urgent: Your ${fieldName} expires in ${days} day(s). Please renew immediately.`;
          }
        } else if (days > 30 && days <= 60 && profile.last_reminder_sent === 'none') {
          if (!reminderTier) {
            reminderTier = 'two_month';
            needsReminder = true;
            reminderMsg = `📋 Reminder: Your ${fieldName} expires in ${days} day(s). Please plan to renew soon.`;
          }
        }
      };

      if (profile.bg_check_passed)  checkDate(profile.bg_check_expires, 'Background Check');
      if (profile.nays_completed)    checkDate(profile.nays_expires,     'NAYS Certification');

      if (needsReminder && profile.user_email) {
        updates.last_reminder_sent = reminderTier;

        // Send push notification via existing sendPushNotification function
        try {
          await base44.asServiceRole.functions.invoke('sendPushNotification', {
            user_email: profile.user_email,
            title: 'CU Connect — Compliance Alert',
            body:  reminderMsg,
            url:   '/CoachesTraining',
          });
          reminders++;
          console.log(`[complianceCron] Sent ${reminderTier} reminder to ${profile.user_email}`);
        } catch (err) {
          console.error(`[complianceCron] Push failed for ${profile.user_email}:`, err.message);
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.CoachProfile.update(profile.id, updates);
      }

      processed++;
    }

    console.log(`[complianceCron] Done — ${processed} profiles checked, ${reminders} reminders sent.`);
    return Response.json({ success: true, processed, reminders });

  } catch (error) {
    console.error('[complianceCron] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});