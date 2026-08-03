import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizeStr(s) {
  return (s || '').toLowerCase().trim();
}

/**
 * Server-side duplicate-detection search for AddChildForm: finds existing
 * Player records whose name (and, if supplied, date of birth) plausibly
 * matches what a parent just typed in, so they can link to an existing
 * profile instead of creating a duplicate.
 *
 * This is a cross-roster name search, not "get my players" — Player RLS
 * only exposes the caller's own linked players, so this has to run here via
 * asServiceRole. Returns only minimal, non-sensitive fields (id, name,
 * team) — never medical_notes, date_of_birth, emergency contacts, or phone
 * numbers — so this search-by-name utility can't become a new way to read
 * the medical data the Player RLS tightening closed off. date_of_birth is
 * used only for server-side match filtering, never returned.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { first_name, last_name, date_of_birth } = await req.json();
    const fn = normalizeStr(first_name);
    const ln = normalizeStr(last_name);
    if (!fn && !ln) return Response.json({ players: [] });

    const allPlayers = await base44.asServiceRole.entities.Player.list('-created_date', 1000);
    const matches = allPlayers.filter(p => {
      const pfn = normalizeStr(p.first_name);
      const pln = normalizeStr(p.last_name);
      const nameMatch = (fn && pfn.startsWith(fn)) || (ln && pln.startsWith(ln));
      const dobMatch = !date_of_birth || !p.date_of_birth || p.date_of_birth === date_of_birth;
      return nameMatch && dobMatch;
    }).slice(0, 20);

    // Minimal, non-sensitive fields only — no medical_notes, DOB, contacts, phone
    const safeMatches = matches.map(p => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      team_id: p.team_id,
      team_name: p.team_name,
    }));

    console.log(`[findPlayerMatches] user=${user.email} fn=${fn} ln=${ln} matches=${safeMatches.length}`);
    return Response.json({ players: safeMatches });

  } catch (error) {
    console.error('[findPlayerMatches]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
