import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';
import { z } from 'npm:zod@3.24.2';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

const checkoutSchema = z.object({
  amount: z.number().optional(),
  description: z.string().optional(),
  player_id: z.string().optional(),
  player_name: z.string().optional(),
  team_name: z.string().optional(),
  invoice_ids: z.array(z.string()).optional(),
  success_url: z.string().optional(),
  cancel_url: z.string().optional(),
}).strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Session guard — rejects revoked/inactive/expired sessions
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const sc = await base44.asServiceRole.functions.invoke('validateSession', { token, user_id: user.id });
        if (sc?.valid === false && sc?.reason !== 'session_not_found') {
          return Response.json({ error: sc.error || 'Session invalid', reason: sc.reason }, { status: 401 });
        }
      } catch (e) {
        // Session check itself failed (e.g. no session record, or platform error) — don't block.
        // The function's own auth guard (auth.me()) is already satisfied.
        console.error('[session-gate]', e.message);
      }
    }

    const rawBody = await req.json();
    const parsed = checkoutSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { amount, description, player_id, player_name, team_name, invoice_ids, success_url, cancel_url } = parsed.data;

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

      // Enforce ownership: invoice must belong to the authenticated user (direct match),
      // OR the user must be a guardian with financial_contributor permission for that player,
      // OR the user is the promoted athlete linked to that player (and not paused).
      const invoicePlayerIds = [...new Set(resolvedInvoices.map(inv => inv.player_id).filter(Boolean))];
      let guardianFinancialAccess = new Set();
      if (invoicePlayerIds.length > 0) {
        const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({
          user_email: user.email,
        });
        for (const link of guardianLinks) {
          if (invoicePlayerIds.includes(link.player_id) && (link.permissions || []).includes('financial_contributor')) {
            guardianFinancialAccess.add(link.player_id);
          }
        }
      }

      // Resolve each invoice's linked Player to check athlete_email (for the athlete-owner
      // ownership branch below). We look these up directly rather than trusting the
      // denormalized Payment.athlete_email field so this works even for pre-backfill records.
      const athletePlayerMap = new Map(); // player_id -> athlete_email
      if (invoicePlayerIds.length > 0) {
        const playerRecords = await Promise.all(
          invoicePlayerIds.map(pid =>
            base44.asServiceRole.entities.Player.get(pid).catch(err => {
              console.error(`[createCheckout] Failed to fetch player ${pid}:`, err.message);
              return null;
            })
          )
        );
        for (const p of playerRecords) {
          if (p) athletePlayerMap.set(p.id, p.athlete_email || '');
        }
      }

      // Fresh, server-side re-check of the caller's own athlete_paused state. The caller IS
      // the athlete in this branch (we're checking their own User record, which they can read
      // normally), so this isn't a privacy issue — it's a deliberate double-check so a paused
      // athlete is rejected here even if their Payment RLS read still technically works through
      // a cache or stale session/user snapshot. Fail closed (treat as paused) if we can't find
      // a User record for some reason.
      const isCallerLinkedAsAthlete = [...athletePlayerMap.values()].some(email => email && email === user.email);
      let callerAthletePausedFresh = false;
      if (isCallerLinkedAsAthlete) {
        const freshUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
        callerAthletePausedFresh = freshUsers.length > 0 ? !!freshUsers[0].athlete_paused : true;
      }

      for (const inv of resolvedInvoices) {
        const isDirectOwner = inv.parent_email && inv.parent_email === user.email;
        const isFinancialGuardian = inv.player_id && guardianFinancialAccess.has(inv.player_id);
        const invoiceAthleteEmail = inv.player_id ? athletePlayerMap.get(inv.player_id) : '';
        const isAthleteOwner = !!invoiceAthleteEmail && invoiceAthleteEmail === user.email && !callerAthletePausedFresh;
        if (!isDirectOwner && !isFinancialGuardian && !isAthleteOwner) {
          return Response.json({ error: 'Forbidden: invoice does not belong to you' }, { status: 403 });
        }
      }

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