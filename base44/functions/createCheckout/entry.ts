import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, description, player_id, player_name, team_name, invoice_ids, success_url, cancel_url } = await req.json();

    console.log('[createCheckout] invoice_ids received:', invoice_ids);

    let stripeLineItems = [];
    let totalAmount = 0;
    let resolvedInvoices = [];

    if (invoice_ids && invoice_ids.length > 0) {
      // Fetch each invoice by ID directly to avoid pagination limits
      const fetched = await Promise.all(
        invoice_ids.map(id =>
          base44.asServiceRole.entities.Payment.get(id).catch(err => {
            console.error(`[createCheckout] Failed to fetch invoice ${id}:`, err.message);
            return null;
          })
        )
      );

      resolvedInvoices = fetched.filter(Boolean);
      console.log('[createCheckout] resolved invoices:', resolvedInvoices.map(i => ({ id: i.id, status: i.status, amount: i.amount, paid_amount: i.paid_amount })));

      for (const inv of resolvedInvoices) {
        if (['paid', 'voided', 'refunded', 'draft'].includes(inv.status)) continue;
        const balance = (inv.amount || 0) - (inv.paid_amount || 0);
        if (balance <= 0) continue;
        stripeLineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: inv.description + (inv.player_name ? ` — ${inv.player_name}` : ''),
            },
            unit_amount: balance,
          },
          quantity: 1,
        });
      }

      totalAmount = stripeLineItems.reduce((s, li) => s + li.price_data.unit_amount, 0);

      if (stripeLineItems.length === 0 || totalAmount <= 0) {
        console.warn('[createCheckout] No unpaid balances found for invoice_ids:', invoice_ids);
        return Response.json({ error: 'No unpaid or partially-paid invoices found' }, { status: 400 });
      }

    } else if (amount > 0 && description) {
      // Legacy single-amount flow
      stripeLineItems = [{
        price_data: {
          currency: 'usd',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      }];
      totalAmount = amount;
    } else {
      return Response.json({ error: 'No invoice_ids or amount provided' }, { status: 400 });
    }

    // Build metadata
    const firstInvoice = resolvedInvoices[0];
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
        sport_name: firstInvoice?.sport_name || '',
        sport_id: firstInvoice?.sport_id || '',
        accounting_code: firstInvoice?.accounting_code || '',
        season_id: firstInvoice?.season_id || '',
        season_name: firstInvoice?.season_name || '',
      },
    });

    console.log('[createCheckout] Stripe session created:', session.id, 'total:', totalAmount);

    // Link stripe session id to each invoice
    if (invoice_ids && invoice_ids.length > 0) {
      await Promise.all(
        invoice_ids.map(id =>
          base44.asServiceRole.entities.Payment.update(id, { stripe_session_id: session.id })
        )
      );
    } else {
      // Legacy: create payment record
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
    console.error('[createCheckout] Unexpected error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});