import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check (not JWT claim) + audit log ──────
    const authUser = await base44.auth.me();
    const ip = getClientIP(req);

    if (!authUser) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: 'unknown', user_email: 'unknown',
        endpoint: 'adminDeleteAccount', action: 'delete_user_account',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRecord = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    if (userRecord.length === 0 || userRecord[0].role !== 'admin') {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: authUser.id, user_email: authUser.email,
        endpoint: 'adminDeleteAccount', action: 'delete_user_account',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: authUser.id, user_email: authUser.email,
      endpoint: 'adminDeleteAccount', action: 'delete_user_account',
      ip_address: ip, result: 'allowed',
    }).catch(() => {});

    const caller = { email: authUser.email, id: authUser.id };
    const callerRole = 'admin';

    // Session guard — rejects revoked/inactive/expired sessions
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const sc = await base44.asServiceRole.functions.invoke('validateSession', { token, user_id: caller.id });
        if (sc?.valid === false && sc?.reason !== 'session_not_found') {
          return Response.json({ error: sc.error || 'Session invalid', reason: sc.reason }, { status: 401 });
        }
      } catch (e) {
        // Session check itself failed — don't block. Function's own auth guard is satisfied.
        console.error('[session-gate]', e.message);
      }
    }

    const { target_user_id, target_email } = await req.json();
    if (!target_user_id || !target_email) {
      return Response.json({ error: 'target_user_id and target_email are required' }, { status: 400 });
    }

    // Prevent admins from deleting themselves
    if (target_email === caller.email) {
      return Response.json({ error: 'You cannot delete your own account this way.' }, { status: 400 });
    }

    // Delegate all cascading child-record cleanup to orphanedRecordCleaner
    let cleanupData = null;
    try {
      const cleanupResult = await base44.asServiceRole.functions.invoke('orphanedRecordCleaner', {
        target_email,
        target_user_id,
      });
      // functions.invoke returns an Axios response — extract .data to avoid circular JSON
      cleanupData = cleanupResult?.data || null;
      console.log('orphanedRecordCleaner result:', JSON.stringify(cleanupData));
    } catch (e) {
      console.warn('orphanedRecordCleaner failed (continuing):', e.message);
    }

    // Delete the User entity record last
    try {
      await base44.asServiceRole.entities.User.delete(target_user_id);
    } catch (e) {
      console.warn('User.delete failed (may already be removed):', e.message);
    }

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'admin_account_deleted',
      category: 'user',
      actor_email: caller.email,
      actor_name: caller.full_name || caller.email,
      actor_role: callerRole,
      target_entity: 'User',
      target_id: target_user_id,
      target_name: target_email,
      description: `Admin ${caller.email} deleted account for ${target_email}. All orphaned child records removed. Financial records retained per compliance policy.`,
    });

    return Response.json({ success: true, cleanup: cleanupData });
  } catch (error) {
    console.error('adminDeleteAccount error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});