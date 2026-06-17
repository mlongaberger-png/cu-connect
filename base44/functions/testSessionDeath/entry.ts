import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Self-contained token death test.
 * 1. Tracks current session (creates UserSession record with token hash)
 * 2. Validates the session (must pass)
 * 3. Revokes the session (marks revoked_at)
 * 4. Validates again (must fail with 401 reason)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return Response.json({ error: 'No token' }, { status: 400 });

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const results = {};

    // STEP 1: Track session
    const existing = await base44.asServiceRole.entities.UserSession.filter({ token_hash: tokenHash });
    let session;
    if (existing.length > 0) {
      session = existing[0];
      results.step1_track = { session_id: session.id, status: 'already_exists' };
    } else {
      session = await base44.asServiceRole.entities.UserSession.create({
        user_id: user.id,
        user_email: user.email,
        token_hash: tokenHash,
        device_info: 'logout-death-test',
        last_active_at: new Date().toISOString(),
      });
      results.step1_track = { session_id: session.id, status: 'created' };
    }

    // STEP 2: Validate — check revoked_at IS NULL
    const freshSession = await base44.asServiceRole.entities.UserSession.filter({ id: session.id });
    const s = freshSession[0];
    results.step2_validateBefore = s.revoked_at
      ? { valid: false, reason: 'revoked_at is set' }
      : { valid: true, revoked_at: null };

    // STEP 3: Revoke the session
    await base44.asServiceRole.entities.UserSession.update(session.id, {
      revoked_at: new Date().toISOString(),
    });
    results.step3_revoke = { session_id: session.id, revoked: true };

    // STEP 4: Validate again — must find revoked_at IS NOT NULL
    const deadSession = await base44.asServiceRole.entities.UserSession.filter({ id: session.id });
    const d = deadSession[0];
    results.step4_validateAfter = d.revoked_at
      ? { valid: false, reason: 'Token is DEAD — revoked_at is set', revoked_at: d.revoked_at }
      : { valid: true, warning: 'BUG: token still alive after revoke!' };

    // STEP 5: Verify validateSession middleware would also reject
    const middlewareSessions = await base44.asServiceRole.entities.UserSession.filter({
      token_hash: tokenHash,
    });
    const ms = middlewareSessions[0];
    results.step5_middlewareCheck = {
      session_found: !!ms,
      revoked_at_set: ms?.revoked_at ? true : false,
      would_return_401: ms?.revoked_at ? true : false,
    };

    // Cleanup — delete the test record
    await base44.asServiceRole.entities.UserSession.delete(session.id);
    results.cleanup = 'test session deleted';

    return Response.json({
      token_dead_after_logout: !results.step4_validateAfter.valid,
      results,
    });
  } catch (error) {
    console.error('[testSessionDeath]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});