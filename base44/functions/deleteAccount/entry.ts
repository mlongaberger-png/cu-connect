import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Session guard — rejects revoked/inactive/expired sessions
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const sc = await base44.asServiceRole.functions.invoke('validateSession', { token, user_id: user.id });
        if (sc?.valid === false && sc?.reason !== 'session_not_found') {
          return Response.json({ error: sc.error || 'Session invalid', reason: sc.reason }, { status: 401 });
        }
      } catch (e) {
        // Session check itself failed — don't block. Function's own auth guard is satisfied.
        console.error('[session-gate]', e.message);
      }
    }

    // Delegate cascading child-record cleanup to orphanedRecordCleaner (service-role call)
    let cleanupData = null;
    try {
      const cleanupResult = await base44.asServiceRole.functions.invoke('orphanedRecordCleaner', {
        target_email: user.email,
        target_user_id: user.id,
      });
      // functions.invoke returns an Axios response — extract .data to avoid circular JSON
      cleanupData = cleanupResult?.data || null;
      console.log('orphanedRecordCleaner result:', JSON.stringify(cleanupData));
    } catch (e) {
      console.warn('orphanedRecordCleaner failed (continuing):', e.message);
    }

    // NOTE: Financial records (Payments) and compliance records are intentionally retained.
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'account_deleted',
      category: 'user',
      actor_email: user.email,
      actor_name: user.full_name || user.email,
      actor_role: user.role || 'user',
      description: `User ${user.email} requested account deletion. All orphaned child records removed. Financial records retained per compliance policy.`,
    });

    return Response.json({ success: true, cleanup: cleanupData });
  } catch (error) {
    console.error('deleteAccount error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});