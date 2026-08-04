import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns PhotoPost records scoped to the calling user's team memberships.
 * RLS on PhotoPost can only role-gate (no relational joins), so real team-level
 * scoping is enforced here server-side, same pattern as getEventsFiltered.
 *
 * - admin / athletic_director → all photos
 * - coach → photos where team_id matches their CoachProfile team_id(s)
 * - athlete → photos where team_id is in their own team(s), via Player.athlete_email,
 *   plus org-wide photos (empty team_id)
 * - parent / grandparent / other → photos where team_id is in their children's
 *   teams (via PlayerGuardian → Player), plus org-wide photos (empty team_id)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;

    // Admins and ADs get everything
    if (role === 'admin' || role === 'athletic_director') {
      const photos = await base44.asServiceRole.entities.PhotoPost.list('-created_date', 500);
      return Response.json({ photos });
    }

    // Coaches: scope to their CoachProfile team(s)
    if (role === 'coach') {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_email: user.email });
      const teamIds = [...new Set(profiles.map(p => p.team_id).filter(Boolean))];
      if (teamIds.length === 0) return Response.json({ photos: [] });

      const allPhotos = await base44.asServiceRole.entities.PhotoPost.list('-created_date', 500);
      const photos = allPhotos.filter(p => teamIds.includes(p.team_id));
      return Response.json({ photos });
    }

    // Athletes: scope to their own team(s) via Player.athlete_email. Intentionally
    // does NOT fall through to the guardian branch below — an athlete is not a
    // guardian of themselves, so that branch would return zero photos instead of
    // their own team's gallery.
    if (role === 'athlete') {
      const myPlayers = await base44.asServiceRole.entities.Player.filter({ athlete_email: user.email });
      const teamIds = [...new Set(myPlayers.map(p => p.team_id).filter(Boolean))];
      if (teamIds.length === 0) return Response.json({ photos: [] });

      const allPhotos = await base44.asServiceRole.entities.PhotoPost.list('-created_date', 500);
      const photos = allPhotos.filter(p => !p.team_id || teamIds.includes(p.team_id));

      console.log(`[getPhotosFiltered] user=${user.email} role=${role} teams=${teamIds.length} photos=${photos.length}`);
      return Response.json({ photos });
    }

    // Parents / guardians / others: scope to their children's teams via PlayerGuardian
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email });
    if (guardianLinks.length === 0) return Response.json({ photos: [] });

    const playerIds = [...new Set(guardianLinks.map(g => g.player_id).filter(Boolean))];

    const players = await Promise.all(
      playerIds.map(pid => base44.asServiceRole.entities.Player.filter({ id: pid }))
    );
    const teamIds = [...new Set(players.flat().map(p => p.team_id).filter(Boolean))];
    if (teamIds.length === 0) return Response.json({ photos: [] });

    const allPhotos = await base44.asServiceRole.entities.PhotoPost.list('-created_date', 500);
    const photos = allPhotos.filter(p => teamIds.includes(p.team_id));

    console.log(`[getPhotosFiltered] user=${user.email} role=${role} teams=${teamIds.length} photos=${photos.length}`);
    return Response.json({ photos });

  } catch (error) {
    console.error('[getPhotosFiltered]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
