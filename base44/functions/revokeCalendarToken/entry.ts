import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Revokes all active calendar tokens for the authenticated user.
 * Sets revoked_at = NOW() on every active CalendarToken owned by the caller.
 *
 * Returns the count of revoked tokens.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const nowISO = new Date().toISOString();

    const active = await base44.asServiceRole.entities.CalendarToken.filter({
      user_id: user.id,
      revoked_at: null,
    });

    for (const t of active) {
      await base44.asServiceRole.entities.CalendarToken.update(t.id, { revoked_at: nowISO });
    }

    console.log(`[revokeCalendarToken] Revoked ${active.length} tokens for ${user.email}`);

    return Response.json({
      revoked_count: active.length,
      revoked_at: nowISO,
    });
  } catch (error) {
    console.error('[revokeCalendarToken]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});