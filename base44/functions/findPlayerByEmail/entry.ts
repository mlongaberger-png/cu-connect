import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Looks up Player records by an ARBITRARY parent_email (not the caller's own),
 * so a parent can find a player registered under a different address — e.g. a
 * co-parent's email — and request a link to it. This is not "get my players":
 * Player RLS only ever exposes rows where data.parent_email == the CALLER's
 * own email, so a lookup by someone else's email always comes back empty
 * under RLS and must run server-side via asServiceRole instead.
 *
 * Returns only minimal, non-sensitive fields (id, name, team) — never
 * medical_notes, date_of_birth, emergency contacts, or phone numbers — so
 * this lookup-by-email flow can't be used to re-open the medical-data leak
 * the Player RLS tightening closed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { email } = await req.json();
    const searchEmail = (email || '').trim().toLowerCase();
    if (!searchEmail) return Response.json({ error: 'email is required' }, { status: 400 });

    const players = await base44.asServiceRole.entities.Player.filter({ parent_email: searchEmail });

    // Minimal, non-sensitive fields only
    const safePlayers = players.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      team_id: p.team_id,
      team_name: p.team_name,
    }));

    console.log(`[findPlayerByEmail] user=${user.email} searchEmail=${searchEmail} matches=${safePlayers.length}`);
    return Response.json({ players: safePlayers });

  } catch (error) {
    console.error('[findPlayerByEmail]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
