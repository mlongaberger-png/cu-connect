import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only POST requests are accepted (scheduler always uses POST)
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // If a token is present, enforce admin/AD role
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const dbUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
      const callerRole = dbUsers[0]?.role;
      if (!['admin', 'athletic_director'].includes(callerRole)) {
        console.error(`gameDayWeatherAlert: forbidden role '${callerRole}' for ${caller.email}`);
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // No auth header = Base44 scheduled automation invocation; proceed as system

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
          const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: event.team_id, type: 'team' });
          const teamChannel = teamChannels[0];
          if (teamChannel) {
            await base44.asServiceRole.entities.Message.create({
              channel_id: teamChannel.id,
              content_text: `${headline}\n${body}`,
              message_type: 'text',
              sender_name: 'Weather Bot',
              sender_user_id: 'system',
            });
          }
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

      // Enqueue push notifications — processNotifications cron handles batched delivery
      if (parentEmails.length > 0) {
        await Promise.all(parentEmails.map(async (email) => {
          const dedupKey = `weather_alert_${event.id}_${email}`;
          const existing = await base44.asServiceRole.entities.NotificationQueue.filter({ dedup_key: dedupKey });
          if (existing.length > 0) return; // already queued
          return base44.asServiceRole.entities.NotificationQueue.create({
            user_email: email,
            title: headline,
            body,
            url: '/Schedule',
            source: 'weather_alert',
            dedup_key: dedupKey,
            status: 'pending',
          });
        })).catch(e => console.warn(`Failed to queue weather alerts: ${e.message}`));
      }

      // Email remains direct (email doesn't go through push queue)
      await Promise.allSettled(parentEmails.map(email =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: headline,
          body: `<h2>${headline}</h2><p>${body.replace(/ · /g, "<br>")}</p><p>Log in to the app to check for any schedule changes.</p>`,
        }).catch(e => console.warn(`Email failed for ${email}: ${e.message}`))
      ));

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