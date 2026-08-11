import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

// Rolls a team forward into a new season/year, optionally advancing its age
// bracket (e.g. 8U -> 10U) and carrying the current roster along. Per this
// app's established "archive, don't delete" pattern (no delete-record
// capability is exposed anywhere for most entities, and Team's own delete is
// intentionally guarded — see deleteTeamSafely), the SOURCE team is archived
// (is_active: false), never deleted, so its historical roster/gallery/
// messages/payments (all of which denormalize team_name/sport_name onto
// themselves rather than live-joining Team) stay intact and correctly
// attributed after the rollover.
//
// Routed through asServiceRole per this project's established pattern for
// any privileged multi-record admin action (see promoteAthlete,
// approveParentRequest): Team's own RLS would technically allow a direct
// admin/AD client call, but bulk-reassigning every active player's team_id
// in the same operation as archiving the old team needs to happen
// atomically-as-possible and be audit-logged, which a raw client-side loop
// of individual entity calls can't guarantee.
const schema = z.object({
  source_team_id: z.string().min(1),
  new_name: z.string().min(1),
  new_age_group: z.string().min(1),
  new_season: z.enum(['fall', 'winter', 'spring', 'summer']),
  new_year: z.string().min(1),
  carry_roster: z.boolean().default(true),
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
      endpoint: 'rollOverTeam',
      action,
      ip_address: ip,
      result,
    }).catch(() => {});
  }

  try {
    const authUser = await base44.auth.me().catch(() => null);
    if (!authUser) {
      await logAudit('unknown', 'unknown', 'denied', 'rollover_no_auth');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // DB role check (not JWT claim), matching approveParentRequest's pattern.
    const userRecord = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const role = userRecord[0]?.role;
    if (role !== 'admin' && role !== 'athletic_director') {
      await logAudit(authUser.id, authUser.email, 'denied', 'rollover_forbidden_role');
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { source_team_id, new_name, new_age_group, new_season, new_year, carry_roster } = parsed.data;

    const sourceTeam = await base44.asServiceRole.entities.Team.get(source_team_id).catch(() => null);
    if (!sourceTeam) {
      return Response.json({ error: 'Source team not found.' }, { status: 404 });
    }

    const newTeam = await base44.asServiceRole.entities.Team.create({
      name: new_name,
      sport_id: sourceTeam.sport_id,
      sport_name: sourceTeam.sport_name,
      age_group: new_age_group,
      season: new_season,
      year: new_year,
      head_coach: sourceTeam.head_coach,
      coach_email: sourceTeam.coach_email,
      coach_phone: sourceTeam.coach_phone,
      max_roster: sourceTeam.max_roster,
      practice_location: sourceTeam.practice_location,
      practice_schedule: sourceTeam.practice_schedule,
      avatar_url: sourceTeam.avatar_url,
      avatar_type: sourceTeam.avatar_type,
      is_active: true,
      roster_published: false,
    });

    // Archive the source team -- never delete it, so its history stays
    // attributable (see file header comment).
    await base44.asServiceRole.entities.Team.update(source_team_id, { is_active: false });

    let playersMoved = 0;
    if (carry_roster) {
      const players = await base44.asServiceRole.entities.Player.filter({ team_id: source_team_id });
      for (const p of players) {
        if (p.is_active === false) continue; // don't carry forward players already marked inactive
        await base44.asServiceRole.entities.Player.update(p.id, {
          team_id: newTeam.id,
          team_name: newTeam.name,
          sport_name: newTeam.sport_name,
        });
        playersMoved++;
      }
    }

    await logAudit(authUser.id, authUser.email, 'allowed', `rollover_team:${source_team_id}->${newTeam.id}`);

    console.log(`rollOverTeam: ${sourceTeam.name} (${source_team_id}) -> ${newTeam.name} (${newTeam.id}), ${playersMoved} players moved, by ${authUser.email}`);
    return Response.json({ success: true, new_team: newTeam, players_moved: playersMoved, source_archived: true });
  } catch (error) {
    console.error('rollOverTeam error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
