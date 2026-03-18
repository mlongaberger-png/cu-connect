import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Try to get authenticated user, fall back to service role for subscriptions
    let allowedTeamIds = null;
    try {
      const user = await base44.auth.me();
      if (user) {
        const players = await base44.asServiceRole.entities.Player.filter({ parent_email: user.email });
        if (players.length > 0) {
          allowedTeamIds = [...new Set(players.map(p => p.team_id).filter(Boolean))];
        }
      }
    } catch (_) {
      // unauthenticated — will serve all events (admin use)
    }

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");

    let events = await base44.asServiceRole.entities.Event.list("-date");

    // Filter by parent's allowed teams
    if (allowedTeamIds) {
      events = events.filter(e => allowedTeamIds.includes(e.team_id));
    }
    // Further filter by specific team if requested
    if (teamId) {
      events = events.filter(e => e.team_id === teamId);
    }

    const escapeText = (str) => (str || "").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

    const formatDate = (dateStr, timeStr) => {
      if (!dateStr) return "";
      const d = dateStr.replace(/-/g, "");
      if (!timeStr) return d;
      const t = timeStr.replace(":", "") + "00";
      return `${d}T${t}`;
    };

    const vevents = events.map(event => {
      const dtstart = formatDate(event.date, event.start_time);
      const dtend = formatDate(event.date, event.end_time || event.start_time);
      const isAllDay = !event.start_time;
      const startProp = isAllDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`;
      const endProp = isAllDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`;

      return [
        "BEGIN:VEVENT",
        `UID:event-${event.id}@cornerstoneunited`,
        `SUMMARY:${escapeText(event.title)}`,
        startProp,
        endProp,
        event.location ? `LOCATION:${escapeText(event.location)}` : null,
        event.notes ? `DESCRIPTION:${escapeText(event.notes)}` : null,
        event.is_cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
        "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    });

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cornerstone United//Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Cornerstone United Schedule",
      "X-WR-TIMEZONE:America/Chicago",
      ...vevents,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar;charset=utf-8",
        "Content-Disposition": "attachment; filename=cornerstone_schedule.ics",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("ICS feed error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});