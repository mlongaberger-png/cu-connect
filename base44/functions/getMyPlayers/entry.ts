import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns Player records the calling user is linked to as a parent/guardian.
 * RLS on Player can only check data.parent_email == caller (no relational
 * joins), so it misses guardians linked only via PlayerGuardian (e.g.
 * co-parents added after the fact). This unions both paths server-side,
 * same pattern as getPhotosFiltered / getEventsFiltered:
 *
 *   - Player.parent_email == caller email
 *   - Player.id in PlayerGuardian.player_id where PlayerGuardian.user_email == caller email
 *
 * - admin / athletic_director → all players
 * - everyone else → union of the two paths above (their own linked players)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;

    // Admins and ADs get everything
    if (role === 'admin' || role === 'athletic_director') {
      const players = await base44.asServiceRole.entities.Player.list('-created_date', 1000);
      return Response.json({ players });
    }

    // Everyone else: union of Player.parent_email match and PlayerGuardian links
    const [byParentEmail, guardianLinks] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ parent_email: user.email }),
      base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email }),
    ]);

    const playerIds = [...new Set(guardianLinks.map(g => g.player_id).filter(Boolean))];
    const byGuardianLink = playerIds.length
      ? (await Promise.all(playerIds.map(pid => base44.asServiceRole.entities.Player.filter({ id: pid })))).flat()
      : [];

    const merged = new Map();
    [...byParentEmail, ...byGuardianLink].forEach(p => merged.set(p.id, p));
    const players = [...merged.values()];

    console.log(`[getMyPlayers] user=${user.email} role=${role} players=${players.length}`);
    return Response.json({ players });

  } catch (error) {
    console.error('[getMyPlayers]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
