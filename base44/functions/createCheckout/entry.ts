import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, description, player_id, player_name, team_name, invoice_ids, success_url, cancel_url } = await req.json();

    // Build line items — if invoice_ids provided, fetch line details from each invoice
    let stripeLineItems = [];
    let totalAmount = amount;

    if (invoice_ids && invoice_ids.length > 0) {
      const invoices = await base44.asServiceRole.entities.Payment.list();
      const myInvoices = invoices.filter(i => invoice_ids.includes(i.id));
      for (const inv of myInvoices) {
        const balance = (inv.amount || 0) - (inv.paid_amount || 0);
        if (balance <= 0) continue;
        stripeLineItems.push({
          price_data: {
            currency: 'usd',
            product_data: { name: inv.description + (inv.player_name ? ` — ${inv.player_name}` : '') },
            unit_amount: balance,
          },
          quantity: 1,
        });
      }
      totalAmount = stripeLineItems.reduce((s, li) => s + li.price_data.unit_amount, 0);
    } else {
      stripeLineItems = [{
        price_data: {
          currency: 'usd',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      }];
    }

    if (stripeLineItems.length === 0 || totalAmount <= 0) {
      return Response.json({ error: 'No payable balance found' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      payment_method_options: {
        us_bank_account: { verification_method: 'instant' },
      },
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: success_url || `${req.headers.get('origin')}/ParentPortal?payment=success`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/ParentPortal?payment=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        player_id: player_id || '',
        player_name: player_name || '',
        team_name: team_name || '',
        parent_email: user.email,
        invoice_ids: invoice_ids ? JSON.stringify(invoice_ids) : '',
        // Sport accounting attribution
        sport_name: (invoice_ids && invoice_ids.length === 1
          ? (await base44.asServiceRole.entities.Payment.list()).find(i => i.id === invoice_ids[0])?.sport_name || ''
          : ''),
        sport_id: (invoice_ids && invoice_ids.length === 1
          ? (await base44.asServiceRole.entities.Payment.list()).find(i => i.id === invoice_ids[0])?.sport_id || ''
          : ''),
        accounting_code: (invoice_ids && invoice_ids.length === 1
          ? (await base44.asServiceRole.entities.Payment.list()).find(i => i.id === invoice_ids[0])?.accounting_code || ''
          : ''),
      },
    });

    // If invoice_ids provided, link the stripe session to each existing invoice
    if (invoice_ids && invoice_ids.length > 0) {
      await Promise.all(invoice_ids.map(id =>
        base44.asServiceRole.entities.Payment.update(id, { stripe_session_id: session.id })
      ));
    } else {
      // Legacy: create a new payment record
      await base44.asServiceRole.entities.Payment.create({
        player_id,
        player_name,
        team_name,
        parent_email: user.email,
        amount,
        description,
        stripe_session_id: session.id,
        status: 'pending',
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});