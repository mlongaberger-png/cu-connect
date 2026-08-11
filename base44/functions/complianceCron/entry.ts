import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Daily cron: checks coach compliance expiration windows and sends push reminders.
// Trigger: scheduled automation every day at 8am.
//
// Aug 2026 rewrite:
//  - Reads/writes CoachCompliance (one record per coach) instead of CoachProfile
//    (one record per team assignment) -- CoachProfile's bg_check_*/nays_*/
//    last_reminder_sent fields are deprecated, see CoachProfile.jsonc.
//  - Widened from a 60/30-day, two-tier ladder to a 180/90/30-day, three-tier
//    ladder (six_month/three_month/one_month) per the "3 to 6 months out"
//    advance-warning requirement.
//  - Also notifies athletic_director-role users (the safety-officer role was
//    folded into AD), in addition to the coach themself.

const TIER_DAYS = { one_month: 30, three_month: 90, six_month: 180 };
const TIER_RANK = { one_month: 3, three_month: 2, six_month: 1 };
const TIER_LABELS = { one_month: '1-month', three_month: '3-month', six_month: '6-month' };

function daysUntil(dateStr, now) {
  if (!dateStr) return null;
  const expiry = new Date(dateStr);
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
}

// Returns the tier that should fire for this many days-until-expiry, given the
// last tier already sent -- or null if no reminder is due. Each tier only
// fires once per record (escalating): a lower tier won't re-fire once a
// higher-urgency tier has already been sent for the same expiration cycle.
// Negative days (already expired) are intentionally not handled here -- the
// app UI already surfaces "Expired" status; this cron is for advance warning.
function tierForDays(days, lastSent) {
  if (days === null || days < 0) return null;
  if (days <= TIER_DAYS.one_month) {
    return lastSent !== 'one_month' ? 'one_month' : null;
  }
  if (days <= TIER_DAYS.three_month) {
    return (lastSent !== 'one_month' && lastSent !== 'three_month') ? 'three_month' : null;
  }
  if (days <= TIER_DAYS.six_month) {
    return (!lastSent || lastSent === 'none') ? 'six_month' : null;
  }
  return null;
}

function coachMessage(tier, label, days) {
  if (tier === 'one_month') {
    return `⚠️ Urgent: Your ${label} expires in ${days} day(s). Please renew immediately.`;
  }
  if (tier === 'three_month') {
    return `📋 Reminder: Your ${label} expires in ${days} day(s). Please plan to renew soon.`;
  }
  return `🔔 Advance notice: Your ${label} expires in ${days} day(s). No action needed yet, but good to plan ahead.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [records, ads] = await Promise.all([
      base44.asServiceRole.entities.CoachCompliance.list(),
      base44.asServiceRole.entities.User.filter({ role: 'athletic_director' }),
    ]);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let processed = 0, reminders = 0;

    for (const record of records) {
      const fields = [
        { passed: record.bg_check_passed, expires: record.bg_check_expires, label: 'Background Check' },
        { passed: record.nays_completed, expires: record.nays_expires, label: 'NAYS Certification' },
      ];

      let bestTier = null, bestDays = null, bestLabel = null;
      for (const f of fields) {
        if (!f.passed) continue;
        const days = daysUntil(f.expires, now);
        const tier = tierForDays(days, record.last_reminder_sent);
        if (tier && (!bestTier || TIER_RANK[tier] > TIER_RANK[bestTier])) {
          bestTier = tier;
          bestDays = days;
          bestLabel = f.label;
        }
      }

      if (bestTier && record.user_email) {
        try {
          await base44.asServiceRole.functions.invoke('sendPushNotification', {
            user_email: record.user_email,
            title: 'CU Connect — Compliance Alert',
            body: coachMessage(bestTier, bestLabel, bestDays),
            url: '/CoachesTraining',
          });
          console.log(`[complianceCron] Sent ${bestTier} reminder to ${record.user_email}`);
        } catch (err) {
          console.error(`[complianceCron] Coach push failed for ${record.user_email}:`, err.message);
        }

        const coachName = record.user_name || record.user_email;
        const adBody = `Coach ${coachName}: ${bestLabel} expires in ${bestDays} day(s) (${TIER_LABELS[bestTier]} reminder).`;
        for (const ad of ads) {
          if (!ad.email) continue;
          try {
            await base44.asServiceRole.functions.invoke('sendPushNotification', {
              user_email: ad.email,
              title: 'CU Connect — Coach Compliance Alert',
              body: adBody,
              url: '/CoachesTraining',
            });
          } catch (err) {
            console.error(`[complianceCron] AD push failed for ${ad.email}:`, err.message);
          }
        }

        await base44.asServiceRole.entities.CoachCompliance.update(record.id, { last_reminder_sent: bestTier });
        reminders++;
      }

      processed++;
    }

    console.log(`[complianceCron] Done — ${processed} compliance records checked, ${reminders} reminders sent, ${ads.length} AD(s) notified per reminder.`);
    return Response.json({ success: true, processed, reminders, adCount: ads.length });

  } catch (error) {
    console.error('[complianceCron] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
