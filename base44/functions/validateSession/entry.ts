import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Session validation middleware.
 * Call from other backend functions to verify the token hash exists
 * in UserSession and revoked_at IS NULL.
 *
 * Returns { valid: true, session } or a 401 Response object.
 *
 * Usage from another function:
 *   const sessionCheck = await base44.asServiceRole.functions.invoke('validateSession', {});
 *   if (sessionCheck.status !== 200) return sessionCheck; // returns the 401 Response
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized — no valid platform token' }, { status: 401 });
    }

    // Extract and hash the token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: 'Unauthorized — no token in request' }, { status: 401 });
    }

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Look up the session by token hash
    const sessions = await base44.asServiceRole.entities.UserSession.filter({
      token_hash: tokenHash,
    });

    if (sessions.length === 0) {
      return Response.json({
        error: 'Unauthorized — session not found',
        reason: 'session_not_found',
      }, { status: 401 });
    }

    const session = sessions[0];

    // Check revoked
    if (session.revoked_at) {
      return Response.json({
        error: 'Unauthorized — session revoked',
        reason: 'session_revoked',
        revoked_at: session.revoked_at,
      }, { status: 401 });
    }

    // Check expiration
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return Response.json({
        error: 'Unauthorized — session expired',
        reason: 'session_expired',
        expires_at: session.expires_at,
      }, { status: 401 });
    }

    // Bump last_active_at
    await base44.asServiceRole.entities.UserSession.update(session.id, {
      last_active_at: new Date().toISOString(),
    });

    return Response.json({
      valid: true,
      session: {
        id: session.id,
        created_at: session.created_date,
        last_active_at: session.last_active_at,
        device_info: session.device_info,
      },
    });
  } catch (error) {
    console.error('[validateSession]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});