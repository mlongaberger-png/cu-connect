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

    const events = (result?.events || []).map(ev => ({
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
    }));

    console.log(`Parsed ${events.length} events from PDF for team ${team_name}`);
    return Response.json({ events });
  } catch (error) {
    console.error('parsePdfSchedule error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});