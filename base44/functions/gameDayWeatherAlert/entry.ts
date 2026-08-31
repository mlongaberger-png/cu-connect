import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// --- Fixed message templates (replaces AI-generated wording, Aug 2026) ---
// Each template's body is composed with the shared closing line appended at send time.
// See "Message Templates" tab in the Weather_Alert_Messages.xlsx export for the human-readable version.
const TEMPLATES = {
  extreme_heat: {
    emoji: '🥵',
    headline: (event) => `🥵 Heat Advisory: ${event}`,
    body: (c) => `Tomorrow's ${c.event} at ${c.location} is forecast to reach ${c.temp}°F. Please send extra water, sunscreen, and light-colored clothing, and watch for signs of heat exhaustion.`,
  },
  high_heat: {
    emoji: '☀️',
    headline: (event) => `☀️ Weather Alert: ${event}`,
    body: (c) => `Tomorrow's ${c.event} at ${c.location} is forecast to be hot, reaching ${c.temp}°F. Please send plenty of water and sunscreen.`,
  },
  freezing_cold: {
    emoji: '🥶',
    headline: (event) => `🥶 Cold Weather Alert: ${event}`,
    body: (c) => `Tomorrow's ${c.event} at ${c.location} is forecast near or below freezing at ${c.temp}°F. Please dress your athlete in warm layers, gloves, and a hat.`,
  },
  extreme_cold: {
    emoji: '❄️',
    headline: (event) => `❄️ Extreme Cold Warning: ${event}`,
    body: (c) => `Tomorrow's ${c.event} at ${c.location} is forecast to reach a dangerously low ${c.temp}°F. Please ensure warm layers, gloves, and a hat, and limit exposed skin. This event may be delayed or moved indoors.`,
  },
  tornado: {
    emoji: '🌪️',
    headline: (event) => `🌪️ Tornado Alert: ${event}`,
    body: (c) => `A tornado watch or warning is in effect for the area of tomorrow's ${c.event} at ${c.location}. This event may be delayed, moved, or cancelled — please check the app before heading out.`,
  },
  thunderstorm: {
    emoji: '⛈️',
    headline: (event) => `⛈️ Storm Alert: ${event}`,
    body: (c) => `Thunderstorms${c.rain ? ` with a ${c.rain}% chance of rain` : ''} are forecast for tomorrow's ${c.event} at ${c.location}. Lightning may cause a delay per league safety rules.`,
  },
  heavy_rain: {
    emoji: '🌧️',
    headline: (event) => `🌧️ Rain Alert: ${event}`,
    body: (c) => `Heavy rain is forecast for tomorrow's ${c.event} at ${c.location}${c.rain ? `, with a ${c.rain}% chance of precipitation` : ''}. Fields may be wet or unplayable — please check the app in case of a delay or cancellation.`,
  },
  snow: {
    emoji: '🌨️',
    headline: (event) => `🌨️ Snow Alert: ${event}`,
    body: (c) => `Snow is in the forecast for tomorrow's ${c.event} at ${c.location}. Please plan for slick travel conditions and dress your athlete warmly. This event may be delayed or cancelled.`,
  },
  sleet_ice: {
    emoji: '🧊',
    headline: (event) => `🧊 Ice Alert: ${event}`,
    body: (c) => `Sleet or icy conditions are forecast around the time of tomorrow's ${c.event} at ${c.location}. Roads and the playing surface may be hazardous — this event may be delayed or cancelled.`,
  },
  high_wind: {
    emoji: '💨',
    headline: (event) => `💨 Wind Advisory: ${event}`,
    body: (c) => `Winds around ${c.wind} mph are forecast for tomorrow's ${c.event} at ${c.location}. Please secure loose gear — conditions may affect play.`,
  },
  fog: {
    emoji: '🌫️',
    headline: (event) => `🌫️ Visibility Alert: ${event}`,
    body: (c) => `Dense fog is forecast around the time of tomorrow's ${c.event} at ${c.location}, which may affect visibility and travel. Please allow extra time and drive carefully.`,
  },
  general_advisory: {
    emoji: '⚠️',
    headline: (event) => `⚠️ Weather Advisory: ${event}`,
    body: (c) => `Weather conditions for tomorrow's ${c.event} at ${c.location} may affect the event (${c.condition || 'see forecast'}). Please check the app for the latest updates before heading out.`,
  },
};

