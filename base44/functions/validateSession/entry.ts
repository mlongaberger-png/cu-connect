import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Session validation middleware.
 *
 * Enforces three lifecycle rules on every call:
 *   1. Inactivity expiry — 24h since last_used_at → 401
 *   2. Max session age — 7 days since created_date → 401 (force re-login)
 *   3. Token rotation — 4h since rotated_at → 401 (re-auth required)
 *
 * On success, bumps last_used_at and returns session info.
 * On rotation, revokes the current session so the old token dies.
 *
 * Usage from another function:
 *   const sessionCheck = await base44.asServiceRole.functions.invoke('validateSession', {});
 *   if (sessionCheck.status !== 200) return sessionCheck;
 */

const INACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;     // 24 hours
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;    // 7 days
const ROTATION_WINDOW_MS = 4 * 60 * 60 * 1000;          // 4 hours

function hashToken(token) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

/** Generate a fresh 256-bit session token (NIST SP 800-63B) */
function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Accept session_token from body or X-Session-Token header (NIST SP 800-63B)
    // Also accept platform token from body or Authorization header (legacy)
    const body = await req.json().catch(() => ({}));
    let sessionToken = body?.session_token || null;
    let platformToken = body?.token || null;
    let userIdFromToken = body?.user_id || null;

    // Session token from header takes priority over body
    if (!sessionToken) {
      sessionToken = req.headers.get('x-session-token') || null;
    }

    // Platform token from Authorization header
    if (!platformToken) {
      const authHeader = req.headers.get('authorization');
      platformToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    }

    if (!sessionToken && !platformToken) {
      return Response.json({ error: 'Unauthorized — no token in request' }, { status: 401 });
    }

    // Verify the platform token is still valid
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized — no valid platform token' }, { status: 401 });
    }

    // If caller passed a user_id, verify it matches the token (prevents token-swapping)
    if (userIdFromToken && userIdFromToken !== user.id) {
      return Response.json({ error: 'Unauthorized — token/user mismatch' }, { status: 401 });
    }

    const now = new Date();
    const nowISO = now.toISOString();

    // ── Look up the session ──────────────────────────────────────────
    // Prefer session_token_hash lookup (NIST SP 800-63B); fall back to platform token_hash
    let sessions = [];
    if (sessionToken) {
      const sessionTokenHash = await hashToken(sessionToken);
      sessions = await base44.asServiceRole.entities.UserSession.filter({
        session_token_hash: sessionTokenHash,
      });
    }

    // Fall back to platform token lookup if session token didn't match
    if (sessions.length === 0 && platformToken) {
      const platformTokenHash = await hashToken(platformToken);
      sessions = await base44.asServiceRole.entities.UserSession.filter({
        token_hash: platformTokenHash,
      });
    }

    if (sessions.length === 0) {
      // Return 200 so gate callers can distinguish "not found" from truly invalid.
      // Callers should allow session_not_found through (backward compat).
      return Response.json({
        valid: false,
        error: 'Session not found',
        reason: 'session_not_found',
        note: 'User has no tracked session — caller may allow or deny at its discretion',
      });
    }

    const session = sessions[0];

    // ── 1. Check revoked ─────────────────────────────────────────────
    if (session.revoked_at) {
      return Response.json({
        error: 'Unauthorized — session revoked',
        reason: 'session_revoked',
        revoked_at: session.revoked_at,
      }, { status: 401 });
    }

    // ── 2. Check max session age (7 days since created_date) ─────────
    const createdAt = new Date(session.created_date);
    const sessionAgeMs = now - createdAt;
    if (sessionAgeMs > MAX_SESSION_AGE_MS) {
      // Hard deadline — force full re-login
      await base44.asServiceRole.entities.UserSession.update(session.id, {
        revoked_at: nowISO,
      });
      console.log(`[validateSession] Max age exceeded for ${user.email}, session ${session.id}`);
      return Response.json({
        error: 'Unauthorized — maximum session age exceeded (7 days)',
        reason: 'session_max_age_exceeded',
        created_at: session.created_date,
        age_days: Math.round(sessionAgeMs / (24 * 60 * 60 * 1000)),
      }, { status: 401 });
    }

    // ── 3. Check inactivity (24 hours since last_used_at) ────────────
    const lastUsedAt = session.last_used_at
      ? new Date(session.last_used_at)
      : session.last_active_at
        ? new Date(session.last_active_at)
        : createdAt;

    const inactiveMs = now - lastUsedAt;
    if (inactiveMs > INACTIVITY_WINDOW_MS) {
      await base44.asServiceRole.entities.UserSession.update(session.id, {
        revoked_at: nowISO,
      });
      console.log(`[validateSession] Inactivity timeout for ${user.email}, session ${session.id}`);
      return Response.json({
        error: 'Unauthorized — session inactive for over 24 hours',
        reason: 'session_inactive',
        last_used_at: lastUsedAt.toISOString(),
        inactive_hours: Math.round(inactiveMs / (60 * 60 * 1000)),
      }, { status: 401 });
    }

    // ── 4. Check token rotation (4 hours since rotated_at) ───────────
    const rotatedAt = session.rotated_at
      ? new Date(session.rotated_at)
      : createdAt; // first rotation window starts at creation

    const rotationAgeMs = now - rotatedAt;
    if (rotationAgeMs > ROTATION_WINDOW_MS) {
      // Revoke this session — old token dies
      await base44.asServiceRole.entities.UserSession.update(session.id, {
        revoked_at: nowISO,
      });
      console.log(`[validateSession] Rotation required for ${user.email}, session ${session.id}`);
      return Response.json({
        error: 'Token rotation required — please re-authenticate',
        reason: 'token_rotation_required',
        rotated_at: rotatedAt.toISOString(),
        rotation_age_hours: Math.round(rotationAgeMs / (60 * 60 * 1000)),
      }, {
        status: 401,
        headers: { 'X-Token-Rotation-Required': 'true' },
      });
    }

    // ── 5. Legacy expires_at check ───────────────────────────────────
    if (session.expires_at && new Date(session.expires_at) < now) {
      return Response.json({
        error: 'Unauthorized — session expired',
        reason: 'session_expired',
        expires_at: session.expires_at,
      }, { status: 401 });
    }

    // ── Valid — bump last_used_at ────────────────────────────────────
    await base44.asServiceRole.entities.UserSession.update(session.id, {
      last_used_at: nowISO,
      last_active_at: nowISO,
    });

    return Response.json({
      valid: true,
      session: {
        id: session.id,
        created_at: session.created_date,
        last_used_at: nowISO,
        rotated_at: session.rotated_at || session.created_date,
        max_expires_at: session.max_expires_at,
        device_info: session.device_info,
      },
    });
  } catch (error) {
    console.error('[validateSession]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});