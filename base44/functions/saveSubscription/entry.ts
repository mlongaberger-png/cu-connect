import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    // Remove old subscriptions for this user
    const existing = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: user.email });
    for (const sub of existing) {
      await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
    }

    // Save new subscription
    await base44.asServiceRole.entities.PushSubscription.create({
      user_email: user.email,
      endpoint,
      p256dh_key: keys.p256dh,
      auth_key: keys.auth,
      is_active: true,
    });

    console.log(`Push subscription saved for ${user.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('saveSubscription error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});