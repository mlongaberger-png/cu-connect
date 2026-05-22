import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !["admin", "athletic_director", "coach"].includes(user.role)) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { file_url, player_id, player_name, team_id, team_name, season_label } = await req.json();
    if (!file_url || !player_id) {
      return Response.json({ error: "file_url and player_id are required" }, { status: 400 });
    }

    console.log(`Extracting stats for player ${player_name} from ${file_url}`);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a baseball stats extractor. Analyze this image or document and extract all baseball statistics you can find for the player named "${player_name}".

Extract stats into three categories:
- HITTING: AVG, AB, H, R, RBI, HR, BB, K, OBP, SLG
- PITCHING: ERA, IP, W, L, SO, BB, WHIP
- FIELDING: PO, A, E, FPCT

Rules:
- Only include categories that have actual data present in the image/document.
- For any stat not visible, use null.
- Return numbers as strings (e.g. "0.312", "45").
- If the document has multiple players, focus only on "${player_name}" or the most prominent player.
- stat_types_present should list which categories have data: ["hitting"], ["pitching"], ["fielding"] or multiple.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
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
    });

    console.log("AI extraction result:", JSON.stringify(result));

    const created = [];
    const stat_types = result.stat_types_present || [];

    const base = { player_id, player_name, team_id, team_name, season_label, source_file_url: file_url, uploaded_by: user.email };

    if (stat_types.includes("hitting") && result.hitting) {
      const h = result.hitting;
      const record = await base44.entities.PlayerStats.create({
        ...base, stat_type: "hitting",
        hitting_avg: h.avg, hitting_ab: h.ab, hitting_h: h.h, hitting_r: h.r,
        hitting_rbi: h.rbi, hitting_hr: h.hr, hitting_bb: h.bb, hitting_k: h.k,
        hitting_obp: h.obp, hitting_slg: h.slg
      });
      created.push(record);
    }

    if (stat_types.includes("pitching") && result.pitching) {
      const p = result.pitching;
      const record = await base44.entities.PlayerStats.create({
        ...base, stat_type: "pitching",
        pitching_era: p.era, pitching_ip: p.ip, pitching_w: p.w, pitching_l: p.l,
        pitching_so: p.so, pitching_bb: p.bb, pitching_whip: p.whip
      });
      created.push(record);
    }

    if (stat_types.includes("fielding") && result.fielding) {
      const f = result.fielding;
      const record = await base44.entities.PlayerStats.create({
        ...base, stat_type: "fielding",
        fielding_po: f.po, fielding_a: f.a, fielding_e: f.e, fielding_fpct: f.fpct
      });
      created.push(record);
    }

    // Notify parent guardians of this player
    try {
      const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({ player_id });
      for (const guardian of guardians) {
        if (guardian.user_email) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: guardian.user_email,
            subject: `New stats uploaded for ${player_name}`,
            body: `Hi,\n\nNew athletic stats have been uploaded for ${player_name} (${season_label || "this season"}).\n\nCategories updated: ${stat_types.join(", ") || "stats"}.\n\nLog in to the CU Connect parent portal to view the latest stats.\n\n— CU Connect`
          });
        }
      }
      console.log(`Notified ${guardians.length} guardian(s) for player ${player_name}`);
    } catch (notifyErr) {
      console.warn("Guardian notification failed (non-fatal):", notifyErr.message);
    }

    return Response.json({ success: true, records_created: created.length, stat_types, records: created });
  } catch (error) {
    console.error("extractBaseballStats error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});