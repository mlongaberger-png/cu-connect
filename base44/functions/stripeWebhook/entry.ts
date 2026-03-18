import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event;
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const payments = await base44.asServiceRole.entities.Payment.filter({ stripe_session_id: session.id });
      if (payments.length > 0) {
        await base44.asServiceRole.entities.Payment.update(payments[0].id, { status: 'paid' });
        console.log(`Payment marked as paid: ${session.id}`);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});