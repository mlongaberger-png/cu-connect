import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
/**
 * Scheduled function: runs every 30 minutes.
 * Finds games whose start time is 8 hours from now (±15 min window),
 * posts a team chat message, and sends push notifications to all parents
 * with a deep-link URL that pre-confirms their attendance.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Target window: 7h45m – 8h15m from now
    const windowStart = new Date(now.getTime() + (7 * 60 + 45) * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + (8 * 60 + 15) * 60 * 1000);

    // We only need games/tournaments on the date that falls in our window
    // (could span midnight, so check both dates in the window)
    const dates = new Set([
      windowStart.toISOString().split('T')[0],
      windowEnd.toISOString().split('T')[0],
    ]);

    console.log(`Checking for games between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

    let totalNotified = 0;
    let gamesProcessed = 0;

    for (const dateStr of dates) {
      const events = await base44.asServiceRole.entities.Event.filter({
        date: dateStr,
        is_cancelled: false,
      });

      const games = events.filter(e => ['game', 'tournament'].includes(e.type) && e.start_time);

      for (const event of games) {
        // Parse event start datetime
        const [hh, mm] = event.start_time.split(':').map(Number);
        const eventStart = new Date(`${event.date}T${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);

        // Check if this event falls in our notification window
        if (eventStart < windowStart || eventStart > windowEnd) continue;

        console.log(`Game in window: ${event.title} at ${event.start_time} on ${event.date}`);

        // Suggested arrival: 30 min before game time
        const arrivalDate = new Date(eventStart.getTime() - 30 * 60 * 1000);
        const arrivalTime = `${String(arrivalDate.getHours()).padStart(2,'0')}:${String(arrivalDate.getMinutes()).padStart(2,'0')}`;
        const arrivalLabel = formatTime12(arrivalTime);
        const gameTimeLabel = formatTime12(event.start_time);

        // Find all players on this team
        const players = await base44.asServiceRole.entities.Player.filter({
          team_id: event.team_id,
          is_active: true,
        });

        // Find all parent emails (guardians + player.parent_email)
        const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({ });
        const teamPlayerIds = new Set(players.map(p => p.id));
        const guardianEmails = guardians
          .filter(g => teamPlayerIds.has(g.player_id))
          .map(g => g.user_email)
          .filter(Boolean);

        const parentEmailSet = new Set([
          ...guardianEmails,
          ...players.map(p => p.parent_email).filter(Boolean),
        ]);
        const parentEmails = [...parentEmailSet];

        if (parentEmails.length === 0) {
          console.log(`No parents found for team ${event.team_id}, skipping`);
          continue;
        }

        // Check if we already sent a reminder for this event (to avoid duplicates on re-runs)
        const sentKey = `game_reminder_sent_${event.id}`;
        const existing = await base44.asServiceRole.entities.AppConfig.filter({ key: sentKey });
        if (existing.length > 0) {
          console.log(`Reminder already sent for event ${event.id}, skipping`);
          continue;
        }

        // Build notification content
        const title = `🏟️ Game Day Reminder: ${event.title}`;
        const locationLine = event.location ? `📍 ${event.location}` : '';
        const body = [
          `Game starts at ${gameTimeLabel}.`,
          locationLine,
          `Please arrive by ${arrivalLabel}.`,
          'Tap to confirm your attendance.',
        ].filter(Boolean).join(' ');

        // Deep link: open the app's Schedule page — parents can confirm RSVP there
        // We also look for an existing AttendanceRequest linked to this event
        let attendanceRequestId = null;
        const existingReqs = await base44.asServiceRole.entities.AttendanceRequest.filter({
          event_id: event.id,
          team_id: event.team_id,
        });
        if (existingReqs.length > 0) {
          attendanceRequestId = existingReqs[0].id;
        } else {
          // Auto-create an attendance request for this game so parents can RSVP via deep link
          try {
            const newReq = await base44.asServiceRole.entities.AttendanceRequest.create({
              team_id: event.team_id,
              team_name: event.team_name || '',
              event_id: event.id,
              label: `${event.title} – ${formatDate(event.date)} ${gameTimeLabel}`,
              event_type: 'game',
              event_date: event.date,
              event_time: event.start_time,
              created_by_name: 'Game Reminder Bot',
              created_by_email: 'system@cornerstone',
              channel_id: event.team_id,
            });
            attendanceRequestId = newReq.id;
            console.log(`Created AttendanceRequest ${attendanceRequestId} for event ${event.id}`);
          } catch (e) {
            console.warn(`Could not create AttendanceRequest: ${e.message}`);
          }
        }

        // Build URL — if we have an attendance request, link directly to confirm
        const notifUrl = attendanceRequestId
          ? `/ParentPortal?confirm=${attendanceRequestId}`
          : `/ParentPortal`;

        // Post a message in the team channel
        try {
          const msgContent = [
            `${title}`,
            locationLine,
            `⏰ Game time: ${gameTimeLabel}`,
            `📋 Arrive by: ${arrivalLabel}`,
            attendanceRequestId ? `\nPlease confirm your attendance in the app.` : '',
          ].filter(Boolean).join('\n');

          // Find the team channel for this team
          const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: event.team_id, type: 'team' });
          const teamChannel = teamChannels[0];
          if (!teamChannel) {
            console.warn(`No team channel found for team ${event.team_id}, skipping message`);
          } else {
            await base44.asServiceRole.entities.Message.create({
              channel_id: teamChannel.id,
              content_text: msgContent,
              message_type: 'text',
              sender_name: 'Game Reminder',
              sender_user_id: 'system',
            });
            console.log(`Message posted to channel ${teamChannel.id} for event ${event.title}`);
          }
        } catch (e) {
          console.warn(`Failed to post team message: ${e.message}`);
        }

        // Determine which parents have active push subscriptions
        const allSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
        const emailsWithPush = new Set(allSubs.map(s => s.user_email?.toLowerCase()).filter(Boolean));

        const pushRecipients = parentEmails.filter(e => emailsWithPush.has(e.toLowerCase()));
        const emailOnlyRecipients = parentEmails.filter(e => !emailsWithPush.has(e.toLowerCase()));

        // Enqueue push notifications — processNotifications cron handles batched delivery
        if (pushRecipients.length > 0) {
          try {
            await Promise.all(pushRecipients.map(email => {
              const dedupKey = `game_reminder_push_${event.id}_${email}`;
              return base44.asServiceRole.entities.NotificationQueue.filter({ dedup_key: dedupKey })
                .then(existing => {
                  if (existing.length > 0) return; // already queued
                  return base44.asServiceRole.entities.NotificationQueue.create({
                    user_email: email,
                    title,
                    body,
                    url: notifUrl,
                    source: 'game_reminder',
                    dedup_key: dedupKey,
                    status: 'pending',
                  });
                });
            }));
            console.log(`Queued game reminder notifications for ${pushRecipients.length} parent(s) for ${event.title}`);
          } catch (e) {
            console.warn(`Failed to queue game reminder notifications: ${e.message}`);
          }
        }

        // Send emails ONLY as fallback for parents without push subscriptions
        for (const email of emailOnlyRecipients) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: email,
              subject: title,
              body: `<h2>${title}</h2>
<p><strong>📍 Location:</strong> ${event.location || 'See schedule'}</p>
<p><strong>⏰ Game Time:</strong> ${gameTimeLabel}</p>
<p><strong>📋 Please arrive by:</strong> ${arrivalLabel}</p>
<p>Please confirm your attendance in the app.</p>
<p><a href="https://app.cornerstone-athletics.com${notifUrl}" style="background:#c8a84b;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">✅ Confirm Attendance</a></p>`,
            });
          } catch (e) {
            console.warn(`Email failed for ${email}: ${e.message}`);
          }
        }
        console.log(`Game reminder: ${pushRecipients.length} push, ${emailOnlyRecipients.length} email-only for ${event.title}`);

        // Mark reminder as sent so we don't re-fire on next run
        try {
          await base44.asServiceRole.entities.AppConfig.create({
            key: sentKey,
            value: new Date().toISOString(),
          });
        } catch (e) {
          console.warn(`Could not mark reminder sent: ${e.message}`);
        }

        gamesProcessed++;
        totalNotified += parentEmails.length;
      }
    }

    console.log(`gameReminder complete: ${gamesProcessed} game(s) processed, ${totalNotified} parent(s) notified`);
    return Response.json({ success: true, games_processed: gamesProcessed, parents_notified: totalNotified });

  } catch (error) {
    console.error('gameReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}