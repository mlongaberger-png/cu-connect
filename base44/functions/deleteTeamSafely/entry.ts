import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

// Teams.jsx's old delete button was a raw confirm() + Team.delete(id) with
// zero cascade handling -- deleting a team with players on it would orphan
// every one of those Player records (dangling team_id, team still shown as
// "assigned" but pointing nowhere) with no warning at all. This is exactly
// the gap QA test case Phase 11 #92 ("Delete a team -- confirm cascading
// effects on its players/roster") was written to catch.
//
// Fix: block the delete entirely if the team has ANY current players, full
// stop -- no force override. This matches this app's established
// "archive, don't destroy" ethos (see rollOverTeam's header comment; also
// consistent with there being no delete-record capability anywhere for most
// entities in this project). The correct move for a team that's done for
// the year is "End Season" (Team.is_active = false), which preserves the
// roster/history, or rollOverTeam if it's continuing into a new bracket.
// A team can only be hard-deleted here if it currently has zero players --
// e.g. a team created by mistake and never rostered.
const schema = z.object({
  team_id: z.string().min(1),
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
      endpoint: 'deleteTeamSafely',
      action,
      ip_address: ip,
      result,
    }).catch(() => {});
  }

  try {
    const authUser = await base44.auth.me().catch(() => null);
    if (!authUser) {
      await logAudit('unknown', 'unknown', 'denied', 'delete_team_no_auth');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRecord = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const role = userRecord[0]?.role;
    // Matches Team.jsonc's own delete RLS (admin OR athletic_director).
    if (role !== 'admin' && role !== 'athletic_director') {
      await logAudit(authUser.id, authUser.email, 'denied', 'delete_team_forbidden_role');
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { team_id } = parsed.data;

    const team = await base44.asServiceRole.entities.Team.get(team_id).catch(() => null);
    if (!team) {
      return Response.json({ error: 'Team not found.' }, { status: 404 });
    }

    const players = await base44.asServiceRole.entities.Player.filter({ team_id });
    if (players.length > 0) {
      await logAudit(authUser.id, authUser.email, 'denied', `delete_team_blocked:${team_id} (${players.length} players)`);
      return Response.json({
        success: false,
        blocked: true,
        reason: 'has_players',
        player_count: players.length,
        message: `"${team.name}" still has ${players.length} player${players.length === 1 ? '' : 's'} on its roster. Use "End Season" to archive it instead, or move/remove those players first.`,
      }, { status: 409 });
    }

    await base44.asServiceRole.entities.Team.delete(team_id);
    await logAudit(authUser.id, authUser.email, 'allowed', `delete_team:${team_id} (${team.name})`);

    console.log(`deleteTeamSafely: deleted empty team ${team.name} (${team_id}) by ${authUser.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteTeamSafely error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
