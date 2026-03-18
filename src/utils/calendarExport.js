/**
 * Generate ICS file content from an array of events.
 */
export function generateICSContent(events) {
  const escapeText = (str) => (str || "").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  const formatDate = (dateStr, timeStr) => {
    if (!dateStr) return "";
    const d = dateStr.replace(/-/g, "");
    if (!timeStr) return `${d}`;
    const t = timeStr.replace(":", "") + "00";
    return `${d}T${t}`;
  };

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}@cornerstoneunited`;

  const vevents = events.map(event => {
    const dtstart = formatDate(event.date, event.start_time);
    const dtend = formatDate(event.date, event.end_time || event.start_time);
    const isAllDay = !event.start_time;
    const startProp = isAllDay ? `DTSTART;VALUE=DATE:${dtstart}` : `DTSTART:${dtstart}`;
    const endProp = isAllDay ? `DTEND;VALUE=DATE:${dtend}` : `DTEND:${dtend}`;

    return [
      "BEGIN:VEVENT",
      `UID:${uid()}`,
      `SUMMARY:${escapeText(event.title)}`,
      startProp,
      endProp,
      event.location ? `LOCATION:${escapeText(event.location)}` : null,
      event.notes ? `DESCRIPTION:${escapeText(event.notes)}` : null,
      event.is_cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cornerstone United//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(content, filename = "schedule.ics") {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getOutlookWebUrl(event) {
  const formatDT = (d, t) => {
    if (!d) return "";
    const base = new Date(`${d}T${t || "00:00"}:00`);
    return base.toISOString();
  };
  const start = formatDT(event.date, event.start_time);
  const end = formatDT(event.date, event.end_time || event.start_time);
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${start}&enddt=${end}&location=${encodeURIComponent(event.location || "")}&body=${encodeURIComponent(event.notes || "")}`;
}