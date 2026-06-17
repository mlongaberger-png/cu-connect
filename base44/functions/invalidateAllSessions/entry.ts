import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Admin-only: invalidate all active session tokens.
 * Sets revoked_at = NOW() on every UserSession record that hasn't been revoked yet.
 * Call after deploying a new token generator to force all clients to re-authenticate.
 *
 * Returns the count of invalidated tokens.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check + IP allowlist + audit log ─────────
    const gate = await base44.asServiceRole.functions.invoke('requireAdminAuth', {
      endpoint: 'invalidateAllSessions',
      action: 'invalidate_all_sessions',
    });
    if (!gate.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const user = { id: gate.user_id, email: gate.user_email };

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