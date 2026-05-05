import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all events scheduled for tomorrow
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const events = await base44.asServiceRole.entities.Event.filter({
      date: tomorrowStr,
      is_cancelled: false,
    });

    const outdoorEvents = events.filter(e => 
      ["game", "tournament", "practice"].includes(e.type) && e.location
    );

    if (outdoorEvents.length === 0) {
      console.log("No outdoor events tomorrow — skipping weather check.");
      return Response.json({ skipped: true, reason: "No outdoor events tomorrow" });
    }

    console.log(`Found ${outdoorEvents.length} events tomorrow. Checking weather...`);

    let alertsSent = 0;

    for (const event of outdoorEvents) {
      // Ask LLM for weather at the event location on the event date
      let weather;
      try {
        weather = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Get the current weather forecast specifically for this exact location: "${event.location}" on ${tomorrowStr}.
            IMPORTANT: Use the exact location string provided. Do NOT substitute or assume a different city.
            Search for the weather at "${event.location}" — this may be a specific address, field name, or city in Oklahoma or surrounding states.
            Assess if conditions are concerning for an outdoor sports event (game/practice/tournament).
            Return the actual forecast data for that specific location and whether parents should be warned.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              temp_f: { type: "number" },
              condition: { type: "string" },
              condition_emoji: { type: "string" },
              wind_mph: { type: "number" },
              precipitation_chance: { type: "number" },
              is_concerning: { type: "boolean" },
              alert_message: { type: "string" },
              severity: { type: "string" }
            }
          }
        });
      } catch (e) {
        console.warn(`Weather lookup failed for event ${event.id}: ${e.message}`);
        continue;
      }

      console.log(`Event: ${event.title} | Weather: ${weather.condition} | Concerning: ${weather.is_concerning}`);

      if (!weather.is_concerning) continue;

      // Build alert message
      const headline = `${weather.condition_emoji || "⚠️"} Weather Alert: ${event.title}`;
      const body = [
        `Tomorrow's ${event.type} at ${event.location}`,
        `Forecast: ${weather.condition}`,
        weather.temp_f ? `Temp: ${Math.round(weather.temp_f)}°F` : null,
        weather.wind_mph ? `Wind: ${Math.round(weather.wind_mph)} mph` : null,
        weather.precipitation_chance ? `Rain chance: ${weather.precipitation_chance}%` : null,
        weather.alert_message || null,
        "Check the app for any updates or cancellations.",
      ].filter(Boolean).join(" · ");

      // Post a message in the team channel
      if (event.team_id) {
        try {
          await base44.asServiceRole.entities.Message.create({
            content: `${headline}\n${body}`,
            channel: "team",
            channel_id: event.team_id,
            channel_name: event.team_name || "Team",
            sender_name: "Weather Bot",
            sender_email: "weatherbot@system",
          });
        } catch (e) {
          console.warn(`Failed to post team message: ${e.message}`);
        }
      }

      // Find parents for this team and notify
      let parentEmails = [];
      if (event.team_id) {
        const players = await base44.asServiceRole.entities.Player.filter({
          team_id: event.team_id,
          is_active: true,
        });
        parentEmails = [...new Set(players.map(p => p.parent_email).filter(Boolean))];
      }

      // Send push notifications
      const pushSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
      const targetSubs = pushSubs.filter(s => parentEmails.includes(s.user_email));

      for (const sub of targetSubs) {
        try {
          await base44.asServiceRole.functions.invoke('sendPushNotification', {
            endpoint: sub.endpoint,
            p256dh_key: sub.p256dh_key,
            auth_key: sub.auth_key,
            title: headline,
            body: body,
            url: "/Schedule",
          });
        } catch (e) {
          console.warn(`Push failed: ${e.message}`);
        }
      }

      // Send emails
      for (const email of parentEmails) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: headline,
            body: `<h2>${headline}</h2><p>${body.replace(/ · /g, "<br>")}</p><p>Log in to the app to check for any schedule changes.</p>`,
          });
        } catch (e) {
          console.warn(`Email failed for ${email}: ${e.message}`);
        }
      }

      alertsSent++;
      console.log(`Alert sent for: ${event.title} | ${parentEmails.length} parents notified`);
    }

    return Response.json({
      success: true,
      events_checked: outdoorEvents.length,
      alerts_sent: alertsSent,
    });

  } catch (error) {
    console.error("gameDayWeatherAlert error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});