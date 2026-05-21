import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Delegate cascading child-record cleanup to orphanedRecordCleaner (service-role call)
    const cleanupResult = await base44.asServiceRole.functions.invoke('orphanedRecordCleaner', {
      target_email: user.email,
      target_user_id: user.id,
    });
    console.log('orphanedRecordCleaner result:', JSON.stringify(cleanupResult));

    // NOTE: Financial records (Payments) and compliance records are intentionally retained.
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'account_deleted',
      category: 'user',
      actor_email: user.email,
      actor_name: user.full_name || user.email,
      actor_role: user.role || 'user',
      description: `User ${user.email} requested account deletion. All orphaned child records removed. Financial records retained per compliance policy.`,
    });

    return Response.json({ success: true, cleanup: cleanupResult });
  } catch (error) {
    console.error('deleteAccount error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});