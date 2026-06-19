import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns events scoped to the calling user's team memberships.
 *
 * - admin / athletic_director → all events
 * - coach → events where team_id matches their CoachProfile team_id
 * - parent / user → events where team_id is in their children's teams (via PlayerGuardian)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;

    // Admins and ADs get everything
    if (role === 'admin' || role === 'athletic_director') {
      const events = await base44.asServiceRole.entities.Event.list('-date', 500);
      return Response.json({ events });
    }

    // Coaches: scope to their CoachProfile team
    if (role === 'coach') {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_email: user.email });
      const teamIds = [...new Set(profiles.map(p => p.team_id).filter(Boolean))];
      if (teamIds.length === 0) return Response.json({ events: [] });

      const allEvents = await base44.asServiceRole.entities.Event.list('-date', 500);
      const events = allEvents.filter(e => teamIds.includes(e.team_id));
      return Response.json({ events });
    }

    // Parents / guardians: scope to their children's teams via PlayerGuardian
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email });
    if (guardianLinks.length === 0) return Response.json({ events: [] });

    const playerIds = [...new Set(guardianLinks.map(g => g.player_id).filter(Boolean))];

    // Fetch players to get their team_ids
    const players = await Promise.all(
      playerIds.map(pid => base44.asServiceRole.entities.Player.filter({ id: pid }))
    );
    const teamIds = [...new Set(players.flat().map(p => p.team_id).filter(Boolean))];
    if (teamIds.length === 0) return Response.json({ events: [] });

    const allEvents = await base44.asServiceRole.entities.Event.list('-date', 500);
    const events = allEvents.filter(e => teamIds.includes(e.team_id));

    console.log(`[getEventsFiltered] user=${user.email} role=${role} teams=${teamIds.length} events=${events.length}`);
    return Response.json({ events });

  } catch (error) {
    console.error('[getEventsFiltered]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});