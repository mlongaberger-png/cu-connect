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
      const type = session.metadata?.type;

      if (type === 'registration') {
        const submissionId = session.metadata?.submission_id;
        if (submissionId) {
          await base44.asServiceRole.entities.RegistrationSubmission.update(submissionId, { payment_status: 'paid' });
          const subs = await base44.asServiceRole.entities.RegistrationSubmission.filter({ id: submissionId });
          if (subs.length > 0 && subs[0].parent_email) {
            await base44.asServiceRole.functions.invoke('inviteParent', { email: subs[0].parent_email });
          }
          console.log(`Registration payment confirmed: ${submissionId}`);
        }
      } else {
        // New flow: invoice_ids in metadata
        const invoiceIdsRaw = session.metadata?.invoice_ids;
        if (invoiceIdsRaw) {
          const invoiceIds = JSON.parse(invoiceIdsRaw);
          await Promise.all(invoiceIds.map(id =>
            base44.asServiceRole.entities.Payment.update(id, {
              status: 'paid',
              paid_amount_override: session.amount_total, // informational
            })
          ));
          // Mark each invoice paid with its full amount
          const invoices = await base44.asServiceRole.entities.Payment.list();
          const myInvoices = invoices.filter(i => invoiceIds.includes(i.id));
          await Promise.all(myInvoices.map(inv =>
            base44.asServiceRole.entities.Payment.update(inv.id, {
              status: 'paid',
              paid_amount: inv.amount,
              stripe_payment_intent_id: session.payment_intent || '',
            })
          ));
          console.log(`Marked ${invoiceIds.length} invoice(s) as paid for session ${session.id}`);
        } else {
          // Legacy flow: find by stripe_session_id
          const payments = await base44.asServiceRole.entities.Payment.filter({ stripe_session_id: session.id });
          if (payments.length > 0) {
            await base44.asServiceRole.entities.Payment.update(payments[0].id, {
              status: 'paid',
              paid_amount: payments[0].amount,
              stripe_payment_intent_id: session.payment_intent || '',
            });
            console.log(`Payment marked paid (legacy): ${session.id}`);
          }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});