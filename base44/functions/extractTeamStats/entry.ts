import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Determine if a stat object has any meaningful (non-null) values
// Handles cases where LLM returns the string "null" instead of actual null
function hasData(obj) {
  if (!obj || typeof obj !== "object") return false;
  return Object.values(obj).some(v => v !== null && v !== undefined && v !== "" && v !== "null" && v !== "N/A" && v !== "-");
}

// Clean a stat value — converts string "null" / "N/A" / "-" to actual null
function cleanVal(v) {
  if (v === null || v === undefined || v === "" || v === "null" || v === "N/A" || v === "-") return null;
  return v;
}

// Clean all values in a stat object
function cleanStats(obj) {
  if (!obj) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = cleanVal(v);
  return out;
}

// Fuzzy name matching — handles "Last, First" vs "First Last" and partial matches
function matchPlayerName(extractedName, playerMap) {
  const clean = (s) => (s || "").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  const target = clean(extractedName);

  // Exact match
  if (playerMap[target]) return playerMap[target];

  // Try reversed "Last, First" -> "First Last"
  if (target.includes(",")) {
    const parts = target.split(",").map(s => s.trim());
    const reversed = `${parts[1]} ${parts[0]}`.trim();
    if (playerMap[reversed]) return playerMap[reversed];
  }

  // Partial match: if all words in extractedName appear in a known player name
  const targetWords = target.split(/\s+/).filter(Boolean);
  for (const [key, player] of Object.entries(playerMap)) {
    const keyWords = key.split(/\s+/).filter(Boolean);
    if (targetWords.every(w => keyWords.some(kw => kw.startsWith(w) || w.startsWith(kw)))) {
      return player;
    }
  }

  return null;
}

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

    // Enforce team-scope: coaches can only access teams they coach; admins/ADs unrestricted
    if (!["admin", "athletic_director"].includes(user.role)) {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_id: user.id, team_id });
      if (profiles.length === 0) {
        return Response.json({ error: "Forbidden: not authorized for this team" }, { status: 403 });
      }
    }

    console.log(`[extractTeamStats] Starting for team: ${team_name} (${team_id})`);
    console.log(`[extractTeamStats] File URL: ${file_url}`);

    // Fetch all active players on this team
    const players = await base44.asServiceRole.entities.Player.filter({ team_id, is_active: true });
    const playerList = players.map(p => `${p.first_name} ${p.last_name}`);
    console.log(`[extractTeamStats] Roster (${players.length} players): ${playerList.join(", ")}`);

    if (players.length === 0) {
      return Response.json({ error: "No active players found on this team" }, { status: 400 });
    }

    // Build name lookup map
    const playerMap = {};
    players.forEach(p => {
      playerMap[`${p.first_name} ${p.last_name}`.toLowerCase()] = p;
    });

    // Detect CSV
    const isCSV = /\.csv|text%2Fcsv|csv/i.test(file_url);
    let csvText = null;
    if (isCSV) {
      console.log("[extractTeamStats] Detected CSV — fetching as text");
      const fileRes = await fetch(file_url);
      csvText = await fileRes.text();
      console.log(`[extractTeamStats] CSV preview: ${csvText.slice(0, 800)}`);
    } else {
      console.log("[extractTeamStats] Treating as image/PDF — using vision model");
    }

    const prompt = `You are an expert baseball statistics extractor.

${csvText
  ? `Here is raw CSV/spreadsheet data:\n\`\`\`\n${csvText}\n\`\`\``
  : `Analyze the attached image or PDF stat sheet.`}

