import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Called after login to create a session record.
 * Hashes the token with SHA-256 — raw token never stored.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { device_info, expires_in_days = 30 } = body;

    // Extract and hash the token from the Authorization header
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

    // Check for duplicate — upsert by token_hash
    const existing = await base44.asServiceRole.entities.UserSession.filter({ token_hash: tokenHash });
    if (existing.length > 0) {
      // Session already tracked — update last_active_at
      await base44.asServiceRole.entities.UserSession.update(existing[0].id, {
        last_active_at: new Date().toISOString(),
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
        device_info: device_info || req.headers.get('user-agent') || null,
      });
      return Response.json({ session_id: existing[0].id, status: 'updated' });
    }

    // Create new session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    const session = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash,
      device_info: device_info || req.headers.get('user-agent') || null,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      expires_at: expiresAt.toISOString(),
      last_active_at: new Date().toISOString(),
    });

    return Response.json({ session_id: session.id, status: 'created' });
  } catch (error) {
    console.error('[trackSession]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});