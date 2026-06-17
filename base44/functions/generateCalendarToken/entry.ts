import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Generates a 256-bit calendar feed token scoped to the user's selected teams.
 * Returns the raw token exactly once — caller must store it.
 *
 * POST body: { teams?: string[] } — defaults to all user-associated teams if omitted.
 * Returns:   { token, expires_at }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { teams } = body;

    // ── Generate 256-bit token ──────────────────────────────────────
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // SHA-256 hash the token — raw token never stored
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // ── Expiry: 90 days ─────────────────────────────────────────────
    const nowISO = new Date().toISOString();
    const expiresISO = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // ── Revoke any existing active tokens for this user ─────────────
    const existing = await base44.asServiceRole.entities.CalendarToken.filter({
      user_id: user.id,
      revoked_at: null,
    });
    for (const t of existing) {
      await base44.asServiceRole.entities.CalendarToken.update(t.id, { revoked_at: nowISO });
    }

    // ── Store new token ─────────────────────────────────────────────
    await base44.asServiceRole.entities.CalendarToken.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash,
      expires_at: expiresISO,
      last_used_at: nowISO,
      teams: teams && teams.length > 0 ? JSON.stringify(teams) : null,
    });

    console.log(`[generateCalendarToken] Token created for ${user.email}`);

    return Response.json({
      token: rawToken,
      expires_at: expiresISO,
    });
  } catch (error) {
    console.error('[generateCalendarToken]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});