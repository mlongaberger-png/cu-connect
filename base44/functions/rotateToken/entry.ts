import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Rotates the current token: revokes the old session and signals
 * the client to re-authenticate with a fresh platform token.
 *
 * Called by the frontend when it receives a 401 with
 * reason "token_rotation_required" from validateSession.
 *
 * After calling this, the client should:
 *   1. base44.auth.logout()  → clear platform token
 *   2. base44.auth.redirectToLogin()  → get fresh token
 *   3. On re-login, trackSession() creates a new session record
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: 'No token in request' }, { status: 400 });
    }

    // Hash and revoke the current session
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const sessions = await base44.asServiceRole.entities.UserSession.filter({
      token_hash: tokenHash,
      revoked_at: null,
    });

    const nowISO = new Date().toISOString();
    let revoked = 0;
    for (const s of sessions) {
      await base44.asServiceRole.entities.UserSession.update(s.id, { revoked_at: nowISO });
      revoked++;
    }

    console.log(`[rotateToken] Revoked ${revoked} session(s) for ${user.email} — re-auth required`);

    return Response.json({
      rotated: true,
      revoked,
      next_step: 're-authenticate',
      message: 'Please re-authenticate to get a fresh token. The old token has been revoked.',
    });
  } catch (error) {
    console.error('[rotateToken]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});