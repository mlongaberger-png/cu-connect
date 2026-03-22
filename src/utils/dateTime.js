import { format } from "date-fns";

/**
 * Parse a YYYY-MM-DD date string as LOCAL (midnight) — avoids UTC-shift bug.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
}

/**
 * Format a YYYY-MM-DD string using date-fns format string, local time.
 */
export function formatDate(dateStr, fmt) {
  const d = parseLocalDate(dateStr);
  if (!d) return "";
  return format(d, fmt);
}

/**
 * Convert "HH:MM" (24hr) to "h:MM AM/PM" (12hr).
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minute] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Format "HH:MM" to 12hr with optional timezone abbreviation label.
 * e.g. "6:00 PM CT"
 */
export function formatTime12hWithTZ(timeStr, tzAbbr) {
  const base = formatTime12h(timeStr);
  if (!base) return "";
  return tzAbbr ? `${base} ${tzAbbr}` : base;
}