import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function toICalDate(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    if (timeStr && /^\d{2}:\d{2}/.test(timeStr)) {
      const dt = new Date(`${dateStr}T${timeStr}:00`);
      if (!isNaN(dt)) return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    }
    const dt = new Date(`${dateStr}T12:00:00Z`);
    if (!isNaN(dt)) return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  } catch {}
  return null;
}

function escapeIcal(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const rawToken = url.searchParams.get("token") || "";

    // ── Reject unauthenticated requests ─────────────────────────────
    if (!rawToken) {
      return new Response("Missing calendar token. Generate one from your profile.", { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // ── Hash token & lookup ─────────────────────────────────────────
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const tokens = await base44.asServiceRole.entities.CalendarToken.filter({
      token_hash: tokenHash,
      revoked_at: null,
    });

    if (tokens.length === 0) {
      return new Response("Invalid or revoked calendar token.", { status: 401 });
    }

    const tokenRecord = tokens[0];

    // ── Check expiry ────────────────────────────────────────────────
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      await base44.asServiceRole.entities.CalendarToken.update(tokenRecord.id, {
        revoked_at: new Date().toISOString(),
      });
      return new Response("Calendar token expired. Generate a new one from your profile.", { status: 401 });
    }

    // ── Bump last_used_at ───────────────────────────────────────────
    const nowISO = new Date().toISOString();
    await base44.asServiceRole.entities.CalendarToken.update(tokenRecord.id, {
      last_used_at: nowISO,
    });

    // ── Scope: stored teams or user's own events ────────────────────
    let teamIds = [];
    if (tokenRecord.teams) {
      try { teamIds = JSON.parse(tokenRecord.teams); } catch {}
    }

    // ── Fetch events ────────────────────────────────────────────────
    const allEvents = await base44.asServiceRole.entities.Event.list("-date", 500);
    const events = teamIds.length > 0
      ? allEvents.filter(e => teamIds.includes(e.team_id))
      : allEvents;

    const dtstamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const vevents = events.map(ev => {
      const dtstart = toICalDate(ev.date, ev.start_time);
      const dtend = toICalDate(ev.date, ev.end_time) || toICalDate(ev.date, ev.start_time) || dtstart;
      if (!dtstart) return "";

      const summary = escapeIcal(
        [ev.title, ev.opponent ? `vs ${ev.opponent}` : null, ev.team_name]
          .filter(Boolean).join(" – ")
      );
      const description = escapeIcal(
        [ev.notes, ev.opponent ? `vs ${ev.opponent}` : null].filter(Boolean).join(" | ")
      );
      const location = escapeIcal(ev.location || "");

      return [
        "BEGIN:VEVENT",
        `UID:${ev.id}@cuconnect.com`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${summary}`,
        description ? `DESCRIPTION:${description}` : null,
        location ? `LOCATION:${location}` : null,
        "END:VEVENT",
      ].filter(Boolean).join("\r\n");
    }).filter(Boolean);

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cornerstone United Athletics//CU Connect//EN",
      "X-WR-CALNAME:CU Connect Schedule",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...vevents,
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cu-connect-schedule.ics"',
        "Cache-Control": "no-cache, no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("ICS feed error:", error);
    return new Response(`Error generating calendar feed: ${error.message}`, { status: 500 });
  }
});