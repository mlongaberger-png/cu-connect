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

    try {
      await base44.users.inviteUser(normalizedEmail, 'athlete');
    } catch (inviteErr) {
      await logAudit(authUser.id, authUser.email, 'denied', `promote_athlete:invite_failed:player=${player_id}`);
      return Response.json({ error: `Could not send invitation: ${inviteErr.message}` }, { status: 500 });
    }

    await base44.asServiceRole.entities.Player.update(player_id, {
      athlete_email: normalizedEmail,
      is_promoted: true,
      promoted_at: nowIso,
      promoted_by: authUser.email,
      consent_confirmed_at: nowIso,
      consent_confirmed_by: authUser.email,
    });

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
