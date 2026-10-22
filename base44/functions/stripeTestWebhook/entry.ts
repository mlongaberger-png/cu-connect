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

// App store links for the confirmation email. Apple's link is filled in once the
// app is live in the App Store; until then the email points iPhone users to the web app.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.base69bae2515552e76ca1fbd6a0.app';
const APPLE_URL = '';
const WEB_URL = 'https://cu-connect.app';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const niceDate = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

function confirmationEmail(reg, invoices, isNewUser) {
  const btn = (href, label) => `<a href="${href}" style="display:inline-block;margin:4px 8px 4px 0;padding:11px 18px;border-radius:8px;background:#14110C;color:#F4EEE2;text-decoration:none;font-weight:bold;">${label}</a>`;
  const rows = invoices
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .map((p) => `<tr><td style="padding:6px 0;">${esc(p.description.replace(/^.*?: /, ''))}</td><td style="padding:6px 0;">${p.status === 'paid' ? 'Paid' : `Due ${niceDate(p.due_date)}`}</td><td style="padding:6px 0;text-align:right;">${usd(p.amount)}</td></tr>`)
    .join('');
  const test = reg.test_mode ? '<p style="background:#FBF1D6;padding:10px 12px;border-radius:6px;"><b>Test registration.</b> No real card was charged.</p>' : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14110C;max-width:560px;margin:0 auto;line-height:1.5;">
  <div style="background:#14110C;color:#D9B44A;padding:18px 22px;border-radius:10px 10px 0 0;font-weight:bold;font-size:18px;">Cornerstone United Lions</div>
  <div style="border:1px solid #E5DCC8;border-top:0;padding:22px;border-radius:0 0 10px 10px;">
    ${test}
    <h2 style="margin:0 0 6px;">${esc(reg.athlete_first_name)} is registered</h2>
    <p style="margin:0 0 16px;">${esc(reg.program_name)} &middot; ${esc(reg.season)}<br>Confirmation code: <b>${esc(reg.confirmation_code)}</b></p>
    <h3 style="margin:18px 0 6px;">Payments</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    ${reg.discount_total > 0 ? `<p style="margin:8px 0 0;font-size:14px;color:#1E5B2C;">Discounts applied: $${Number(reg.discount_total).toFixed(2)}${reg.sibling_discount > 0 ? ' (sibling discount' + (reg.discount_code ? ` + code ${esc(reg.discount_code)})` : ')') : reg.discount_code ? ` (code ${esc(reg.discount_code)})` : ''}</p>` : ''}
    <h3 style="margin:22px 0 6px;">Next: get the CU Connect app</h3>
    <p style="margin:0 0 8px;">Schedules, team messages, invoices and documents all live in CU Connect. ${isNewUser ? 'You will get a separate invitation email; accept it, then sign in' : 'Sign in'} with <b>${esc(reg.parent_email)}</b>.</p>
    <p style="margin:0 0 4px;">${APPLE_URL ? btn(APPLE_URL, 'Download on the App Store') : ''}${btn(PLAY_URL, 'Get it on Google Play')}${btn(WEB_URL, 'Open on the web')}</p>
    <h3 style="margin:22px 0 6px;">Before the first practice</h3>
    <p style="margin:0;">Upload ${esc(reg.athlete_first_name)}'s birth certificate and a current annual sports physical in CU Connect (a new physical is needed every year). Coaches confirm teams after registration closes; you'll be notified when the team is final.</p>
    <h3 style="margin:22px 0 6px;">Plan to help</h3>
    <p style="margin:0;">We're a volunteer-run club. Your team will post volunteer and fundraiser sign-ups in CU Connect, and every family takes a turn.</p>
    <p style="margin:22px 0 0;color:#5B554C;font-size:13px;">Questions? Email <a href="mailto:info@cornerstoneunitedlions.com" style="color:#6B500B;">info@cornerstoneunitedlions.com</a>.</p>
  </div>
</div>`;
}

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

      // Count the discount code use now that the registration is complete.
      const codeId = session.metadata.discount_code_id || reg.discount_code_id;
      if (codeId) {
        try {
          const c = await base44.asServiceRole.entities.DiscountCode.get(codeId);
          await base44.asServiceRole.entities.DiscountCode.update(codeId, { uses_count: Number(c.uses_count || 0) + 1 });
        } catch (e) { console.error('[stripeTestWebhook] code use count failed:', e.message); }
      }

      // Invite the parent to CU Connect if they don't have an account yet.
      let isNewUser = false;
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: reg.parent_email });
        if (!users.length) {
          isNewUser = true;
          const svc = base44.asServiceRole;
          if (svc.users?.inviteUser) await svc.users.inviteUser(reg.parent_email, 'user', '/AcceptInvite');
          else await base44.users.inviteUser(reg.parent_email, 'user', '/AcceptInvite');
        }
      } catch (e) {
        console.error('[stripeTestWebhook] invite failed (registration still recorded):', e.message);
      }
      // Confirmation email with the payment schedule and app links.
      try {
        const ids = String(reg.payment_ids || '').split(',').filter(Boolean);
        const invoices = (await Promise.all(ids.map((id) => base44.asServiceRole.entities.Payment.get(id).catch(() => null)))).filter(Boolean);
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: reg.parent_email,
          subject: `${reg.test_mode ? '[TEST] ' : ''}You're registered: ${reg.program_name} (${reg.confirmation_code})`,
          body: confirmationEmail(reg, invoices, isNewUser),
        });
      } catch (e) {
        console.error('[stripeTestWebhook] confirmation email failed:', e.message);
      }
      console.log(`[stripeTestWebhook] ${reg.confirmation_code} paid; invoices ${invoiceIds.join(',')}`);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripeTestWebhook]', error.message);
    return Response.json({ error: error.message }, { status: 400 });
  }
});
