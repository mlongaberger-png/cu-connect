import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Parses a roster PDF/spreadsheet using AI and returns extracted players
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director' && user.role !== 'coach')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { file_url, team_id, team_name, sport_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are extracting a sports team roster from a document for team "${team_name || 'Unknown'}" (${sport_name || 'sport'}).

Extract ALL players/athletes listed in this document.

For each player, extract:
- first_name: player's first name
- last_name: player's last name
- jersey_number: jersey/uniform number (as a string), else empty string
- position: playing position, else empty string
- date_of_birth: in YYYY-MM-DD format if available, else empty string
- parent_name: parent or guardian name if listed, else empty string
- parent_email: parent email address if listed, else empty string
- parent_phone: parent phone number if listed, else empty string
- emergency_contact: emergency contact name if listed, else empty string
- emergency_phone: emergency contact phone if listed, else empty string
- medical_notes: any medical or allergy notes if listed, else empty string

Return ONLY players you can confidently identify. If a field is unknown, use an empty string — never null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          players: {
            type: "array",
            items: {
              type: "object",
              properties: {
                first_name: { type: "string" },
                last_name: { type: "string" },
                jersey_number: { type: "string" },
                position: { type: "string" },
                date_of_birth: { type: "string" },
                parent_name: { type: "string" },
                parent_email: { type: "string" },
                parent_phone: { type: "string" },
                emergency_contact: { type: "string" },
                emergency_phone: { type: "string" },
                medical_notes: { type: "string" },
              }
            }
          }
        }
      }
    });

    const players = (result?.players || []).map(p => ({
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      jersey_number: p.jersey_number || '',
      position: p.position || '',
      date_of_birth: p.date_of_birth || '',
      parent_name: p.parent_name || '',
      parent_email: p.parent_email || '',
      parent_phone: p.parent_phone || '',
      emergency_contact: p.emergency_contact || '',
      emergency_phone: p.emergency_phone || '',
      medical_notes: p.medical_notes || '',
      team_id: team_id || '',
      team_name: team_name || '',
      sport_name: sport_name || '',
      is_active: true,
    }));

    console.log(`Parsed ${players.length} players from roster file for team ${team_name}`);
    return Response.json({ players });
  } catch (error) {
    console.error('parseRosterFile error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});