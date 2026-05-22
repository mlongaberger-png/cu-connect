import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Extracts stats for ALL players on a team from a single uploaded stat sheet.
// The AI parses each player row and saves a PlayerStats record per player per stat category.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !["admin", "athletic_director", "coach"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { file_url, team_id, team_name, season_label } = await req.json();
    if (!file_url || !team_id) {
      return Response.json({ error: "file_url and team_id are required" }, { status: 400 });
    }

    console.log(`Extracting team stats for team ${team_name} (${team_id}) from ${file_url}`);

    // Fetch all active players on this team so AI can match names
    const players = await base44.asServiceRole.entities.Player.filter({ team_id, is_active: true });
    const playerNames = players.map(p => `${p.first_name} ${p.last_name}`).join(", ");
    console.log(`Players on team: ${playerNames}`);

    const result = await base44.integrations.Core.InvokeLLM({
      model: "claude_sonnet_4_6",
      prompt: `You are a baseball stats extractor. Analyze this stat sheet image or document and extract statistics for EVERY player listed.

Known players on this team: ${playerNames}

For each player found in the document, extract all available stats:
- HITTING: AVG, AB, H, R, RBI, HR, BB, K, OBP, SLG
- PITCHING: ERA, IP, W, L, SO, BB, WHIP  
- FIELDING: PO, A, E, FPCT

Rules:
- Match player names case-insensitively to the known players list. Use the exact name from the known list when matched.
- Include ALL players found in the document, even if not in the known list.
- Only include stat categories that have actual data in the document.
- Return numbers as strings (e.g. "0.312", "45").
- For any stat not present, use null.
- stat_types_present per player should list which categories have data.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          players: {
            type: "array",
            items: {
              type: "object",
              properties: {
                player_name: { type: "string" },
                stat_types_present: { type: "array", items: { type: "string" } },
                hitting: {
                  type: "object",
                  properties: {
                    avg: { type: "string" }, ab: { type: "string" }, h: { type: "string" },
                    r: { type: "string" }, rbi: { type: "string" }, hr: { type: "string" },
                    bb: { type: "string" }, k: { type: "string" }, obp: { type: "string" }, slg: { type: "string" }
                  }
                },
                pitching: {
                  type: "object",
                  properties: {
                    era: { type: "string" }, ip: { type: "string" }, w: { type: "string" },
                    l: { type: "string" }, so: { type: "string" }, bb: { type: "string" }, whip: { type: "string" }
                  }
                },
                fielding: {
                  type: "object",
                  properties: {
                    po: { type: "string" }, a: { type: "string" }, e: { type: "string" }, fpct: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`AI found ${result.players?.length || 0} players`);

    // Build a name->player map for quick lookup
    const playerMap = {};
    players.forEach(p => {
      playerMap[`${p.first_name} ${p.last_name}`.toLowerCase()] = p;
    });

    const base = { team_id, team_name, season_label, source_file_url: file_url, uploaded_by: user.email };
    let totalCreated = 0;
    const playerResults = [];

    for (const extracted of (result.players || [])) {
      const nameLower = (extracted.player_name || "").toLowerCase().trim();
      const matchedPlayer = playerMap[nameLower];

      const player_id = matchedPlayer?.id || null;
      const player_name = matchedPlayer
        ? `${matchedPlayer.first_name} ${matchedPlayer.last_name}`
        : extracted.player_name;

      if (!player_id) {
        console.warn(`Could not match player: "${extracted.player_name}" — skipping`);
        playerResults.push({ player_name: extracted.player_name, matched: false, records: 0 });
        continue;
      }

      const statBase = { ...base, player_id, player_name };
      const statTypes = extracted.stat_types_present || [];
      let created = 0;

      if (statTypes.includes("hitting") && extracted.hitting) {
        const h = extracted.hitting;
        await base44.entities.PlayerStats.create({
          ...statBase, stat_type: "hitting",
          hitting_avg: h.avg, hitting_ab: h.ab, hitting_h: h.h, hitting_r: h.r,
          hitting_rbi: h.rbi, hitting_hr: h.hr, hitting_bb: h.bb, hitting_k: h.k,
          hitting_obp: h.obp, hitting_slg: h.slg
        });
        created++;
      }

      if (statTypes.includes("pitching") && extracted.pitching) {
        const p = extracted.pitching;
        await base44.entities.PlayerStats.create({
          ...statBase, stat_type: "pitching",
          pitching_era: p.era, pitching_ip: p.ip, pitching_w: p.w, pitching_l: p.l,
          pitching_so: p.so, pitching_bb: p.bb, pitching_whip: p.whip
        });
        created++;
      }

      if (statTypes.includes("fielding") && extracted.fielding) {
        const f = extracted.fielding;
        await base44.entities.PlayerStats.create({
          ...statBase, stat_type: "fielding",
          fielding_po: f.po, fielding_a: f.a, fielding_e: f.e, fielding_fpct: f.fpct
        });
        created++;
      }

      totalCreated += created;
      playerResults.push({ player_name, matched: true, records: created });
    }

    console.log(`Done. Total records created: ${totalCreated}`);
    return Response.json({ success: true, total_records: totalCreated, players: playerResults });
  } catch (error) {
    console.error("extractTeamStats error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});