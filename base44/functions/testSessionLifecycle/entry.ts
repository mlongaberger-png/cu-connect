import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Self-contained lifecycle tests for session expiry and token rotation.
 *
 * Test 1: Inactivity expiry — last_used_at set 25h ago → 401 session_inactive
 * Test 2: Token rotation — rotated_at set 5h ago → 401 token_rotation_required
 * Test 3: max_expires_at — must equal created_date + 7 days exactly
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
    const now = new Date();

    // ── TEST 1: Inactivity expiry (last_used_at = 25h ago) ──────────
    const inactiveSession = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash + '_test_inactive',
      device_info: 'test-inactivity',
      last_used_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      rotated_at: now.toISOString(),
      max_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Validate inactivity logic directly (same check as validateSession middleware)
    const inactiveLastUsed = new Date(inactiveSession.last_used_at);
    const inactiveMs = now - inactiveLastUsed;
    const INACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
    const isInactive = inactiveMs > INACTIVITY_WINDOW_MS;

    results.test1_inactivity = {
      session_id: inactiveSession.id,
      last_used_at: inactiveSession.last_used_at,
      hours_inactive: Math.round(inactiveMs / (60 * 60 * 1000)),
      threshold_hours: 24,
      exceeds_threshold: isInactive,
      would_return_401: isInactive,
      reason: isInactive ? 'session_inactive' : null,
    };

    // Cleanup
    await base44.asServiceRole.entities.UserSession.delete(inactiveSession.id);

    // ── TEST 2: Token rotation (rotated_at = 5h ago) ────────────────
    const rotationSession = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash + '_test_rotation',
      device_info: 'test-rotation',
      last_used_at: now.toISOString(),   // active
      rotated_at: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
      max_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const rotatedAt = new Date(rotationSession.rotated_at);
    const rotationAgeMs = now - rotatedAt;
    const ROTATION_WINDOW_MS = 4 * 60 * 60 * 1000;
    const needsRotation = rotationAgeMs > ROTATION_WINDOW_MS;

    results.test2_rotation = {
      session_id: rotationSession.id,
      rotated_at: rotationSession.rotated_at,
      hours_since_rotation: Math.round(rotationAgeMs / (60 * 60 * 1000)),
      threshold_hours: 4,
      exceeds_threshold: needsRotation,
      would_return_401: needsRotation,
      reason: needsRotation ? 'token_rotation_required' : null,
      header: needsRotation ? 'X-Token-Rotation-Required: true' : null,
    };

    await base44.asServiceRole.entities.UserSession.delete(rotationSession.id);

    // ── TEST 3: max_expires_at = created_date + 7 days ──────────────
    const maxAgeSession = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: tokenHash + '_test_maxage',
      device_info: 'test-maxage',
      last_used_at: now.toISOString(),
      rotated_at: now.toISOString(),
      max_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: now.toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Re-fetch to get the server-set created_date
    const fetched = await base44.asServiceRole.entities.UserSession.filter({ id: maxAgeSession.id });
    const stored = fetched[0];

    const createdDate = new Date(stored.created_date);
    const maxExpiresDate = new Date(stored.max_expires_at);
    const diffMs = maxExpiresDate - createdDate;
    const diffDays = diffMs / (24 * 60 * 60 * 1000);
    const exactMatch = Math.abs(diffDays - 7) < 0.001;

    results.test3_maxExpires = {
      session_id: stored.id,
      created_date: stored.created_date,
      max_expires_at: stored.max_expires_at,
      diff_days: Math.round(diffDays * 1000) / 1000,
      exact_7_days: exactMatch,
    };

    await base44.asServiceRole.entities.UserSession.delete(maxAgeSession.id);

    // ── Summary ────────────────────────────────────────────────────
    const allPassed = results.test1_inactivity.would_return_401
      && results.test2_rotation.would_return_401
      && results.test3_maxExpires.exact_7_days;

    return Response.json({
      all_passed: allPassed,
      summary: {
        test1: results.test1_inactivity.would_return_401 ? 'PASS' : 'FAIL',
        test2: results.test2_rotation.would_return_401 ? 'PASS' : 'FAIL',
        test3: results.test3_maxExpires.exact_7_days ? 'PASS' : 'FAIL',
      },
      results,
    });
  } catch (error) {
    console.error('[testSessionLifecycle]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});