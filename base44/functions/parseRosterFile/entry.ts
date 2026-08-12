import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Parses a roster PDF/spreadsheet using AI and returns extracted players
//
// Bug fix Aug 12, 2026: ported the same CSV fix applied to
// parseCoachComplianceFile/entry.ts (see that file's header comment for the
// full root-cause writeup). InvokeLLM's file_urls (vision/doc) path can
// return fabricated rows instead of real content for plain-text CSV uploads,
// because file_urls is meant for documents that need to be *seen* (scanned
// lists, PDFs), not raw text. This was confirmed live for coach-compliance
// CSVs; rosters use the identical InvokeLLM + file_urls pattern so the same
// failure mode applies here too. Fix: detect CSV (same heuristic as
// extractTeamStats/extractBaseballStats), fetch its real text, and inline it
// directly into the prompt instead of passing it through file_urls.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director' && user.role !== 'coach')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { file_url, team_id, team_name, sport_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url is required' }, { status: 400 });

    // Enforce team-scope: coaches can only access teams they coach; admins/ADs unrestricted
    if (!['admin', 'athletic_director'].includes(user.role) && team_id) {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_id: user.id, team_id });
      if (profiles.length === 0) {
        return Response.json({ error: 'Forbidden: not authorized for this team' }, { status: 403 });
      }
    }

    // Detect CSV and fetch its real text instead of relying on file_urls to "see" it.
    const isCSV = /\.csv|text%2Fcsv|csv/i.test(file_url);
    let csvText = null;
    if (isCSV) {
      console.log('parseRosterFile: detected CSV -- fetching as text');
      const fileRes = await fetch(file_url);
      csvText = await fileRes.text();
      console.log(`parseRosterFile: CSV preview: ${csvText.slice(0, 500)}`);
    }

    const basePrompt = `You are extracting a sports team roster from a document for team "${team_name || 'Unknown'}" (${sport_name || 'sport'}).

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

Return ONLY players you can confidently identify. If a field is unknown, use an empty string — never null.`;

    const prompt = csvText
      ? `${basePrompt}\n\nHere is the raw CSV/spreadsheet data:\n\`\`\`\n${csvText}\n\`\`\``
      : `${basePrompt}\n\nAnalyze the attached document.`;

    const llmParams = {
      prompt,
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
    };
    if (!csvText) {
      llmParams.file_urls = [file_url];
    }

    const result = await base44.integrations.Core.InvokeLLM(llmParams);

    const rawPlayers = result?.players;
    if (!Array.isArray(rawPlayers)) {
      const msg = 'AI returned no parseable player array from the file. The document may be scanned, image-only, or in an unsupported format.';
      console.error('parseRosterFile: bad LLM output', JSON.stringify(result));
      return Response.json({
        players: [],
        parse_error: true,
        parse_error_message: msg,
        parse_error_detail: JSON.stringify(result).slice(0, 500),
      }, { status: 422 });
    }

    const players = rawPlayers
      .filter(p => p.first_name || p.last_name) // drop fully empty rows
      .map(p => ({
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

    if (players.length === 0) {
      console.warn(`parseRosterFile: 0 usable players extracted for team ${team_name}`);
      return Response.json({
        players: [],
        parse_error: true,
        parse_error_message: 'No players with valid names could be extracted from this document.',
      }, { status: 422 });
    }

    console.log(`Parsed ${players.length} players from roster file for team ${team_name}`);
    return Response.json({ players, parse_error: false });
  } catch (error) {
    console.error('parseRosterFile error:', error.message);
    return Response.json({
      players: [],
      parse_error: true,
      parse_error_message: `Unexpected error during parsing: ${error.message}`,
    }, { status: 500 });
  }
});