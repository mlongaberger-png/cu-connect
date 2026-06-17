import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Parses a schedule PDF using AI and returns extracted events
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director' && user.role !== 'coach')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { file_url, team_id, team_name, sport_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // Enforce team-scope: coaches can only parse schedules for teams they coach
    if (!['admin', 'athletic_director'].includes(user.role) && team_id) {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_id: user.id, team_id });
      if (profiles.length === 0) {
        return Response.json({ error: 'Forbidden: not authorized for this team' }, { status: 403 });
      }
    }

    const today = new Date().toISOString().split('T')[0];

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting a sports schedule from a PDF document for team "${team_name || 'Unknown'}" (${sport_name || 'sport'}).

Extract ALL events/games/practices from this schedule. Today is ${today}.

For each event, extract:
- title: descriptive title (e.g. "vs Lincoln High", "Practice", "Tournament at City Park")
- type: one of: practice, game, tournament, meeting, fundraiser, other
- date: in YYYY-MM-DD format
- start_time: in HH:MM 24h format if available, else empty string
- end_time: in HH:MM 24h format if available, else empty string
- location: venue/field name if mentioned, else empty string
- opponent: opponent team name for games/tournaments, else empty string
- notes: any extra details (weather notes, uniform notes, etc.), else empty string

Return ONLY events you can confidently extract. If a date is ambiguous, make your best guess based on context (year/season). If a field is truly unknown, use an empty string — never null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                type: { type: "string" },
                date: { type: "string" },
                start_time: { type: "string" },
                end_time: { type: "string" },
                location: { type: "string" },
                opponent: { type: "string" },
                notes: { type: "string" },
              }
            }
          }
        }
      }
    });

    const rawEvents = result?.events;
    if (!Array.isArray(rawEvents)) {
      const msg = 'AI returned no parseable event array from the PDF. The document may be scanned, image-only, or in an unsupported format.';
      console.error('parsePdfSchedule: bad LLM output', JSON.stringify(result));
      return Response.json({
        events: [],
        parse_error: true,
        parse_error_message: msg,
        parse_error_detail: JSON.stringify(result).slice(0, 500),
      }, { status: 422 });
    }

    const events = rawEvents.map(ev => ({
      title: ev.title || '',
      type: ev.type || 'other',
      date: ev.date || '',
      start_time: ev.start_time || '',
      end_time: ev.end_time || '',
      location: ev.location || '',
      opponent: ev.opponent || '',
      notes: ev.notes || '',
      team_id: team_id || '',
      team_name: team_name || '',
      sport_name: sport_name || '',
    })).filter(ev => ev.date); // drop events with no date

    if (events.length === 0) {
      console.warn(`parsePdfSchedule: 0 usable events extracted for team ${team_name}`);
      return Response.json({
        events: [],
        parse_error: true,
        parse_error_message: 'No events with valid dates could be extracted from this document.',
      }, { status: 422 });
    }

    console.log(`Parsed ${events.length} events from PDF for team ${team_name}`);
    return Response.json({ events, parse_error: false });
  } catch (error) {
    console.error('parsePdfSchedule error:', error.message);
    return Response.json({
      events: [],
      parse_error: true,
      parse_error_message: `Unexpected error during parsing: ${error.message}`,
    }, { status: 500 });
  }
});