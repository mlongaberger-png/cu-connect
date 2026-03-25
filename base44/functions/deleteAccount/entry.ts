import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Delete guardian links for this user
  const guardianLinks = await base44.entities.PlayerGuardian.filter({ user_email: user.email });
  for (const link of guardianLinks) {
    await base44.entities.PlayerGuardian.delete(link.id);
  }

  // Delete push subscriptions
  const subs = await base44.entities.PushSubscription.filter({ user_email: user.email });
  for (const sub of subs) {
    await base44.entities.PushSubscription.delete(sub.id);
  }

  // Delete notification preferences
  const prefs = await base44.entities.NotificationPreference.filter({ user_email: user.email });
  for (const pref of prefs) {
    await base44.entities.NotificationPreference.delete(pref.id);
  }

  // NOTE: Financial records (Payments) and compliance records are intentionally retained.
  // Log the deletion request
  await base44.asServiceRole.entities.AuditLog.create({
    action: 'account_deleted',
    category: 'user',
    actor_email: user.email,
    actor_name: user.full_name || user.email,
    actor_role: user.role || 'user',
    description: `User ${user.email} requested account deletion. Guardian links and personal data removed. Financial records retained per compliance policy.`,
  });

  return Response.json({ success: true });
});