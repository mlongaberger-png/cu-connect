import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called on explicit logout. Marks the session record as revoked
 * and optionally revokes ALL sessions for this user (force logout everywhere).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { revoke_all = false } = body;

    const nowISO = new Date().toISOString();

    if (revoke_all) {
      // Revoke every active session for this user
      const activeSessions = await base44.asServiceRole.entities.UserSession.filter({
        user_id: user.id,
        revoked_at: null,
      });
      for (const s of activeSessions) {
        await base44.asServiceRole.entities.UserSession.update(s.id, { revoked_at: nowISO });
      }
      console.log(`[revokeSession] Revoked ${activeSessions.length} sessions for ${user.email}`);
      return Response.json({ revoked: activeSessions.length, revoke_all: true });
    }

    // Revoke only the current session (by token hash)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: 'No token in request' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const sessions = await base44.asServiceRole.entities.UserSession.filter({
      token_hash: tokenHash,
      revoked_at: null,
    });

    let revoked = 0;
    for (const s of sessions) {
      await base44.asServiceRole.entities.UserSession.update(s.id, { revoked_at: nowISO });
      revoked++;
    }

    console.log(`[revokeSession] Revoked ${revoked} session(s) for ${user.email}`);
    return Response.json({ revoked, revoke_all: false });
  } catch (error) {
    console.error('[revokeSession]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});