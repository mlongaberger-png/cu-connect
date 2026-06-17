import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Token reuse after logout test:
 *
 *   1. Capture the current Bearer token
 *   2. Revoke the session (simulate logout)
 *   3. Attempt to use the revoked token against validateSession
 *   4. Attempt to use the revoked token against a data-access endpoint
 *
 * This proves whether a captured token survives server-side revocation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return Response.json({ error: 'No token in request' }, { status: 400 });

    const results = {};
    const now = new Date().toISOString();

    // ── Step 1: Prove the token is currently valid ──
    results.step1_token_valid = {
      user_id: user.id,
      user_email: user.email,
      role: user.role,
      token_prefix: token.substring(0, 8) + '...',
    };

    // ── Step 2: Revoke the session (simulates logout) ──
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const sessions = await base44.asServiceRole.entities.UserSession.filter({ token_hash: tokenHash });
    
    results.step2_session_state = {
      sessions_found: sessions.length,
      previously_revoked: sessions[0]?.revoked_at || null,
    };

    // Revoke all sessions for this token
    for (const s of sessions) {
      if (!s.revoked_at) {
        await base44.asServiceRole.entities.UserSession.update(s.id, { revoked_at: now });
        results.step2_session_state.revoked_now = true;
        results.step2_session_state.revoked_session_id = s.id;
      }
    }

    if (sessions.length === 0) {
      results.step2_session_state.note = 'No UserSession record found for this token — revocation has no effect';
    }

    // ── Step 3: Try validateSession with the compromised token ──
    try {
      const validationResult = await base44.asServiceRole.functions.invoke('validateSession', {});
      results.step3_validate_after_revoke = validationResult;
    } catch (e) {
      results.step3_validate_after_revoke = { error: e.message };
    }

    // ── Step 4: Try to read data with the compromised token (user-scoped) ──
    try {
      const events = await base44.entities.Event.list('-created_date', 1);
      results.step4_data_access_after_revoke = {
        access: 'ALLOWED — token still works for entity reads',
        records_returned: events.length,
      };
    } catch (e) {
      results.step4_data_access_after_revoke = {
        access: 'DENIED',
        error: e.message,
      };
    }

    // ── Step 5: Try auth.me() again after revocation ──
    try {
      const userAfter = await base44.auth.me();
      results.step5_auth_me_after_revoke = {
        still_authenticated: true,
        user_id: userAfter.id,
        note: 'Platform JWT still valid — app-level UserSession revocation does NOT invalidate the JWT',
      };
    } catch (e) {
      results.step5_auth_me_after_revoke = {
        still_authenticated: false,
        error: e.message,
        note: 'Platform-level logout invalidated the JWT',
      };
    }

    // ── Verdict ──
    const tokenStillWorks = results.step4_data_access_after_revoke?.access?.startsWith('ALLOWED');
    results.verdict = tokenStillWorks
      ? 'FAIL — Captured token SURVIVES app-level session revocation. The JWT remains valid until platform logout (base44.auth.logout) is called.'
      : 'PASS — App-level session revocation successfully killed the token.';

    return Response.json(results);
  } catch (error) {
    console.error('[testTokenReuseAfterLogout]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});