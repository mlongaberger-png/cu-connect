import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.21.0';
import { z } from 'npm:zod@3.24.2';

// websiteRegister
//
// Public endpoint behind the Cornerstone United website's registration form.
// No login (families may not have a CU Connect account yet), so:
//   * prices, fee parts, due dates and test/live mode come from the Program
//     record server-side; the browser never sends an amount;
//   * rate limited per IP and per email (SubmissionAttempt, same as parentSignup);
//   * the ProgramRegistration and Payment (invoice) records are written here
//     with the service role, never by the client.
//
// Flow: validate -> create ProgramRegistration -> create 1 or 3 Payment
// invoices (amounts in cents, like the rest of CU Connect) -> Stripe Checkout
// for what's due today -> return checkout_url. stripeTestWebhook (test mode)
// marks the invoice paid and invites the parent when Stripe confirms.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (body, status = 200) => Response.json(body, { status, headers: CORS });

// Where Stripe may send families back to after checkout.
const ALLOWED_RETURN = [
  /^https:\/\/([a-z0-9-]+\.)*base44\.app$/,
  /^https:\/\/(www\.)?cornerstoneunitedlions\.com$/,
  /^https:\/\/(www\.)?cu-connect\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

const opt = z.string().max(500).optional();
const schema = z.object({
  program_id: z.string().min(1),
  athlete_first_name: z.string().min(1).max(60),
  athlete_last_name: z.string().min(1).max(60),
  athlete_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  athlete_gender: opt,
  parent_first_name: z.string().min(1).max(60),
  parent_last_name: z.string().min(1).max(60),
  parent_email: z.string().email().max(200),
  parent_phone: z.string().min(7).max(30),
  address: z.string().min(3).max(300),
  second_contact: opt,
  emergency_contact: z.string().min(3).max(300),
  school_type: z.enum(['homeschool', 'epic_charter', 'private_school', 'other']),
  school_name: opt,
  experience_years: z.number().int().min(0).max(20).optional(),
  positions: opt,
  jersey_size: z.string().min(1).max(20),
  pants_size: opt,
  jersey_number_request: z.string().max(10).optional(),
  medical_notes: z.string().max(2000).optional(),
  agree_code_of_conduct: z.literal(true),
  agree_statement_of_faith: z.literal(true),
  agree_eligibility: z.literal(true),
  agree_birth_certificate: z.literal(true),
  agree_payment_terms: z.literal(true),
  signature_name: z.string().min(3).max(120),
  payment_plan: z.enum(['full', 'three_payments']),
  donation: z.number().min(0).max(5000).optional(),
  return_origin: z.string().url().optional(),
}).strict();

// ── rate limiting (shared SubmissionAttempt entity) ─────────────────
const FORM = 'website_registration';
const IP_LIMIT = 10, IP_WINDOW = 60 * 60 * 1000;          // 10 per IP per hour
const EMAIL_LIMIT = 8, EMAIL_WINDOW = 24 * 60 * 60 * 1000; // 8 per email per day (siblings)
const ipOf = (req) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

async function limited(base44, ip, email) {
  const now = Date.now();
  const byIp = await base44.asServiceRole.entities.SubmissionAttempt.filter({ ip_address: ip, form_type: FORM });
  if (byIp.filter((a) => now - new Date(a.created_date).getTime() < IP_WINDOW).length >= IP_LIMIT) return true;
  const byEmail = await base44.asServiceRole.entities.SubmissionAttempt.filter({ email, form_type: FORM });
  return byEmail.filter((a) => now - new Date(a.created_date).getTime() < EMAIL_WINDOW).length >= EMAIL_LIMIT;
}
async function record(base44, ip, email, blocked) {
  try { await base44.asServiceRole.entities.SubmissionAttempt.create({ ip_address: ip, email, form_type: FORM, blocked }); } catch { /* never block on tracking */ }
}

function ageOn(dob, cutoff) {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [cy, cm, cd] = cutoff.split('-').map(Number);
  let age = cy - by;
  if (cm < bm || (cm === bm && cd < bd)) age -= 1;
  return age;
}
const cents = (dollars) => Math.round(Number(dollars || 0) * 100);
const code = () => 'CU-' + crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const base44 = createClientFromRequest(req);
  const ip = ipOf(req);
  let parsed;
  try {
    parsed = schema.safeParse(await req.json());
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (!parsed.success) return json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, 400);
  const d = parsed.data;
  const email = d.parent_email.trim().toLowerCase();

  try {
    if (await limited(base44, ip, email)) {
      await record(base44, ip, email, true);
      return json({ error: 'Too many registrations from here. Please wait a while or email info@cornerstoneunitedlions.com.' }, 429);
    }
    await record(base44, ip, email, false);

    // Authoritative program data (prices, dates, mode) from the server.
    const program = await base44.asServiceRole.entities.Program.get(d.program_id).catch(() => null);
    if (!program || program.status !== 'open') return json({ error: 'This program is not open for registration.' }, 400);
    const today = new Date().toISOString().slice(0, 10);
    if (program.registration_closes && today > program.registration_closes && !program.test_mode) {
      return json({ error: 'Registration for this program has closed.' }, 400);
    }

    const fees = {
      registration: cents(program.fee_registration),
      equipment: cents(program.fee_equipment),
      fundraising: cents(program.fee_fundraising),
      uniform: cents(program.fee_uniform),
    };
    const total = fees.registration + fees.equipment + fees.fundraising + fees.uniform;
    const donation = cents(d.donation);
    const plan = d.payment_plan === 'three_payments' && program.plan_enabled ? 'three_payments' : 'full';

    // Siblings in the same season with matching age -> flag for coach review.
    const age = program.age_cutoff_date ? ageOn(d.athlete_dob, program.age_cutoff_date) : null;
    let suggested = null;
    if (age !== null) {
      const season = await base44.asServiceRole.entities.Program.filter({ season: program.season, sport_name: program.sport_name });
      const fits = season.filter((p) => p.age_min != null && p.age_max != null && age >= p.age_min && age <= p.age_max)
        .sort((a, b) => (a.age_max - a.age_min) - (b.age_max - b.age_min) || a.age_max - b.age_max);
      suggested = fits[0] || null;
    }

    const confirmation = code();
    const reg = await base44.asServiceRole.entities.ProgramRegistration.create({
      ...Object.fromEntries(Object.entries(d).filter(([k]) => !['return_origin', 'donation', 'payment_plan'].includes(k))),
      parent_email: email,
      program_name: program.name,
      sport_name: program.sport_name,
      season: program.season,
      league_age: age,
      suggested_program_name: suggested?.name || '',
      age_review_needed: !suggested || suggested.id !== program.id,
      signed_at: new Date().toISOString(),
      payment_plan: plan,
      total: (total + donation) / 100,
      donation: donation / 100,
      test_mode: !!program.test_mode,
      payment_status: 'pending_checkout',
      status: 'submitted',
      confirmation_code: confirmation,
      source_ip: ip,
    });

    // Invoices (Payment records, amounts in cents). Plan: today = registration + uniform,
    // then equipment/facility, then fundraising (fundraising credits can reduce #3).
    const athlete = `${d.athlete_first_name} ${d.athlete_last_name}`;
    // Payment requires sport_id and player_id. The sport comes from the program's
    // sport name; there is no Player yet, so player_id holds a placeholder that
    // points at the registration until the athlete is placed on a team.
    const sports = await base44.asServiceRole.entities.Sport.filter({ name: program.sport_name });
    const sport = sports[0];
    if (!sport) throw new Error(`No Sport named ${program.sport_name}`);
    const base = {
      player_id: `registration:${reg.id}`,
      sport_id: sport.id,
      player_name: athlete,
      team_name: program.name,
      parent_email: email,
      sport_name: program.sport_name,
      season_name: program.season,
      status: 'pending',
      created_by_email: 'website@cornerstoneunitedlions.com',
      created_by_name: 'Website registration',
      notes: `Website registration ${confirmation}${program.test_mode ? ' (TEST MODE)' : ''}`,
    };
    const li = (name, amt) => ({ name, quantity: 1, unit_amount: amt });
    const installments = plan === 'full'
      ? [{ description: `${program.name}: paid in full`, fee_type: 'registration', due_date: today,
          items: [li('Registration fee', fees.registration), li('Equipment / facility fee', fees.equipment), li('Required fundraising', fees.fundraising), li('Uniform fee', fees.uniform)] }]
      : [
          { description: `${program.name}: payment 1 of 3 (registration + uniform)`, fee_type: 'registration', due_date: today,
            items: [li('Registration fee', fees.registration), li('Uniform fee', fees.uniform)] },
          { description: `${program.name}: payment 2 of 3 (equipment / facility)`, fee_type: 'other', due_date: program.plan_due_2 || today,
            items: [li('Equipment / facility fee', fees.equipment)] },
          { description: `${program.name}: payment 3 of 3 (required fundraising)`, fee_type: 'fundraising', due_date: program.plan_due_3 || today,
            items: [li('Required fundraising', fees.fundraising)] },
        ];
    if (donation > 0) installments[0].items.push(li('Donation', donation));

    const payments = [];
    for (const inst of installments) {
      const items = inst.items.filter((x) => x.unit_amount > 0);
      const amount = items.reduce((s, x) => s + x.unit_amount, 0);
      if (amount <= 0) continue;
      payments.push(await base44.asServiceRole.entities.Payment.create({
        ...base, description: inst.description, fee_type: inst.fee_type, due_date: inst.due_date,
        amount, line_items: JSON.stringify(items),
      }));
    }
    const first = payments[0];
    const dueToday = first ? first.amount : 0;
    await base44.asServiceRole.entities.ProgramRegistration.update(reg.id, {
      payment_ids: payments.map((p) => p.id).join(','),
      amount_due_today: dueToday / 100,
    });

    if (!first) return json({ ok: true, free: true, confirmation_code: confirmation, registration_id: reg.id });

    // Stripe Checkout for today's payment. Test programs always use test keys.
    const key = program.test_mode ? Deno.env.get('STRIPE_TEST_SECRET_KEY') : Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return json({ error: 'Payments are not set up yet. Your registration was saved; we will contact you.', confirmation_code: confirmation }, 503);
    const stripe = new Stripe(key);

    const origin = d.return_origin && ALLOWED_RETURN.some((re) => re.test(new URL(d.return_origin).origin))
      ? new URL(d.return_origin).origin
      : 'https://cu-connect.app';
    const firstItems = JSON.parse(first.line_items);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: firstItems.map((x) => ({
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: x.unit_amount, product_data: { name: `${x.name} (${program.name})` } },
      })),
      // Save the card so later plan payments can be charged without re-entering it.
      payment_intent_data: plan === 'three_payments'
        ? { setup_future_usage: 'off_session', description: `${program.name} ${confirmation}` }
        : { description: `${program.name} ${confirmation}` },
      customer_creation: 'always',
      success_url: `${origin}/register/done?code=${confirmation}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/register/${d.program_id}?cancelled=1`,
      metadata: {
        type: 'program_registration',
        registration_id: reg.id,
        invoice_ids: first.id,
        confirmation_code: confirmation,
        test_mode: program.test_mode ? 'true' : 'false',
      },
    });
    await Promise.all([
      base44.asServiceRole.entities.ProgramRegistration.update(reg.id, { stripe_session_id: session.id }),
      base44.asServiceRole.entities.Payment.update(first.id, { stripe_session_id: session.id }),
    ]);

    console.log(`[websiteRegister] ${confirmation} ${program.name} plan=${plan} today=${dueToday} test=${!!program.test_mode}`);
    return json({ ok: true, checkout_url: session.url, confirmation_code: confirmation });
  } catch (error) {
    console.error('[websiteRegister]', error.message);
    return json({ error: 'Something went wrong. Please try again or email info@cornerstoneunitedlions.com.' }, 500);
  }
});
