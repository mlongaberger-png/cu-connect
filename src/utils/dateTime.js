/**
 * Parse a YYYY-MM-DD date string as LOCAL time (not UTC).
 * Using new Date("2025-03-15") parses as UTC midnight → wrong day in US timezones.
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00");
}

/**
 * Format a YYYY-MM-DD string using a date-fns format string, using local time.
 */
import { format } from "date-fns";
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