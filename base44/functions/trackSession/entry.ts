import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called after login to create or update a session record.
 * Hashes the token with SHA-256 — raw token never stored.
 *
 * Sets:
 *   - max_expires_at = created_date + 7 days  (hard deadline)
 *   - rotated_at = now                         (rotation window starts)
 *   - last_used_at = now                       (inactivity timer starts)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_info } = body;

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return Response.json({ error: 'No token in request' }, { status: 400 });
    }

    // SHA-256 hash — raw token never stored
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const nowISO = new Date().toISOString();
    const maxExpiresISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const legacyExpiresISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const device = device_info || req.headers.get('user-agent') || null;

    // Check for duplicate — upsert by token_hash
    const existing = await base44.asServiceRole.entities.UserSession.filter({ token_hash: tokenHash });
    if (existing.length > 0) {
      const s = existing[0];
      // If previously revoked (rotation), reactivate with new data
      await base44.asServiceRole.entities.UserSession.update(s.id, {
        last_active_at: nowISO,
        last_used_at: nowISO,
        rotated_at: s.rotated_at || nowISO,
        max_expires_at: s.max_expires_at || maxExpiresISO,
        revoked_at: null,
        ip_address: ip,
        device_info: device,
        user_email: user.email,
        user_id: user.id,
      });
      return Response.json({
        session_id: s.id,
        status: s.revoked_at ? 'reactivated' : 'updated',
        max_expires_at: s.max_expires_at || maxExpiresISO,
      });
    }

    // Create new session record
    const session = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash,
      device_info: device,
      ip_address: ip,
      expires_at: legacyExpiresISO,
      last_active_at: nowISO,
      last_used_at: nowISO,
      rotated_at: nowISO,
      max_expires_at: maxExpiresISO,
    });

    return Response.json({
      session_id: session.id,
      status: 'created',
      max_expires_at: maxExpiresISO,
    });
  } catch (error) {
    console.error('[trackSession]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});