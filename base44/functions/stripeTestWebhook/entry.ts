import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';

// stripeTestWebhook
//
// Stripe TEST-mode webhook for website registrations (metadata.type ===
// 'program_registration'). Kept separate from the live stripeWebhook so test
// traffic can never touch live payment handling. Needs two secrets:
//   STRIPE_TEST_SECRET_KEY      (already set)
//   STRIPE_TEST_WEBHOOK_SECRET  (signing secret of the test-mode endpoint in Stripe)
// When registration goes live, the same branch moves into stripeWebhook.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const secret = Deno.env.get('STRIPE_TEST_WEBHOOK_SECRET');
    const key = Deno.env.get('STRIPE_TEST_SECRET_KEY');
    if (!secret || !key) {
      console.error('[stripeTestWebhook] STRIPE_TEST_WEBHOOK_SECRET or STRIPE_TEST_SECRET_KEY not set');
      return Response.json({ error: 'Not configured' }, { status: 500 });
    }
    const sig = req.headers.get('stripe-signature');
    if (!sig) return Response.json({ error: 'Missing signature' }, { status: 400 });

    const stripe = new Stripe(key);
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, sig, secret);
    if (event.livemode) return Response.json({ received: true, skipped: 'live event on test endpoint' });

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
      const session = event.data.object;
      if (session.metadata?.type !== 'program_registration') return Response.json({ received: true, skipped: 'not a website registration' });
      const regId = session.metadata.registration_id;
      const reg = await base44.asServiceRole.entities.ProgramRegistration.get(regId).catch(() => null);
      if (!reg) return Response.json({ received: true, skipped: 'registration not found' });

      if (event.type === 'checkout.session.expired') {
        if (reg.payment_status === 'pending_checkout') {
          await base44.asServiceRole.entities.ProgramRegistration.update(regId, { payment_status: 'abandoned' });
        }
        return Response.json({ received: true });
      }

      // Idempotent: already handled
      if (reg.payment_status === 'deposit_paid' || reg.payment_status === 'paid_in_full') {
        return Response.json({ received: true, skipped: 'duplicate' });
      }

      const invoiceIds = String(session.metadata.invoice_ids || '').split(',').filter(Boolean);
      for (const id of invoiceIds) {
        const inv = await base44.asServiceRole.entities.Payment.get(id).catch(() => null);
        if (!inv || inv.status === 'paid') continue;
        await base44.asServiceRole.entities.Payment.update(id, {
          status: 'paid',
          paid_amount: inv.amount,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent || '',
        });
      }
      await base44.asServiceRole.entities.ProgramRegistration.update(regId, {
        payment_status: reg.payment_plan === 'three_payments' ? 'deposit_paid' : 'paid_in_full',
      });

      // Invite the parent to CU Connect if they don't have an account yet.
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: reg.parent_email });
        if (!users.length) {
          const svc = base44.asServiceRole;
          if (svc.users?.inviteUser) await svc.users.inviteUser(reg.parent_email, 'user', '/AcceptInvite');
          else await base44.users.inviteUser(reg.parent_email, 'user', '/AcceptInvite');
        }
      } catch (e) {
        console.error('[stripeTestWebhook] invite failed (registration still recorded):', e.message);
      }
      console.log(`[stripeTestWebhook] ${reg.confirmation_code} paid; invoices ${invoiceIds.join(',')}`);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripeTestWebhook]', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});