Known roster for team "${team_name}":
${playerList.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Extract statistics for EVERY player you find in the data. Match player names to the known roster (case-insensitive, handle abbreviations/nicknames).

For each player found, return:
- player_name: the exact name from the known roster if matched, otherwise the name as written
- stat_types_present: array of which categories have data (e.g. ["hitting"] or ["hitting","pitching"])
- hitting: { avg, ab, h, r, rbi, hr, bb, k, obp, slg } — use null for missing
- pitching: { era, ip, w, l, so, bb, whip } — use null for missing
- fielding: { po, a, e, fpct } — use null for missing

IMPORTANT:
- Return ALL players found, even if only partial data exists
- All numeric values as strings (e.g. "0.312", "14")
- If any field in a category has a value, include that category in stat_types_present
- Do NOT return an empty players array if there is data in the document`;

    const llmParams = {
      model: csvText ? "gemini_3_flash" : "gemini_3_1_pro",
      prompt,
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
    };

    if (!csvText) {
      llmParams.file_urls = [file_url];
    }

    const result = await base44.integrations.Core.InvokeLLM(llmParams);
    console.log(`[extractTeamStats] AI returned ${result.players?.length || 0} player(s)`);
    console.log("[extractTeamStats] Full AI result:", JSON.stringify(result).slice(0, 2000));

    const base = { team_id, team_name, season_label, source_file_url: file_url, uploaded_by: user.email };
    let totalCreated = 0;
    const playerResults = [];

    for (const extracted of (result.players || [])) {
      const matchedPlayer = matchPlayerName(extracted.player_name, playerMap);

      if (!matchedPlayer) {
        console.warn(`[extractTeamStats] No roster match for: "${extracted.player_name}"`);
        playerResults.push({ player_name: extracted.player_name, matched: false, records: 0 });
        continue;
      }

      const player_id = matchedPlayer.id;
      const player_name = `${matchedPlayer.first_name} ${matchedPlayer.last_name}`;
      const statBase = { ...base, player_id, player_name };

      // Auto-detect categories from actual data
      const declared = Array.isArray(extracted.stat_types_present) ? extracted.stat_types_present : [];
      const statTypes = [
        ...((declared.includes("hitting") || hasData(extracted.hitting)) ? ["hitting"] : []),
        ...((declared.includes("pitching") || hasData(extracted.pitching)) ? ["pitching"] : []),
        ...((declared.includes("fielding") || hasData(extracted.fielding)) ? ["fielding"] : []),
      ];

      console.log(`[extractTeamStats] ${player_name} → matched, categories: ${JSON.stringify(statTypes)}`);

      let created = 0;

      if (statTypes.includes("hitting") && extracted.hitting) {
        const h = cleanStats(extracted.hitting);
        await base44.asServiceRole.entities.PlayerStats.create({
          ...statBase, stat_type: "hitting",
          hitting_avg: h.avg, hitting_ab: h.ab, hitting_h: h.h, hitting_r: h.r,
          hitting_rbi: h.rbi, hitting_hr: h.hr, hitting_bb: h.bb, hitting_k: h.k,
          hitting_obp: h.obp, hitting_slg: h.slg
        });
        created++;
      }

      if (statTypes.includes("pitching") && extracted.pitching) {
        const p = cleanStats(extracted.pitching);
        await base44.asServiceRole.entities.PlayerStats.create({
          ...statBase, stat_type: "pitching",
          pitching_era: p.era, pitching_ip: p.ip, pitching_w: p.w, pitching_l: p.l,
          pitching_so: p.so, pitching_bb: p.bb, pitching_whip: p.whip
        });
        created++;
      }

      if (statTypes.includes("fielding") && extracted.fielding) {
        const f = cleanStats(extracted.fielding);
        await base44.asServiceRole.entities.PlayerStats.create({
          ...statBase, stat_type: "fielding",
          fielding_po: f.po, fielding_a: f.a, fielding_e: f.e, fielding_fpct: f.fpct
        });
        created++;
      }

      totalCreated += created;
      playerResults.push({ player_name, matched: true, records: created, stat_types: statTypes });
    }

    console.log(`[extractTeamStats] Done — ${totalCreated} total record(s) across ${playerResults.filter(r => r.matched).length} matched player(s)`);
    return Response.json({ success: true, total_records: totalCreated, players: playerResults });
  } catch (error) {
    console.error("[extractTeamStats] Fatal error:", error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});