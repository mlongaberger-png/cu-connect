import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Emits a "floating" local date/time (no Z / UTC offset), matching the
// client-side generateICSContent() generator (src/utils/calendarExport.js).
// Event date/time fields are stored as the org's local wall-clock time, not
// UTC — converting via Date/toISOString() here would silently shift every
// timed event by the org's UTC offset (previously caused a 5-6 hour error).
function icalDatePart(dateStr) {
  if (!dateStr) return null;
  return dateStr.replace(/-/g, "");
}

function icalDateTimePart(dateStr, timeStr) {
  if (!dateStr || !timeStr || !/^\d{2}:\d{2}/.test(timeStr)) return null;
  const d = dateStr.replace(/-/g, "");
  const t = timeStr.replace(":", "") + "00";
  return `${d}T${t}`;
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
      const isAllDay = !ev.start_time;
      const dtstartDate = icalDatePart(ev.date);
      if (!dtstartDate) return "";

      const dtstartDateTime = icalDateTimePart(ev.date, ev.start_time);
      const dtendDateTime = icalDateTimePart(ev.date, ev.end_time) || dtstartDateTime;
      if (!isAllDay && !dtstartDateTime) return "";

      const dtstartProp = isAllDay ? `DTSTART;VALUE=DATE:${dtstartDate}` : `DTSTART:${dtstartDateTime}`;
      const dtendProp = isAllDay ? `DTEND;VALUE=DATE:${dtstartDate}` : `DTEND:${dtendDateTime}`;

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
        dtstartProp,
        dtendProp,
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