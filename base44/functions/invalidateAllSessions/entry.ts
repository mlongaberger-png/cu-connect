import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Admin-only: invalidate all active session tokens.
 * Sets revoked_at = NOW() on every UserSession record that hasn't been revoked yet.
 * Call after deploying a new token generator to force all clients to re-authenticate.
 *
 * Returns the count of invalidated tokens.
 */
function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check (not JWT claim) + audit log ──────
    const authUser = await base44.auth.me();
    const ip = getClientIP(req);

    if (!authUser) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: 'unknown', user_email: 'unknown',
        endpoint: 'invalidateAllSessions', action: 'invalidate_all_sessions',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRecord = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    if (userRecord.length === 0 || userRecord[0].role !== 'admin') {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: authUser.id, user_email: authUser.email,
        endpoint: 'invalidateAllSessions', action: 'invalidate_all_sessions',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: authUser.id, user_email: authUser.email,
      endpoint: 'invalidateAllSessions', action: 'invalidate_all_sessions',
      ip_address: ip, result: 'allowed',
    }).catch(() => {});

    const user = { id: authUser.id, email: authUser.email };

    // ── Fetch all active sessions ─────────────────────────────────────
    const allSessions = await base44.asServiceRole.entities.UserSession.list();
    const nowISO = new Date().toISOString();

    // ── Revoke every session not already revoked ──────────────────────
    let invalidated = 0;
    for (const session of allSessions) {
      if (!session.revoked_at) {
        await base44.asServiceRole.entities.UserSession.update(session.id, {
          revoked_at: nowISO,
        });
        invalidated++;
      }
    }

    console.log(`[invalidateAllSessions] Revoked ${invalidated} sessions by ${user.email}`);

    return Response.json({
      success: true,
      invalidated_count: invalidated,
      total_sessions: allSessions.length,
      already_revoked: allSessions.length - invalidated,
      revoked_at: nowISO,
    });
  } catch (error) {
    console.error('[invalidateAllSessions]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});