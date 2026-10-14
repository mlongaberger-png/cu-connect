import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// publicPrograms
//
// Read-only list of programs the public website can register families for.
// Called cross-origin by the Cornerstone United website (no login), so it
// answers CORS preflights and only returns public, non-sensitive fields.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const PUBLIC_FIELDS = [
  'id', 'name', 'sport_name', 'season', 'ages_label', 'age_min', 'age_max', 'age_cutoff_date',
  'fee_registration', 'fee_equipment', 'fee_fundraising', 'fee_uniform',
  'plan_enabled', 'plan_due_2', 'plan_due_3', 'registration_opens', 'registration_closes',
  'status', 'test_mode', 'description', 'sort_order',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const all = await base44.asServiceRole.entities.Program.list('sort_order', 200);
    const programs = all
      .filter((p) => p.status === 'open' || p.status === 'coming_soon')
      .map((p) => Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, p[k] ?? null])));
    return Response.json({ programs }, { headers: { ...CORS, 'Cache-Control': 'public, max-age=60' } });
  } catch (error) {
    console.error('[publicPrograms]', error.message);
    return Response.json({ error: 'Could not load programs' }, { status: 500, headers: CORS });
  }
});
