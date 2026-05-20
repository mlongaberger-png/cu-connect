import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { endpoint, keys, remove } = await req.json();

    if (!endpoint) {
      return Response.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    // Remove all existing subscriptions for this user
    const existing = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: user.email });
    for (const sub of existing) {
      await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
    }

    // If this is an unsubscribe request, just delete and return
    if (remove) {
      console.log(`Push subscription removed for ${user.email}`);
      return Response.json({ success: true, removed: true });
    }

    if (!keys?.p256dh || !keys?.auth) {
      return Response.json({ error: 'Invalid subscription keys' }, { status: 400 });
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