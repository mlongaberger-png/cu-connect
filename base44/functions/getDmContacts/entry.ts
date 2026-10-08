import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns the DM contact list for the caller, computed server-side via asServiceRole.
 *
 * Fixes a real bug found 2026-08-07 during live QA: NewDmDialog.jsx previously called the
 * raw client SDK (`base44.entities.User.list()`) to build this list. User's platform-default
 * read RLS rejects that call for every non-admin role (confirmed live: 403 for both a coach
 * and a parent test account), so "New Direct Message" always showed "No contacts found" for
 * every role, not just parents — the DM feature was effectively 100% broken app-wide, not a
 * scoping edge case. This follows the same asServiceRole pattern used elsewhere in this app
 * (getMyPlayers, getEventsFiltered, getPhotosFiltered, getMessagesFiltered) for exactly this
 * class of problem: a frontend component needs a broader read than a given caller's RLS
 * allows, so a backend function re-implements the intended authorization server-side instead
 * of loosening the underlying entity's RLS (which would reopen exactly the kind of over-broad
 * access that RLS exists to prevent).
 *
 * Same visibility rule NewDmDialog.jsx already implemented client-side:
 *   - Staff (coach/athletic_director/admin) can DM anyone.
 *   - Everyone else (parent/grandparent/athlete/etc.) can DM all staff, plus any user who
 *     shares a team/announcement channel's member_emails list with them (their "teammates").
 *
 * Usage (frontend):
 *   const res = await base44.functions.invoke('getDmContacts');
 *   const contacts = res.data.contacts; // [{ id, email, full_name, role }, ...]
 */
const LEADERSHIP_ROLES = ['coach', 'athletic_director', 'admin'];

// ── Display-name resolution (shared logic, kept in sync with src/lib/displayName.js) ──
// Many accounts were created with an auto-generated full_name (the email's local part, e.g.
// "kmattes08") or none at all (Sign in with Apple private-relay addresses). full_name is a
// built-in auth field that can't be edited, so real names live in User.display_name (set by
// admins, by the backfillDisplayNames job, or by the user via the "What's your name?" prompt).
function nameLooksGenerated(name: string | null | undefined, email?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return true;
  if (n.includes('@') || n.includes('+')) return true;
  const local = (email || '').split('@')[0].toLowerCase();
  if (local && n.toLowerCase() === local) return true;
  if (!/\s/.test(n) && /[0-9._]/.test(n)) return true; // single token like "jsmith7554"
  return false;
}
function tidyName(n: string): string {
  const t = n.trim().replace(/\s+/g, ' ');
  return t === t.toLowerCase() ? t.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
}
function effectiveName(u: any): string {
  if (!u) return 'Member';
  for (const cand of [u.display_name, u.full_name]) {
    if (!nameLooksGenerated(cand, u.email)) return tidyName(cand);
  }
  const email = (u.email || '').toLowerCase();
  if (!email || email.endsWith('privaterelay.appleid.com')) return 'Member';
  return email.split('@')[0];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const myEmail = authUser.email;

    const dbUsers = await base44.asServiceRole.entities.User.filter({ email: myEmail }, null, 1);
    const role = dbUsers[0]?.role || authUser.role;

    const allUsers = await base44.asServiceRole.entities.User.list(null, 1000);
    const toSafeContact = (u) => ({ id: u.id, email: u.email, full_name: effectiveName(u), role: u.role });

    if (LEADERSHIP_ROLES.includes(role)) {
      const contacts = allUsers.filter(u => u.email !== myEmail).map(toSafeContact);
      return Response.json({ contacts });
    }

    // Non-staff: leadership (always allowed) + teammates sharing a team/announcement channel
    const allChannels = await base44.asServiceRole.entities.Channel.filter({}, null, 1000);
    const teammateEmails = new Set();
    allChannels.forEach(ch => {
      if (ch.type !== 'team' && ch.type !== 'announcement') return;
      try {
        const members = JSON.parse(ch.member_emails || '[]');
        if (members.includes(myEmail)) members.forEach(e => teammateEmails.add(e));
      } catch { /* skip malformed member_emails */ }
    });

    const contacts = allUsers
      .filter(u => {
        if (u.email === myEmail) return false;
        if (LEADERSHIP_ROLES.includes(u.role)) return true;
        return teammateEmails.has(u.email);
      })
      .map(toSafeContact);

    return Response.json({ contacts });
  } catch (error) {
    console.error('[getDmContacts]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
