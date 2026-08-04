import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  player_id: z.string().min(1),
  paused: z.boolean(),
}).strict();

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const ip = getClientIP(req);

  async function logAudit(user_id, user_email, result, action) {
    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: user_id || 'unknown',
      user_email: user_email || 'unknown',
      endpoint: 'setAthletePauseState',
      action,
      ip_address: ip,
      result,
    }).catch(() => {});
  }

  try {
    const authUser = await base44.auth.me();
    if (!authUser) {
      await logAudit('unknown', 'unknown', 'denied', 'set_athlete_pause_state:unauthenticated');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      await logAudit(authUser.id, authUser.email, 'denied', 'set_athlete_pause_state:invalid_fields');
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { player_id, paused } = parsed.data;

    // ── Fetch target player ──────────────────────────────────────────────
    let player;
    try {
      player = await base44.asServiceRole.entities.Player.get(player_id);
    } catch (e) {
      await logAudit(authUser.id, authUser.email, 'denied', `set_athlete_pause_state:player_not_found:${player_id}`);
      return Response.json({ error: 'Player not found.' }, { status: 404 });
    }
    if (!player) {
      await logAudit(authUser.id, authUser.email, 'denied', `set_athlete_pause_state:player_not_found:${player_id}`);
      return Response.json({ error: 'Player not found.' }, { status: 404 });
    }

    if (!player.is_promoted || !player.athlete_email) {
      await logAudit(authUser.id, authUser.email, 'denied', `set_athlete_pause_state:not_promoted:player=${player_id}`);
      return Response.json({ error: 'This athlete does not have an active account to pause.' }, { status: 400 });
    }

    // ── Guardian-ownership check (same pattern as promoteAthlete / getMyPlayers) ──
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
      await logAudit(authUser.id, authUser.email, 'denied', `set_athlete_pause_state:not_guardian:player=${player_id}`);
      return Response.json({ error: 'You are not authorized to manage this athlete\'s access.' }, { status: 403 });
    }

    // ── Locate the athlete's own User record and flip the flag via service role ──
    // (Parents cannot write another user's User record directly under normal RLS,
    // hence this function running as service role after verifying ownership above.)
    const athleteUsers = await base44.asServiceRole.entities.User.filter({ email: player.athlete_email });
    if (athleteUsers.length === 0) {
      await logAudit(authUser.id, authUser.email, 'denied', `set_athlete_pause_state:athlete_user_not_found:player=${player_id}`);
      return Response.json({ error: 'Athlete account not found. They may not have accepted their invitation yet.' }, { status: 404 });
    }

    await base44.asServiceRole.entities.User.update(athleteUsers[0].id, { athlete_paused: paused });

    await logAudit(
      authUser.id,
      authUser.email,
      'allowed',
      `${paused ? 'pause' : 'unpause'}_athlete_access:player=${player_id}:athlete_email=${player.athlete_email}`,
    );

    return Response.json({ success: true, player_id, athlete_email: player.athlete_email, paused });
  } catch (error) {
    console.error('setAthletePauseState error:', error.message, error.stack);
    await logAudit('unknown', 'unknown', 'denied', `set_athlete_pause_state:error:${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
