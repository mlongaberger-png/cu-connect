import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director')) {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

    // Fetch all waitlisted applications older than 30 days
    const staleApps = await base44.asServiceRole.entities.RegistrationApplication.filter({
      status: 'waitlisted',
    });

    const stale = staleApps.filter(app => {
      if (!app.waitlisted_at) return false;
      try {
        return new Date(app.waitlisted_at) < new Date(cutoff);
      } catch {
        return false;
      }
    });

    let alertsSent = 0;
    for (const app of stale) {
      // Notify the coach(es) of the target team
      const coachProfiles = await base44.asServiceRole.entities.CoachProfile.filter({
        team_id: app.target_team_id,
      });

      const recipients = new Set();
      coachProfiles.forEach(cp => { if (cp.user_email) recipients.add(cp.user_email); });

      // Notify all admins
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      admins.forEach(a => { if (a.email) recipients.add(a.email); });

      for (const email of recipients) {
        await base44.asServiceRole.entities.NotificationQueue.create({
          user_email: email,
          title: 'Stale Waitlisted Application',
          body: `The application for ${app.athlete_first_name} ${app.athlete_last_name} on ${app.target_team_name || 'a team'} has been waitlisted for over 30 days. Please review it.`,
          url: '/Applications',
          source: 'other',
          dedup_key: `reg_archive_stale_${app.id}`,
        });
        alertsSent++;
      }
    }

    return Response.json({ success: true, stale_count: stale.length, alerts_sent: alertsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});