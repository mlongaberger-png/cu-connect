import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const promoteSchema = z.object({
  player_id: z.string().min(1),
  athlete_email: z.string().email(),
  // The "I Agree" click in the modal sets this to true and it travels with the
  // promote request — this is what makes agreeing to the terms an actual action
  // sent to (and enforced by) the server, rather than just a client-side UI
  // transition. consent_confirmed_at/by are stamped server-side at the moment
  // this request is processed with consent_agreed === true, so the recorded
  // consent event reflects what the server actually acted on.
  consent_agreed: z.literal(true),
}).strict();

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

// Exact calendar-based age calculation (years). Mirrors the client-side
// calcAge() in ParentPortal.jsx exactly so the "show the promote button"
// hint on the client is never more lenient than this server-side gate.
function calcAge(dobStr) {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const ip = getClientIP(req);

  async function logAudit(user_id, user_email, result, action) {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: user_id || 'unknown',
      user_email: user_email || 'unknown',
      endpoint: 'promoteAthlete',
      action,
      ip_address: ip,
      result,
    }).catch(() => {});
  }

  try {
    const authUser = await base44.auth.me();
    if (!authUser) {
      await logAudit('unknown', 'unknown', 'denied', 'promote_athlete:unauthenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = promoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      await logAudit(authUser.id, authUser.email, 'denied', 'promote_athlete:invalid_fields');
      return Response.json({ error: 'Invalid fields. Consent must be confirmed and a valid athlete email provided.', details: parsed.error.flatten() }, { status: 400 });
    }
    const { player_id, athlete_email, consent_agreed } = parsed.data;
    const normalizedEmail = athlete_email.trim().toLowerCase();

    // ── Fetch target player ──────────────────────────────────────────────
    let player;
    try {
      player = await base44.asServiceRole.entities.Player.get(player_id);
    } catch (e) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:player_not_found:${player_id}`);
      return Response.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (!player) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:player_not_found:${player_id}`);
      return Response.json({ error: 'Player not found.' }, { status: 404 });
    }

    // ── Guardian-ownership check (same pattern as getMyPlayers) ──────────
    // Admins/athletic directors may also promote on a guardian's behalf.
    const isStaff = authUser.role === 'admin' || authUser.role === 'athletic_director';
    let isGuardian = isStaff || player.parent_email === authUser.email;
    if (!isGuardian) {
      const links = await base44.asServiceRole.entities.PlayerGuardian.filter({
        player_id,
        user_email: authUser.email,
      });
      isGuardian = links.length > 0;
    }
    if (!isGuardian) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:not_guardian:player=${player_id}`);
      return Response.json({ error: 'You are not authorized to promote this athlete.' }, { status: 403 });
    }

    // ── Already promoted guard ────────────────────────────────────────────
    if (player.is_promoted) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:already_promoted:player=${player_id}`);
      return Response.json({ error: 'This athlete already has an account.' }, { status: 400 });
    }

    // ── Server-side 13+ age re-check — NO team-name bypass ────────────────
    if (!player.date_of_birth) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:missing_dob:player=${player_id}`);
      return Response.json({ error: 'This athlete does not have a date of birth on file, so eligibility cannot be verified.' }, { status: 400 });
    }
    const age = calcAge(player.date_of_birth);
    if (age === null) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:invalid_dob:player=${player_id}`);
      return Response.json({ error: 'This athlete\'s date of birth on file is invalid, so eligibility cannot be verified.' }, { status: 400 });
    }
    if (age < 13) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:under_13:player=${player_id}:age=${age}`);
      return Response.json({ error: 'Athletes must be 13 or older to have their own account. Team name does not affect this requirement.' }, { status: 403 });
    }

    // ── Duplicate-email checks ────────────────────────────────────────────
    const dupPlayers = await base44.asServiceRole.entities.Player.filter({ athlete_email: normalizedEmail });
    if (dupPlayers.some(p => p.id !== player.id)) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:dup_athlete_email:player=${player_id}`);
      return Response.json({ error: 'This email address is already linked to another athlete account.' }, { status: 409 });
    }
    const dupUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (dupUsers.length > 0) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:dup_user_email:player=${player_id}`);
      return Response.json({ error: 'This email address is already in use by another account.' }, { status: 409 });
    }

    // ── Perform promotion ──────────────────────────────────────────────────
    const nowIso = new Date().toISOString();

    // Stamp Player.athlete_email BEFORE sending the invite. onUserCreated (the
    // automation that assigns role='athlete' to the new login) matches on this
    // field the moment the invited User record is created — which can happen
    // as an immediate side effect of inviteUser() below. Stamping first closes
    // that race so the automation always sees the match, however soon it fires.
    await base44.asServiceRole.entities.Player.update(player_id, {
      athlete_email: normalizedEmail,
      is_promoted: true,
      promoted_at: nowIso,
      promoted_by: authUser.email,
      consent_confirmed_at: nowIso,
      consent_confirmed_by: authUser.email,
    });

    try {
      // Base44's platform-level invite only accepts workspace roles 'user' or
      // 'admin' — 'athlete' is a CU Connect app-level role, not a valid value
      // here, and passing it throws client-side before any request is even
      // sent (this was the root cause of promotion silently never firing).
      // The app-level role is set separately by onUserCreated once the
      // invited user actually signs up, by matching Player.athlete_email.
      //
      // Third arg is the post-signup redirect path. Athletes have no
      // AcceptInvite-style profile step (see AppShell.jsx), so send them
      // straight into the app instead of the generic /welcome landing page.
      await base44.users.inviteUser(normalizedEmail, 'user', '/Portal');
    } catch (inviteErr) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:invite_failed:player=${player_id}`);
      // Roll back the stamp so a failed invite doesn't leave the player
      // permanently marked promoted with no account able to claim it.
      await base44.asServiceRole.entities.Player.update(player_id, {
        athlete_email: null,
        is_promoted: false,
        promoted_at: null,
        promoted_by: null,
        consent_confirmed_at: null,
        consent_confirmed_by: null,
      }).catch(() => {});
      return Response.json({ error: `Could not send invitation: ${inviteErr.message}` }, { status: 500 });
    }

    // Seed ChannelMember rows for the newly-promoted athlete's team channel(s),
    // same pattern already used by linkPlayerGuardian's join_channels step.
    // Without this, a promoted athlete who is the first to ever send a
    // message in their team channel (before ever being a message *recipient*,
    // which is the only case onMessageCreated auto-adds ChannelMember for)
    // gets an empty response back from getMessagesFiltered for their own
    // just-sent message, since that function gates non-staff reads on
    // ChannelMember membership -- the message silently appears to vanish,
    // even to the sender. Found live during Phase 13 QA (2026-08-12): a
    // freshly-promoted athlete's own first message never rendered, despite
    // the create call itself succeeding. Non-fatal: a failure here must not
    // block promotion, since the invite has already been sent.
    if (player.team_id) {
      try {
        const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: player.team_id });
        const joinable = teamChannels.filter(c => c.type === 'team' || c.type === 'announcement');
        const athleteName = [player.first_name, player.last_name].filter(Boolean).join(' ') || normalizedEmail;
        for (const channel of joinable) {
          const existingMembership = await base44.asServiceRole.entities.ChannelMember.filter({
            channel_id: channel.id,
            user_email: normalizedEmail,
          });
          if (existingMembership.length === 0) {
            await base44.asServiceRole.entities.ChannelMember.create({
              channel_id: channel.id,
              user_email: normalizedEmail,
              user_name: athleteName,
              unread_count: 0,
            });
          }
        }
      } catch (channelErr) {
        console.error('promoteAthlete: channel membership seed failed:', channelErr.message);
      }
    }

    await logAudit(
      authUser.id,
      authUser.email,
      'allowed',
      `promote_athlete:player=${player_id}:athlete_email=${normalizedEmail}:consent_agreed=${consent_agreed}`,
    );

    return Response.json({
      success: true,
      player_id,
      athlete_email: normalizedEmail,
      promoted_at: nowIso,
      consent_confirmed_at: nowIso,
    });
  } catch (error) {
    console.error('promoteAthlete error:', error.message, error.stack);
    await logAudit('unknown', 'unknown', 'denied', `promote_athlete:error:${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
