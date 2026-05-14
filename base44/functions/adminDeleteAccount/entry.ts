import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const { target_user_id, target_email } = await req.json();
  if (!target_user_id || !target_email) {
    return Response.json({ error: 'target_user_id and target_email are required' }, { status: 400 });
  }

  // Prevent admins from deleting themselves
  if (target_email === user.email) {
    return Response.json({ error: 'You cannot delete your own account this way.' }, { status: 400 });
  }

  // Delete guardian links
  const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: target_email });
  for (const link of guardianLinks) {
    await base44.asServiceRole.entities.PlayerGuardian.delete(link.id);
  }

  // Delete push subscriptions
  const subs = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: target_email });
  for (const sub of subs) {
    await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
  }

  // Delete notification preferences
  const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: target_email });
  for (const pref of prefs) {
    await base44.asServiceRole.entities.NotificationPreference.delete(pref.id);
  }

  // Delete the User entity record
  await base44.asServiceRole.entities.User.delete(target_user_id);

  // Audit log
  await base44.asServiceRole.entities.AuditLog.create({
    action: 'admin_account_deleted',
    category: 'user',
    actor_email: user.email,
    actor_name: user.full_name || user.email,
    actor_role: user.role,
    target_entity: 'User',
    target_id: target_user_id,
    target_name: target_email,
    description: `Admin ${user.email} deleted account for ${target_email}. Guardian links and personal data removed. Financial records retained per compliance policy.`,
  });

  return Response.json({ success: true });
});