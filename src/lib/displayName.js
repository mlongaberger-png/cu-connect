// Display-name resolution. Keep in sync with the copy in base44/functions/*/entry.ts
// (getMessagesFiltered, getDmContacts, getChannelInfo, backfillDisplayNames).
//
// Many accounts were created with an auto-generated full_name (the email's local part,
// e.g. "kmattes08") or none at all (Sign in with Apple private-relay addresses). full_name
// is a built-in auth field that can't be edited, so the real name lives in
// User.display_name (set by admins, the backfill job, or the user's own name prompt).
export function nameLooksGenerated(name, email) {
  const n = (name || "").trim();
  if (!n) return true;
  if (n.includes("@") || n.includes("+")) return true;
  const local = (email || "").split("@")[0].toLowerCase();
  if (local && n.toLowerCase() === local) return true;
  if (!/\s/.test(n) && /[0-9._]/.test(n)) return true; // single token like "jsmith7554"
  return false;
}

export function tidyName(n) {
  const t = String(n).trim().replace(/\s+/g, " ");
  return t === t.toLowerCase() ? t.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
}

export function effectiveName(u) {
  if (!u) return "Member";
  for (const cand of [u.display_name, u.full_name]) {
    if (!nameLooksGenerated(cand, u.email)) return tidyName(cand);
  }
  const email = (u.email || "").toLowerCase();
  if (!email || email.endsWith("privaterelay.appleid.com")) return "Member";
  return email.split("@")[0];
}

// True when we have no real name for this person yet (drives the one-time name prompt).
export function needsRealName(u) {
  if (!u) return false;
  return nameLooksGenerated(u.display_name, u.email) && nameLooksGenerated(u.full_name, u.email);
}
