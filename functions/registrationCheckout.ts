import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { registration_id, submission_data, success_url, cancel_url } = await req.json();

    const registrations = await base44.asServiceRole.entities.TeamRegistration.filter({ id: registration_id });
    if (!registrations.length) {
      return Response.json({ error: 'Registration not found' }, { status: 404 });
    }
    const registration = registrations[0];

    // Create the submission record first
    const submission = await base44.asServiceRole.entities.RegistrationSubmission.create({
      ...submission_data,
      registration_id,
      team_id: registration.team_id,
      team_name: registration.team_name,
      sport_name: registration.sport_name,
      fee_paid: registration.fee_amount || 0,
      payment_status: registration.fee_amount > 0 ? 'pending_payment' : 'free',
      status: 'pending'
    });

    if (!registration.fee_amount || registration.fee_amount <= 0) {
      // Free registration — no payment needed
      // Invite parent to the app
      await base44.asServiceRole.functions.invoke('inviteParent', { email: submission_data.parent_email });
      return Response.json({ success: true, submission_id: submission.id, free: true });
    }

    const origin = req.headers.get('origin') || 'https://app.base44.com';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${registration.title}`,
            description: registration.fee_description || `Registration for ${registration.team_name}`
          },
          unit_amount: Math.round(registration.fee_amount * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: success_url || `${origin}/Register?success=1`,
      cancel_url: cancel_url || `${origin}/Register?cancelled=1`,
      customer_email: submission_data.parent_email,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        submission_id: submission.id,
        type: 'registration'
      }
    });

    // Store session id on submission
    await base44.asServiceRole.entities.RegistrationSubmission.update(submission.id, {
      stripe_session_id: session.id
    });

    console.log(`Registration checkout created: ${session.id} for submission ${submission.id}`);
    return Response.json({ checkout_url: session.url, submission_id: submission.id });
  } catch (error) {
    console.error('Registration checkout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});