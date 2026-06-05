import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import webpush from 'npm:web-push@3.6.7';

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

    // Detect if this is a CSV file and read it as text
    const isCSV = file_url.toLowerCase().includes('.csv') || file_url.toLowerCase().includes('text%2Fcsv');
    let csvText = null;
    if (isCSV) {
      console.log("Detected CSV file — fetching as text");
      const fileRes = await fetch(file_url);
      csvText = await fileRes.text();
      console.log(`CSV content (first 500 chars): ${csvText.slice(0, 500)}`);
    }

    const promptBase = `You are a baseball stats extractor. Analyze this stat sheet and extract all baseball statistics you can find for the player named "${player_name}".

Extract stats into three categories:
- HITTING: AVG, AB, H, R, RBI, HR, BB, K, OBP, SLG
- PITCHING: ERA, IP, W, L, SO, BB, WHIP
- FIELDING: PO, A, E, FPCT

Rules:
- Only include categories that have actual data present.
- For any stat not visible, use null.
- Return numbers as strings (e.g. "0.312", "45").
- If the document has multiple players, focus only on "${player_name}" or the most prominent player.
- stat_types_present should list which categories have data: ["hitting"], ["pitching"], ["fielding"] or multiple.`;

    const llmParams = {
      prompt: csvText
        ? `${promptBase}\n\nHere is the CSV data:\n\`\`\`\n${csvText}\n\`\`\``
        : promptBase,
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

    // Only pass file_urls for non-CSV files (images/PDFs)
    if (!csvText) {
      llmParams.file_urls = [file_url];
    }

    const result = await base44.integrations.Core.InvokeLLM(llmParams);

    console.log("AI extraction result:", JSON.stringify(result));

    const created = [];
    const stat_types = result.stat_types_present || [];

    const base = { player_id, player_name, team_id, team_name, season_label, source_file_url: file_url, uploaded_by: user.email };

    if (stat_types.includes("hitting") && result.hitting) {
      const h = result.hitting;
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "hitting",
        hitting_avg: h.avg, hitting_ab: h.ab, hitting_h: h.h, hitting_r: h.r,
        hitting_rbi: h.rbi, hitting_hr: h.hr, hitting_bb: h.bb, hitting_k: h.k,
        hitting_obp: h.obp, hitting_slg: h.slg
      });
      created.push(record);
    }

    if (stat_types.includes("pitching") && result.pitching) {
      const p = result.pitching;
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "pitching",
        pitching_era: p.era, pitching_ip: p.ip, pitching_w: p.w, pitching_l: p.l,
        pitching_so: p.so, pitching_bb: p.bb, pitching_whip: p.whip
      });
      created.push(record);
    }

    if (stat_types.includes("fielding") && result.fielding) {
      const f = result.fielding;
      const record = await base44.asServiceRole.entities.PlayerStats.create({
        ...base, stat_type: "fielding",
        fielding_po: f.po, fielding_a: f.a, fielding_e: f.e, fielding_fpct: f.fpct
      });
      created.push(record);
    }

    // Push-notify parent guardians of this player
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
            body: `${season_label || "Stats"} updated: ${stat_types.join(", ") || "stats"}.`,
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
          console.log(`Push notifications sent to ${guardianEmails.length} guardian(s) for ${player_name}`);
        }
      }
    } catch (notifyErr) {
      console.warn("Guardian push notification failed (non-fatal):", notifyErr.message);
    }

    return Response.json({ success: true, records_created: created.length, stat_types, records: created });
  } catch (error) {
    console.error("extractBaseballStats error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});