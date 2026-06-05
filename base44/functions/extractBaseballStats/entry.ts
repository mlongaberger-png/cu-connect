import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import webpush from 'npm:web-push@3.6.7';

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

    console.log(`[extractBaseballStats] Starting for player: ${player_name} (${player_id})`);
    console.log(`[extractBaseballStats] File URL: ${file_url}`);

    // Detect if this is a CSV file and read it as text
    const isCSV = /\.csv|text%2Fcsv|csv/i.test(file_url);
    let csvText = null;
    if (isCSV) {
      console.log("[extractBaseballStats] Detected CSV — fetching as text");
      const fileRes = await fetch(file_url);
      csvText = await fileRes.text();
      console.log(`[extractBaseballStats] CSV preview: ${csvText.slice(0, 600)}`);
    } else {
      console.log("[extractBaseballStats] Treating as image/PDF — passing to vision model");
    }

    const prompt = `You are an expert baseball statistics extractor.

${csvText
  ? `Here is raw CSV data:\n\`\`\`\n${csvText}\n\`\`\``
  : `Analyze the attached image or PDF stat sheet.`}

Extract all baseball statistics for the player named "${player_name}".
If the document contains multiple players, focus on "${player_name}" only.

Return a JSON object with FOUR fields:
1. "stat_types_present" - array of which categories have data, e.g. ["hitting", "pitching"]
2. "hitting" - object with: avg, ab, h, r, rbi, hr, bb, k, obp, slg (use null for missing)
3. "pitching" - object with: era, ip, w, l, so, bb, whip (use null for missing)  
4. "fielding" - object with: po, a, e, fpct (use null for missing)

IMPORTANT:
- All numeric values must be returned as strings (e.g. "0.312", "14", "2.50")
- If a category has ANY data at all, include it in stat_types_present
- Do not leave stat_types_present empty if you found stats`;

    const llmParams = {
      model: csvText ? "gemini_3_flash" : "gemini_3_1_pro",
      prompt,
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
    };

    if (!csvText) {
      llmParams.file_urls = [file_url];
    }

    const result = await base44.integrations.Core.InvokeLLM(llmParams);
    console.log("[extractBaseballStats] Raw AI result:", JSON.stringify(result));

    // Auto-detect from data even if stat_types_present is wrong/missing
    const stat_types_declared = Array.isArray(result.stat_types_present) ? result.stat_types_present : [];
    const hittingHasData = hasData(result.hitting);
    const pitchingHasData = hasData(result.pitching);
    const fieldingHasData = hasData(result.fielding);

    const stat_types = [
      ...(stat_types_declared.includes("hitting") || hittingHasData ? ["hitting"] : []),
      ...(stat_types_declared.includes("pitching") || pitchingHasData ? ["pitching"] : []),
      ...(stat_types_declared.includes("fielding") || fieldingHasData ? ["fielding"] : []),
    ];

    console.log(`[extractBaseballStats] stat_types_declared=${JSON.stringify(stat_types_declared)}, auto-detected=${JSON.stringify(stat_types)}`);
    console.log(`[extractBaseballStats] hittingHasData=${hittingHasData}, pitchingHasData=${pitchingHasData}, fieldingHasData=${fieldingHasData}`);

    if (stat_types.length === 0) {
      console.warn("[extractBaseballStats] No stat data found in AI response — returning 0 records");
      return Response.json({ success: false, records_created: 0, stat_types: [], error: "AI could not find stats in this file" });
    }

    const created = [];
    const base = { player_id, player_name, team_id, team_name, season_label, source_file_url: file_url, uploaded_by: user.email };

    if (stat_types.includes("hitting") && result.hitting) {
      const h = cleanStats(result.hitting);
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "hitting",
        hitting_avg: h.avg, hitting_ab: h.ab, hitting_h: h.h, hitting_r: h.r,
        hitting_rbi: h.rbi, hitting_hr: h.hr, hitting_bb: h.bb, hitting_k: h.k,
        hitting_obp: h.obp, hitting_slg: h.slg
      });
      console.log(`[extractBaseballStats] Created hitting record: ${record.id}`);
      created.push(record);
    }

    if (stat_types.includes("pitching") && result.pitching) {
      const p = cleanStats(result.pitching);
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "pitching",
        pitching_era: p.era, pitching_ip: p.ip, pitching_w: p.w, pitching_l: p.l,
        pitching_so: p.so, pitching_bb: p.bb, pitching_whip: p.whip
      });
      console.log(`[extractBaseballStats] Created pitching record: ${record.id}`);
      created.push(record);
    }

    if (stat_types.includes("fielding") && result.fielding) {
      const f = cleanStats(result.fielding);
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "fielding",
        fielding_po: f.po, fielding_a: f.a, fielding_e: f.e, fielding_fpct: f.fpct
      });
      console.log(`[extractBaseballStats] Created fielding record: ${record.id}`);
      created.push(record);
    }

    console.log(`[extractBaseballStats] Done — ${created.length} record(s) created for ${player_name}`);

    // Push-notify parent guardians (non-fatal)
    try {
      const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({ player_id });
      const guardianEmails = guardians.map(g => g.user_email).filter(Boolean);

      if (guardianEmails.length > 0) {
        const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });
        if (configs.length) {
          const { publicKey, privateKey } = JSON.parse(configs[0].value);
          webpush.setVapidDetails('mailto:noreply@cornerstoneathletics.com', publicKey, privateKey);

          const allSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
          const subsMap = {};
          allSubs.forEach(s => {
            if (!s.user_email) return;
            const k = s.user_email.toLowerCase();
            if (!subsMap[k]) subsMap[k] = [];
            subsMap[k].push(s);
          });

          const pushPayload = JSON.stringify({
            title: `New stats for ${player_name}`,
            body: `${season_label || "Stats"} updated: ${stat_types.join(", ")}.`,
            url: "/ParentPortal"
          });

          const pushPromises = [];
          for (const email of guardianEmails) {
            const subs = subsMap[email.toLowerCase()] || [];
            for (const sub of subs) {
              pushPromises.push(
                webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
                  pushPayload
                ).catch(async (err) => {
                  if (err.statusCode === 410 || err.statusCode === 404) {
                    await base44.asServiceRole.entities.PushSubscription.update(sub.id, { is_active: false });
                  }
                  console.warn(`Push failed for ${email}:`, err.message);
                })
              );
            }
          }
          await Promise.all(pushPromises);
        }
      }
    } catch (notifyErr) {
      console.warn("[extractBaseballStats] Push notification failed (non-fatal):", notifyErr.message);
    }

    return Response.json({ success: true, records_created: created.length, stat_types, records: created });
  } catch (error) {
    console.error("[extractBaseballStats] Fatal error:", error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});