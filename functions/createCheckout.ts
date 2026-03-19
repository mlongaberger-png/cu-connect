import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { amount, description, player_id, player_name, team_name, success_url, cancel_url } = await req.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: success_url || `${req.headers.get('origin')}/ParentPortal?payment=success`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/ParentPortal?payment=cancelled`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        player_id,
        player_name,
        team_name,
        parent_email: user.email,
      }
    });

    // Record the pending payment
    await base44.asServiceRole.entities.Payment.create({
      player_id,
      player_name,
      team_name,
      parent_email: user.email,
      amount,
      description,
      stripe_session_id: session.id,
      status: 'pending',
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});