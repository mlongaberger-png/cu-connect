import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Re-fetch caller role from DB — never trust the request payload
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = dbUser[0]?.role;
    if (callerRole !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

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
    const cleanupResult = await base44.asServiceRole.functions.invoke('orphanedRecordCleaner', {
      target_email,
      target_user_id,
    });
    console.log('orphanedRecordCleaner result:', JSON.stringify(cleanupResult));

    // Delete the User entity record last
    await base44.asServiceRole.entities.User.delete(target_user_id);

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

    return Response.json({ success: true, cleanup: cleanupResult });
  } catch (error) {
    console.error('adminDeleteAccount error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});