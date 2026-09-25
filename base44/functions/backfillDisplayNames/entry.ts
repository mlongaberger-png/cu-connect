import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * One-time (re-runnable) backfill of User.display_name for accounts whose name is an
 * auto-generated username ("kmattes08", "mlongaberger") or blank (Sign in with Apple).
 * Added 2026-09-25: the GroupMe-style chat now shows names on every message, so these
 * stood out everywhere.
 *
 * Source of truth, in order: the parent_name families typed themselves on
 * Player / RegistrationApplication / RegistrationSubmission / AccessRequest / PendingChild,
 * matched by email (case-insensitive). The most common clean spelling wins. Only writes
 * display_name (full_name is a built-in auth field that can't be edited); never overwrites
 * a display_name that already looks like a real name. Lowercase real names are title-cased.
 *
 * Admin only. Body: { dry_run?: boolean (default true) }
 * Returns: { updated: [{email, from, to, source}], unresolved: [email], dry_run }
 */
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

function cleanCandidate(n: any): string | null {
  if (typeof n !== 'string') return null;
  const t = n.trim().replace(/\s+/g, ' ');
  if (!t || t.length > 60) return null;
  if (/delete after testing|^qa\b|zz_test/i.test(t)) return null;
  if (nameLooksGenerated(t)) return null;
  return tidyName(t);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const dryRun = body?.dry_run !== false;

    const sr = base44.asServiceRole.entities;
    const [users, players, apps, subs, access, pending] = await Promise.all([
      sr.User.list(null, 2000),
      sr.Player.list(null, 5000),
      sr.RegistrationApplication.list(null, 5000).catch(() => []),
      sr.RegistrationSubmission.list(null, 5000).catch(() => []),
      sr.AccessRequest.list(null, 5000).catch(() => []),
      sr.PendingChild.list(null, 5000).catch(() => []),
    ]);

    // email -> { name -> count, sources }
    const votes = new Map<string, Map<string, { n: number; src: string }>>();
    const vote = (email: any, name: any, src: string) => {
      const e = String(email || '').trim().toLowerCase();
      const c = cleanCandidate(name);
      if (!e || !c) return;
      if (!votes.has(e)) votes.set(e, new Map());
      const m = votes.get(e)!;
      const cur = m.get(c) || { n: 0, src };
      cur.n += 1;
      m.set(c, cur);
    };
    players.forEach((p: any) => vote(p.parent_email, p.parent_name, 'Player'));
    apps.forEach((a: any) => vote(a.parent_email, a.parent_name, 'RegistrationApplication'));
    subs.forEach((a: any) => vote(a.parent_email, a.parent_name, 'RegistrationSubmission'));
    access.forEach((a: any) => vote(a.parent_email, a.parent_name, 'AccessRequest'));
    pending.forEach((a: any) => vote(a.parent_email, a.parent_name, 'PendingChild'));

    const updated: any[] = [];
    const unresolved: string[] = [];
    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      const current = u.display_name && !nameLooksGenerated(u.display_name, u.email) ? u.display_name
        : (!nameLooksGenerated(u.full_name, u.email) ? u.full_name : null);

      if (current) {
        // Real name already present -- only tidy an all-lowercase one ("mark longaberger").
        const tidy = tidyName(current);
        if (tidy !== current && tidy !== u.display_name) {
          updated.push({ email: u.email, from: current, to: tidy, source: 'capitalization' });
          if (!dryRun) await sr.User.update(u.id, { display_name: tidy });
        }
        continue;
      }
      const m = votes.get(email);
      if (!m || m.size === 0) { unresolved.push(u.email); continue; }
      // most votes, then longest (prefers "Stephanie Lane Cooper" over "Stephanie Cooper" only on ties)
      const [best, info] = [...m.entries()].sort((a, b) => (b[1].n - a[1].n) || (b[0].length - a[0].length))[0];
      updated.push({ email: u.email, from: u.display_name || u.full_name || '', to: best, source: info.src });
      if (!dryRun) await sr.User.update(u.id, { display_name: best });
    }

    console.log(`backfillDisplayNames dry_run=${dryRun} updated=${updated.length} unresolved=${unresolved.length}`);
    return Response.json({ dry_run: dryRun, updated, unresolved });
  } catch (error) {
    console.error('backfillDisplayNames error:', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
