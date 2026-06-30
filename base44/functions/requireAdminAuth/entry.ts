import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * requireAdminAuth — reusable admin gate.
 *
 * Other admin functions invoke this as the first thing they do:
 *   const gate = await base44.functions.invoke('requireAdminAuth', { endpoint: 'myFunction', action: 'delete_user' });
 *   if (!gate.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
 *
 * Checks (any failure → 403, no detail):
 *   1. Auth — user must be logged in
 *   2. DB role — queries User entity directly (does NOT trust caller-supplied role)
 *   3. Logs every attempt to AdminAuditLog (allowed or denied)
 *
 * IP allowlist: NOT enforced — x-forwarded-for is attacker-controllable in this environment
 * and platform-level IP pinning is unavailable. Mitigation: DB role check + full audit log
 * of every attempt (including IP) provides detection; block at the network/CDN layer instead.
 */

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { endpoint, action } = body;
    const ip = getClientIP(req);

    // ── 1. Auth check ───────────────────────────────────────────────
    const user = await base44.auth.me();
    if (!user) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: 'unknown',
        user_email: 'unknown',
        endpoint: endpoint || 'unknown',
        action: action || 'unknown',
        ip_address: ip || 'unknown',
        result: 'denied',
      }).catch(() => {});
      return Response.json({ allowed: false });
    }

    // ── 2. DB role check (not JWT claim) ────────────────────────────
    const admins = await base44.asServiceRole.entities.User.filter({ id: user.id });
    if (admins.length === 0 || admins[0].role !== 'admin') {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: user.id,
        user_email: user.email,
        endpoint: endpoint || 'unknown',
        action: action || 'unknown',
        ip_address: ip || 'unknown',
        result: 'denied',
      }).catch(() => {});
      return Response.json({ allowed: false });
    }

    // ── 3. Log allowed access ───────────────────────────────────────
    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: user.id,
      user_email: user.email,
      endpoint: endpoint || 'unknown',
      action: action || 'unknown',
      ip_address: ip || 'unknown',
      result: 'allowed',
    }).catch(() => {});

    return Response.json({ allowed: true, user_id: user.id, user_email: user.email });
  } catch (error) {
    console.error('[requireAdminAuth]', error.message);
    return Response.json({ allowed: false });
  }
});