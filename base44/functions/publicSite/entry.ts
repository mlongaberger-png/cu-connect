import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// publicSite
//
// Everything the public Cornerstone United website shows that is managed in
// CU Connect, in one read-only call (no login, CORS open):
//   * schedule  - upcoming games/tournaments (next 60 days) and recent results
//                 (last 150 days). Practices and meetings are left out on purpose:
//                 practice spots are where kids are every week, so they stay in the app.
//   * news      - announcements an admin marked "Also post on the website"
//   * featured  - newest website-featured announcement whose event hasn't passed
//   * sponsors  - active, approved sponsors
//   * fields    - active field status entries
// Coaches enter scores in the app after a game; the website picks them up here.
// Teams marked hide_from_website (and demo teams) are never included.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const TZ = 'America/Chicago';
const dayInTz = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const EVENT_FIELDS = ['id', 'title', 'type', 'date', 'start_time', 'end_time', 'team_name', 'sport_name', 'opponent',
  'location', 'is_cancelled', 'result', 'our_score', 'opponent_score', 'tournament_round', 'is_championship_win'];
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
const PUBLIC_TYPES = new Set(['game', 'tournament']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  try {
    const db = createClientFromRequest(req).asServiceRole.entities;
    const today = dayInTz(0);
    const from = dayInTz(-150);
    const to = dayInTz(60);

    const [teams, events, announcements, sponsors, fields] = await Promise.all([
      db.Team.list('name', 500),
      db.Event.filter({ date: { $gte: from, $lte: to } }, 'date', 1000),
      db.Announcement.filter({ show_on_website: true }, '-created_date', 30),
      db.Sponsor.filter({ is_active: true }, 'business_name', 200),
      db.FieldStatus.filter({ is_active: true }, '-updated_at', 20),
    ]);

    const hidden = new Set(teams
      .filter((t) => t.hide_from_website || t.is_active === false || /demo|test/i.test(t.name || ''))
      .map((t) => t.id));

    const publicEvents = events
      .filter((e) => PUBLIC_TYPES.has(e.type) && e.date && !hidden.has(e.team_id))
      .sort((a, b) => (a.date + (a.start_time || '')).localeCompare(b.date + (b.start_time || '')));

    const hasScore = (e) => e.result || (e.our_score != null && e.opponent_score != null);
    const upcoming = publicEvents.filter((e) => e.date >= today && !hasScore(e)).map((e) => pick(e, EVENT_FIELDS));
    const results = publicEvents.filter((e) => e.date <= today && hasScore(e) && !e.is_cancelled)
      .reverse().map((e) => pick(e, EVENT_FIELDS));

    const news = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.content,
      category: a.website_category || 'club',
      published_date: (a.created_date || '').slice(0, 10),
      event_date: a.event_date || null,
      event_details: a.event_details || null,
      is_featured: !!a.website_featured,
    }));
    const featured = news.find((n) => n.is_featured && (!n.event_date || n.event_date >= today)) || null;

    const publicSponsors = sponsors
      .filter((s) => !s.approval_status || s.approval_status === 'approved')
      .map((s) => pick(s, ['id', 'business_name', 'tier', 'website_url', 'logo_url']));

    const publicFields = fields
      .filter((f) => !/^zz_?test/i.test(f.location_name || ''))
      .map((f) => pick(f, ['id', 'location_name', 'status', 'alert_message', 'updated_at']));

    return Response.json(
      { today, schedule: { upcoming, results }, news, featured, sponsors: publicSponsors, fields: publicFields },
      { headers: { ...CORS, 'Cache-Control': 'public, max-age=60' } },
    );
  } catch (error) {
    console.error('[publicSite]', error.message);
    return Response.json({ error: 'Could not load site data' }, { status: 500, headers: CORS });
  }
});
