import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * End-to-end token invalidation test:
 *
 * 1. Generate a 256-bit session token, hash it, store in UserSession
 * 2. Validate the session (must pass)
 * 3. Invalidate all sessions
 * 4. Validate again (must return valid: false / reason: session_revoked)
 * 5. Generate a fresh token — must be ≥ 43 chars, SHA-256 stores as 64-char hex
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'athletic_director'].includes(user.role)) {
      return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });
    }

    const results = {};
    const now = new Date();
    const nowISO = now.toISOString();

    // ── Helper ────────────────────────────────────────────────────────
    function hashToken(t) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    }

    function generateToken() {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // ── STEP 1: Create a fresh session (mimics trackSession) ──────────
    const sessionToken = generateToken();
    const sessionTokenHash = await hashToken(sessionToken);

    results.step1_token_generated = {
      token_length: sessionToken.length,
      token_is_base64url: /^[A-Za-z0-9_-]+$/.test(sessionToken),
      hash_length: sessionTokenHash.length,
      hash_is_hex: /^[0-9a-f]{64}$/.test(sessionTokenHash),
      passes_d2_3a: sessionToken.length >= 43 && sessionTokenHash.length === 64,
    };

    const stored = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: 'e2e-platform-hash',
      session_token_hash: sessionTokenHash,
      device_info: 'e2e-invalidation-test',
      ip_address: '127.0.0.1',
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: nowISO,
      last_used_at: nowISO,
      rotated_at: nowISO,
      max_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    results.step1_session_created = {
      id: stored.id,
      stored_session_token_hash: stored.session_token_hash,
      hash_matches: stored.session_token_hash === sessionTokenHash,
    };

    // ── STEP 2: Validate BEFORE invalidation (must pass) ──────────────
    const beforeCheck = await base44.asServiceRole.functions.invoke('validateSession', {
      session_token: sessionToken,
      user_id: user.id,
    });
    results.step2_validate_before = {
      valid: beforeCheck.valid,
      session_id: beforeCheck.session?.id,
    };

    // ── STEP 3: Invalidate ALL sessions ───────────────────────────────
    const invalidation = await base44.asServiceRole.functions.invoke('invalidateAllSessions', {});
    results.step3_invalidate = {
      invalidated_count: invalidation.invalidated_count,
      total_sessions: invalidation.total_sessions,
      success: invalidation.success,
    };

    // ── STEP 4: Validate AFTER invalidation (must fail) ───────────────
    const afterCheck = await base44.asServiceRole.functions.invoke('validateSession', {
      session_token: sessionToken,
      user_id: user.id,
    });
    results.step4_validate_after = {
      valid: afterCheck.valid,
      error: afterCheck.error,
      reason: afterCheck.reason,
      http_401_equivalent: afterCheck.reason === 'session_revoked',
    };

    // ── STEP 5: Tamper test — modify one character, validate ──────────
    const tamperedToken = sessionToken.slice(0, -1) + (sessionToken.slice(-1) === 'A' ? 'B' : 'A');
    const tamperCheck = await base44.asServiceRole.functions.invoke('validateSession', {
      session_token: tamperedToken,
      user_id: user.id,
    });
    results.step5_tamper_test = {
      tampered_different: tamperedToken !== sessionToken,
      valid: tamperCheck.valid,
      reason: tamperCheck.reason,
      http_401_equivalent: !tamperCheck.valid,
    };

    // ── STEP 6: Generate fresh token after invalidation ───────────────
    const freshToken = generateToken();
    const freshHash = await hashToken(freshToken);

    const freshSession = await base44.asServiceRole.entities.UserSession.create({
      user_id: user.id,
      user_email: user.email,
      token_hash: 'e2e-fresh-hash',
      session_token_hash: freshHash,
      device_info: 'e2e-fresh-token',
      ip_address: '127.0.0.1',
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: nowISO,
      last_used_at: nowISO,
      rotated_at: nowISO,
      max_expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const freshCheck = await base44.asServiceRole.functions.invoke('validateSession', {
      session_token: freshToken,
      user_id: user.id,
    });
    results.step6_fresh_token = {
      token_length: freshToken.length,
      hash_length: freshHash.length,
      hash_is_hex: /^[0-9a-f]{64}$/.test(freshHash),
      passes_d2_3a: freshToken.length >= 43 && freshHash.length === 64,
      valid: freshCheck.valid,
      session_id: freshCheck.session?.id,
    };

    // ── Cleanup test sessions ────────────────────────────────────────
    await base44.asServiceRole.entities.UserSession.delete(stored.id).catch(() => {});
    await base44.asServiceRole.entities.UserSession.delete(freshSession.id).catch(() => {});

    // ── Final verdict ────────────────────────────────────────────────
    const allPassed =
      results.step1_token_generated.passes_d2_3a &&
      results.step2_validate_before.valid === true &&
      results.step3_invalidate.success === true &&
      results.step3_invalidate.invalidated_count >= 1 &&
      results.step4_validate_after.http_401_equivalent === true &&
      results.step5_tamper_test.http_401_equivalent === true &&
      results.step6_fresh_token.passes_d2_3a &&
      results.step6_fresh_token.valid === true;

    return Response.json({
      all_passed: allPassed,
      summary: {
        step1_generation: results.step1_token_generated.passes_d2_3a ? 'PASS' : 'FAIL',
        step2_beforeValidate: results.step2_validate_before.valid === true ? 'PASS' : 'FAIL',
        step3_invalidateAll: results.step3_invalidate.invalidated_count >= 1 ? 'PASS' : 'FAIL',
        step4_afterValidate: results.step4_validate_after.http_401_equivalent ? 'PASS' : 'FAIL',
        step5_tamper: results.step5_tamper_test.http_401_equivalent ? 'PASS' : 'FAIL',
        step6_freshToken: results.step6_fresh_token.valid === true ? 'PASS' : 'FAIL',
      },
      results,
    });
  } catch (error) {
    console.error('[testInvalidationE2E]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});