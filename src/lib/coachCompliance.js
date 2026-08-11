import { differenceInDays, parseISO } from "date-fns";

// Shared compliance-status helper for surfaces that show a coach's
// CoachCompliance record read-only (Teams.jsx list, TeamDetail.jsx coach
// info). Visible flag only -- per Matthew's decision, non-compliance does
// not restrict anything in the app, it's informational for admin/AD.
//
// Note: CoachesTraining.jsx (the compliance management page itself) keeps
// its own local copy of this logic since it was already built/verified
// before this shared helper existed -- not worth the risk of refactoring
// working, tested code just to dedupe two small functions.

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  return differenceInDays(parseISO(dateStr), new Date());
}

// Returns "none" (no CoachCompliance record at all), "incomplete" (missing
// or expired), "urgent" (<=30d), "warning" (<=90d), or "ok".
export function statusForCompliance(record) {
  if (!record) return "none";
  const bgDays = daysUntil(record.bg_check_expires);
  const naysDays = daysUntil(record.nays_expires);
  const anyIncomplete =
    !record.bg_check_passed || !record.nays_completed ||
    (record.bg_check_passed && bgDays !== null && bgDays < 0) ||
    (record.nays_completed && naysDays !== null && naysDays < 0);
  const anyUrgent =
    (record.bg_check_passed && bgDays !== null && bgDays >= 0 && bgDays <= 30) ||
    (record.nays_completed && naysDays !== null && naysDays >= 0 && naysDays <= 30);
  const anyWarning =
    (record.bg_check_passed && bgDays !== null && bgDays > 30 && bgDays <= 90) ||
    (record.nays_completed && naysDays !== null && naysDays > 30 && naysDays <= 90);
  if (anyIncomplete) return "incomplete";
  if (anyUrgent) return "urgent";
  if (anyWarning) return "warning";
  return "ok";
}

export const COMPLIANCE_BADGE = {
  ok:         { label: "Compliant",      cls: "bg-green-500/10 text-green-400 border-green-500/30" },
  warning:    { label: "Renewal Due",    cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  urgent:     { label: "Renewal Urgent", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  incomplete: { label: "Non-Compliant",  cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  none:       { label: "No Record",      cls: "bg-surface text-muted-foreground border-border" },
};
