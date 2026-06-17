import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { z } from 'npm:zod@3.24.2';

const subscriptionSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }).optional(),
  remove: z.boolean().optional(),
}).strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rawBody = await req.json();
    const parsed = subscriptionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { endpoint, keys, remove } = parsed.data;

    if (!endpoint) {
      return Response.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    // Handle unsubscribe: mark this specific endpoint inactive
    if (remove) {
      const existing = await base44.asServiceRole.entities.PushSubscription.filter({
        user_email: user.email,
        endpoint,
      });
      for (const sub of existing) {
        await base44.asServiceRole.entities.PushSubscription.delete(sub.id);
      }
      console.log(`Push subscription removed for ${user.email}`);
      return Response.json({ success: true, removed: true });
    }

    // Validate keys before saving
    if (!keys?.p256dh || !keys?.auth) {
      console.error(`Invalid subscription keys for ${user.email}`);
      return Response.json({ error: 'Invalid subscription keys' }, { status: 400 });
    }

    // Upsert: if endpoint already exists for this user, update it; otherwise create
    const allForUser = await base44.asServiceRole.entities.PushSubscription.filter({ user_email: user.email });
    const existing = allForUser.filter(s => s.endpoint === endpoint);

    // Cap subscriptions per user at 10 to prevent DB flooding
    if (existing.length === 0 && allForUser.length >= 10) {
      console.warn(`Subscription cap reached for ${user.email}`);
      return Response.json({ error: 'Too many subscriptions for this account' }, { status: 429 });
    }

    if (existing.length > 0) {
      await base44.asServiceRole.entities.PushSubscription.update(existing[0].id, {
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        is_active: true,
      });
    } else {
      await base44.asServiceRole.entities.PushSubscription.create({
        user_email: user.email,
        endpoint,
        p256dh_key: keys.p256dh,
        auth_key: keys.auth,
        is_active: true,
      });
    }

    console.log(`Push subscription saved for ${user.email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('saveSubscription error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});