function classifyWeather(w) {
  const cond = (w.condition || '').toLowerCase();
  const temp = w.temp_f;
  const wind = w.wind_mph || 0;
  const rain = w.precipitation_chance || 0;

  if (cond.includes('tornado')) return 'tornado';
  if (cond.includes('snow') || cond.includes('blizzard')) return 'snow';
  if (cond.includes('sleet') || cond.includes('ice') || cond.includes('freezing rain')) return 'sleet_ice';
  if (cond.includes('thunderstorm') || cond.includes('lightning') || cond.includes('severe')) return 'thunderstorm';
  if (cond.includes('fog')) return 'fog';
  if (typeof temp === 'number') {
    if (temp >= 100) return 'extreme_heat';
    if (temp >= 90) return 'high_heat';
    if (temp <= 20) return 'extreme_cold';
    if (temp <= 32) return 'freezing_cold';
  }
  if (rain >= 50) return 'heavy_rain';
  if (wind >= 25) return 'high_wind';
  return 'general_advisory';
}

// Finds the team's head coach and returns (creating if needed) a DM channel between
// them and the given parent, so the notification can deep-link straight into that chat.
// Mirrors base44/functions/startDirectMessage's find-or-create logic, run as service role
// since this is a system-triggered action, not a user-initiated one.
async function getCoachDmLink(base44, teamId, parentEmail) {
  try {
    const coaches = await base44.asServiceRole.entities.CoachProfile.filter({ team_id: teamId, role_type: 'head_coach' });
    const coach = coaches[0];
    if (!coach?.user_email) return { coachName: null, dmUrl: null };

    const existing = await base44.asServiceRole.entities.Channel.filter({ type: 'direct' });
    let channel = existing.find(ch => {
      try {
        const members = JSON.parse(ch.member_emails || '[]');
        return members.includes(parentEmail) && members.includes(coach.user_email);
      } catch { return false; }
    });

    if (!channel) {
      channel = await base44.asServiceRole.entities.Channel.create({
        type: 'direct',
        name: coach.user_name || coach.user_email,
        member_emails: JSON.stringify([parentEmail, coach.user_email]),
      });
    }

    const existingMembers = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id: channel.id });
    const existingEmails = new Set(existingMembers.map(m => (m.user_email || '').toLowerCase()));
    await Promise.all(
      [parentEmail, coach.user_email]
        .filter(e => !existingEmails.has(e.toLowerCase()))
        .map(e => base44.asServiceRole.entities.ChannelMember.create({
          channel_id: channel.id, user_email: e, unread_count: 0,
        }).catch(() => {}))
    );

    return { coachName: coach.user_name || null, dmUrl: `/Messages?channelId=${channel.id}` };
  } catch (e) {
    console.warn(`Coach DM lookup failed for team ${teamId}:`, e.message);
    return { coachName: null, dmUrl: null };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const dbUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
      const callerRole = dbUsers[0]?.role;
      if (!['admin', 'athletic_director'].includes(callerRole)) {
        console.error(`gameDayWeatherAlert: forbidden role '${callerRole}' for ${caller.email}`);
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
      // Weather DATA still comes from an AI lookup (no traditional weather API is wired in) —
      // but we no longer use any AI-generated wording. Only the structured fields below are used.
      let weather;
      try {
        weather = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Get the current weather forecast specifically for this exact location: "${event.location}" on ${tomorrowStr}.
            IMPORTANT: Use the exact location string provided. Do NOT substitute or assume a different city.
            Return ONLY the structured forecast data — temperature, condition, wind, and precipitation chance —
            and whether conditions are concerning for an outdoor sports event (game/practice/tournament).`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              temp_f: { type: "number" },
              condition: { type: "string" },
              wind_mph: { type: "number" },
              precipitation_chance: { type: "number" },
              is_concerning: { type: "boolean" },
            }
          }
        });
      } catch (e) {
        console.warn(`Weather lookup failed for event ${event.id}: ${e.message}`);
        continue;
      }

      console.log(`Event: ${event.title} | Weather: ${weather.condition} | Concerning: ${weather.is_concerning}`);

      if (!weather.is_concerning) continue;

      const category = classifyWeather(weather);
      const template = TEMPLATES[category];
      const ctx = {
        event: event.title,
        location: event.location,
        temp: weather.temp_f !== undefined && weather.temp_f !== null ? Math.round(weather.temp_f) : null,
        wind: weather.wind_mph !== undefined && weather.wind_mph !== null ? Math.round(weather.wind_mph) : null,
        rain: weather.precipitation_chance || null,
        condition: weather.condition,
      };

      const headline = template.headline(event.title);
      const templateBody = template.body(ctx);

      // Post a message in the team channel (no per-parent DM link needed here — the coach is
      // already a member of the team channel)
      if (event.team_id) {
        try {
          const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: event.team_id, type: 'team' });
          const teamChannel = teamChannels[0];
          if (teamChannel) {
            await base44.asServiceRole.entities.Message.create({
              channel_id: teamChannel.id,
              content_text: `${headline}\n${templateBody} If you have any questions, please contact your coach.`,
              message_type: 'text',
              sender_name: 'Weather Bot',
              sender_user_id: 'system',
            });
          }
        } catch (e) {
          console.warn(`Failed to post team message: ${e.message}`);
        }
      }

      let parentEmails = [];
      if (event.team_id) {
        const players = await base44.asServiceRole.entities.Player.filter({
          team_id: event.team_id,
          is_active: true,
        });
        parentEmails = [...new Set(players.map(p => p.parent_email).filter(Boolean))];
      }

      // Look up the team's head coach once per event (not per parent)
      let coachName = null;
      const coaches = event.team_id
        ? await base44.asServiceRole.entities.CoachProfile.filter({ team_id: event.team_id, role_type: 'head_coach' }).catch(() => [])
        : [];
      if (coaches[0]?.user_name) coachName = coaches[0].user_name;

      const closingLine = `If you have any questions, please contact your coach${coachName ? `, ${coachName}` : ''}.`;

      if (parentEmails.length > 0) {
        await Promise.all(parentEmails.map(async (email) => {
          const dedupKey = `weather_alert_${event.id}_${email}`;
          const existing = await base44.asServiceRole.entities.NotificationQueue.filter({ dedup_key: dedupKey });
          if (existing.length > 0) return;

          // Per-parent DM link to the coach — tapping the notification opens a direct
          // conversation with the head coach instead of just the schedule.
          const { dmUrl } = event.team_id ? await getCoachDmLink(base44, event.team_id, email) : { dmUrl: null };

          const body = `${templateBody} ${closingLine}`;

          return base44.asServiceRole.entities.NotificationQueue.create({
            user_email: email,
            title: headline,
            body,
            url: dmUrl || '/Schedule',
            source: 'weather_alert',
            dedup_key: dedupKey,
            status: 'pending',
          });
        })).catch(e => console.warn(`Failed to queue weather alerts: ${e.message}`));
      }

      // Email — includes a real clickable "Message Coach" button when a DM link is available
      await Promise.allSettled(parentEmails.map(async (email) => {
        const { dmUrl, coachName: emailCoachName } = event.team_id ? await getCoachDmLink(base44, event.team_id, email) : { dmUrl: null, coachName: null };
        const fullUrl = dmUrl ? `https://app.cornerstone-athletics.com${dmUrl}` : null;
        return base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: headline,
          body: `<h2>${headline}</h2><p>${templateBody}</p><p>If you have any questions, please contact your coach${emailCoachName ? `, ${emailCoachName}` : ''}.</p>${fullUrl ? `<p><a href="${fullUrl}" style="background:#c8a84b;color:#000;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">Message ${emailCoachName || 'Your Coach'}</a></p>` : ''}`,
        }).catch(e => console.warn(`Email failed for ${email}: ${e.message}`));
      }));

      alertsSent++;
      console.log(`Alert sent for: ${event.title} (category: ${category}) | ${parentEmails.length} parents notified`);
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
