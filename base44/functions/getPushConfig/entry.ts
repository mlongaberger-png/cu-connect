import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import webpush from 'npm:web-push@3.6.7';

// Returns the VAPID public key for push subscription (generates keys on first call).
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'vapid_keys' });

    let vapidKeys;
    if (configs.length > 0) {
      vapidKeys = JSON.parse(configs[0].value);
    } else {
      vapidKeys = webpush.generateVAPIDKeys();
      await base44.asServiceRole.entities.AppConfig.create({
        key: 'vapid_keys',
        value: JSON.stringify(vapidKeys),
      });
      console.log('Generated new VAPID keys');
    }

    return Response.json({ publicKey: vapidKeys.publicKey });
  } catch (error) {
    console.error('getPushConfig error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});