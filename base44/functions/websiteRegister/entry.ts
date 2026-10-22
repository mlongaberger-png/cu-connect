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
//
// Discounts (all computed here, never trusted from the browser):
//   * sibling discount: Program.sibling_discount_pct (default 5%) off the fees
//     when the same parent email + phone already has a paid registration this
//     season;
//   * discount codes (DiscountCode entity): percent or dollars off; 100% = no
//     payment. Uses are counted when the registration completes.
// Discounts are spread across the installments in proportion to their size and
// recorded on each invoice (discount_amount / discount_note) for the Treasurer.
// A { action: 'quote' } request returns the price breakdown for the review step.

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
  agree_volunteer: z.literal(true).optional(),
  agree_payment_terms: z.literal(true),
  signature_name: z.string().min(3).max(120),
  payment_plan: z.enum(['full', 'three_payments']),
  donation: z.number().min(0).max(5000).optional(),
  discount_code: z.string().trim().max(40).optional(),
  return_origin: z.string().url().optional(),
}).strict();

const quoteSchema = z.object({
  action: z.literal('quote'),
  program_id: z.string().min(1),
  payment_plan: z.enum(['full', 'three_payments']),
  donation: z.number().min(0).max(5000).optional(),
  discount_code: z.string().trim().max(40).optional(),
  parent_email: z.string().max(200).optional(),
  parent_phone: z.string().max(30).optional(),
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


// ── pricing ──────────────────────────────────────────────────────────
const SIBLING_DEFAULT_PCT = 5;
const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
const normCode = (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, '');

// Returns { code } or { error } for a typed discount code.
async function findCode(base44, raw, program, today) {
  const typed = normCode(raw);
  if (!typed) return {};
  const rows = await base44.asServiceRole.entities.DiscountCode.filter({ code: typed });
  const c = rows.find((r) => r.is_active !== false);
  const bad = { error: "That discount code isn't valid." };
  if (!c) return bad;
  if (c.starts_on && today < c.starts_on) return bad;
  if (c.expires_on && today > c.expires_on) return { error: 'That discount code has expired.' };
  if (c.max_uses && Number(c.uses_count || 0) >= Number(c.max_uses)) return { error: 'That discount code has been used up.' };
  const ids = String(c.program_ids || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (ids.length && !ids.includes(program.id)) return { error: "That discount code doesn't apply to this program." };
  if (c.sport_name && c.sport_name !== program.sport_name) return { error: "That discount code doesn't apply to this program." };
  return { code: c };
}

// Same family (email + phone) already registered and paid for another athlete this season?
async function hasSibling(base44, program, email, phone) {
  if (!email || digits(phone).length < 7) return false;
  const regs = await base44.asServiceRole.entities.ProgramRegistration.filter({ parent_email: email, season: program.season });
  return regs.some((r) => r.status !== 'withdrawn'
    && ['deposit_paid', 'paid_in_full'].includes(r.payment_status)
    && digits(r.parent_phone) === digits(phone));
}

// Full price breakdown, all amounts in cents.
async function priceOf(base44, program, { plan, donation, discountCode, email, phone, today }) {
  const fees = {
    registration: cents(program.fee_registration),
    equipment: cents(program.fee_equipment),
    fundraising: cents(program.fee_fundraising),
    uniform: cents(program.fee_uniform),
  };
  const gross = fees.registration + fees.equipment + fees.fundraising + fees.uniform;

  const sibPct = program.sibling_discount_pct ?? SIBLING_DEFAULT_PCT;
  const sibling = sibPct > 0 && await hasSibling(base44, program, email, phone) ? Math.round(gross * sibPct / 100) : 0;

  const found = await findCode(base44, discountCode, program, today);
  let codeAmt = 0;
  if (found.code) {
    const c = found.code;
    codeAmt = c.discount_type === 'amount' ? cents(c.value) : Math.round(gross * Math.min(100, Number(c.value || 0)) / 100);
  }
  const discount = Math.min(gross, sibling + codeAmt);
  const notes = [];
  if (sibling) notes.push(`Sibling discount ${sibPct}%`);
  if (codeAmt) notes.push(`Code ${found.code.code}${found.code.discount_type === 'percent' ? ` (${found.code.value}% off)` : ''}`);

  // Nothing left to pay (and no donation): one $0 invoice, no checkout.
  const free = gross - discount <= 0 && donation <= 0;
  const usePlan = free ? 'full' : plan;
  const li = (name, amt) => ({ name, quantity: 1, unit_amount: amt });
  const today_ = today;
  const insts = usePlan === 'full'
    ? [{ description: `${program.name}: ${free ? 'no payment due' : 'paid in full'}`, fee_type: 'registration', due_date: today_,
        items: [li('Registration fee', fees.registration), li('Equipment / facility fee', fees.equipment), li('Required fundraising', fees.fundraising), li('Uniform fee', fees.uniform)] }]
    : [
        { description: `${program.name}: payment 1 of 3 (registration + uniform)`, fee_type: 'registration', due_date: today_,
          items: [li('Registration fee', fees.registration), li('Uniform fee', fees.uniform)] },
        { description: `${program.name}: payment 2 of 3 (equipment / facility)`, fee_type: 'other', due_date: program.plan_due_2 || today_,
          items: [li('Equipment / facility fee', fees.equipment)] },
        { description: `${program.name}: payment 3 of 3 (required fundraising)`, fee_type: 'fundraising', due_date: program.plan_due_3 || today_,
          items: [li('Required fundraising', fees.fundraising)] },
      ];
  // Percent discounts (sibling, % codes) are spread across installments in
  // proportion to their fees; a dollars-off code comes off the earliest payment(s).
  const fixedAmt = found.code && found.code.discount_type === 'amount' ? Math.min(codeAmt, gross) : 0;
  const pctAmt = discount - fixedAmt;
  insts.forEach((inst) => {
    inst.items = inst.items.filter((x) => x.unit_amount > 0);
    inst.fees = inst.items.reduce((s, x) => s + x.unit_amount, 0);
  });
  const withFees = insts.filter((x) => x.fees > 0);
  let left = pctAmt;
  withFees.forEach((inst, i) => {
    const share = i === withFees.length - 1 ? left : Math.min(left, Math.round(pctAmt * inst.fees / (gross || 1)));
    inst.discount = Math.min(share, inst.fees);
    left -= inst.discount;
  });
  let fixedLeft = fixedAmt;
  for (const inst of withFees) {
    const take = Math.min(fixedLeft, inst.fees - inst.discount);
    inst.discount += take;
    fixedLeft -= take;
  }
  if (donation > 0 && insts[0]) { insts[0].items.push(li('Donation', donation)); }
  for (const inst of insts) {
    inst.discount = inst.discount || 0;
    inst.gross = inst.items.reduce((s, x) => s + x.unit_amount, 0);
    inst.net = inst.gross - inst.discount;
  }
  const kept = insts.filter((x) => x.gross > 0 || free);
  return {
    fees, gross, sibling, sibling_pct: sibling ? sibPct : 0, code: found.code || null, code_amount: codeAmt,
    code_error: found.error || null, discount, donation, free, plan: usePlan,
    note: notes.join(' + '), installments: kept,
    total: gross - discount + donation, due_today: kept[0] ? kept[0].net : 0,
  };
}

const dollars = (c) => Math.round(c) / 100;


// ── confirmation email for registrations with nothing to pay ─────────
// (Paid registrations get theirs from the Stripe webhook; keep the two in sync.)
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.base69bae2515552e76ca1fbd6a0.app';
const APPLE_URL = '';
const WEB_URL = 'https://cu-connect.app';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

function freeEmail(reg, isNewUser) {
  const btn = (href, label) => `<a href="${href}" style="display:inline-block;margin:4px 8px 4px 0;padding:11px 18px;border-radius:8px;background:#14110C;color:#F4EEE2;text-decoration:none;font-weight:bold;">${label}</a>`;
  const test = reg.test_mode ? '<p style="background:#FBF1D6;padding:10px 12px;border-radius:6px;"><b>Test registration.</b></p>' : '';
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14110C;max-width:560px;margin:0 auto;line-height:1.5;">
  <div style="background:#14110C;color:#D9B44A;padding:18px 22px;border-radius:10px 10px 0 0;font-weight:bold;font-size:18px;">Cornerstone United Lions</div>
  <div style="border:1px solid #E5DCC8;border-top:0;padding:22px;border-radius:0 0 10px 10px;">
    ${test}
    <h2 style="margin:0 0 6px;">${esc(reg.athlete_first_name)} is registered</h2>
    <p style="margin:0 0 16px;">${esc(reg.program_name)} &middot; ${esc(reg.season)}<br>Confirmation code: <b>${esc(reg.confirmation_code)}</b></p>
    ${reg.total > 0
      ? `<p style="margin:0 0 16px;"><b>Nothing is due today.</b> Discounts of ${usd(reg.discount_total * 100)} were applied${reg.discount_code ? ` (code ${esc(reg.discount_code)})` : ''}. Your remaining balance of ${usd(reg.total * 100)} will show in CU Connect with its due dates.</p>`
      : `<p style="margin:0 0 16px;"><b>No payment is due.</b> Program fees of ${usd(reg.fees_total * 100)} were covered${reg.discount_code ? ` by code ${esc(reg.discount_code)}` : ''}.</p>`}
    <h3 style="margin:22px 0 6px;">Next: get the CU Connect app</h3>
    <p style="margin:0 0 8px;">Schedules, team messages and documents all live in CU Connect. ${isNewUser ? 'You will get a separate invitation email; accept it, then sign in' : 'Sign in'} with <b>${esc(reg.parent_email)}</b>.</p>
    <p style="margin:0 0 4px;">${APPLE_URL ? btn(APPLE_URL, 'Download on the App Store') : ''}${btn(PLAY_URL, 'Get it on Google Play')}${btn(WEB_URL, 'Open on the web')}</p>
    <h3 style="margin:22px 0 6px;">Before the first practice</h3>
    <p style="margin:0;">Upload ${esc(reg.athlete_first_name)}'s birth certificate and a current annual sports physical in CU Connect (a new physical is needed every year). Coaches confirm teams after registration closes; you'll be notified when the team is final.</p>
    <h3 style="margin:22px 0 6px;">Plan to help</h3>
    <p style="margin:0;">We're a volunteer-run club. Your team will post volunteer and fundraiser sign-ups in CU Connect, and every family takes a turn.</p>
    <p style="margin:22px 0 0;color:#5B554C;font-size:13px;">Questions? Email <a href="mailto:info@cornerstoneunitedlions.com" style="color:#6B500B;">info@cornerstoneunitedlions.com</a>.</p>
  </div>
</div>`;
}

async function countCodeUse(base44, codeId) {
  if (!codeId) return;
  try {
    const c = await base44.asServiceRole.entities.DiscountCode.get(codeId);
    await base44.asServiceRole.entities.DiscountCode.update(codeId, { uses_count: Number(c.uses_count || 0) + 1 });
  } catch (e) { console.error('[websiteRegister] code use count failed:', e.message); }
}

const breakdown = (p) => ({
  fees: dollars(p.gross), sibling_discount: dollars(p.sibling), sibling_pct: p.sibling_pct,
  code: p.code ? p.code.code : null, code_discount: dollars(p.code_amount),
  code_label: p.code ? (p.code.discount_type === 'percent' ? `${p.code.value}% off` : `$${p.code.value} off`) : null,
  code_error: p.code_error, discount: dollars(p.discount), donation: dollars(p.donation),
  total: dollars(p.total), due_today: dollars(p.due_today), free: p.free, plan: p.plan,
  installments: p.installments.map((x) => ({ description: x.description, due_date: x.due_date, amount: dollars(x.net), discount: dollars(x.discount) })),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const base44 = createClientFromRequest(req);
  const ip = ipOf(req);
  let raw;
  try { raw = await req.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const today = new Date().toISOString().slice(0, 10);

  // ── price preview for the review step ──
  if (raw?.action === 'quote') {
    const q = quoteSchema.safeParse(raw);
    if (!q.success) return json({ error: 'Invalid request' }, 400);
    try {
      // Throttle code guessing: 30 code checks per IP per hour.
      if (q.data.discount_code) {
        const tries = await base44.asServiceRole.entities.SubmissionAttempt.filter({ ip_address: ip, form_type: 'discount_check' });
        if (tries.filter((a) => Date.now() - new Date(a.created_date).getTime() < IP_WINDOW).length >= 30) {
          return json({ error: 'Too many tries. Please wait a while and try again.' }, 429);
        }
        try { await base44.asServiceRole.entities.SubmissionAttempt.create({ ip_address: ip, form_type: 'discount_check', blocked: false }); } catch { /* ignore */ }
      }
      const program = await base44.asServiceRole.entities.Program.get(q.data.program_id).catch(() => null);
      if (!program || program.status !== 'open') return json({ error: 'This program is not open for registration.' }, 400);
      const plan = q.data.payment_plan === 'three_payments' && program.plan_enabled ? 'three_payments' : 'full';
      const p = await priceOf(base44, program, {
        plan, donation: cents(q.data.donation), discountCode: q.data.discount_code,
        email: String(q.data.parent_email || '').trim().toLowerCase(), phone: q.data.parent_phone, today,
      });
      return json({ ok: true, quote: breakdown(p) });
    } catch (e) {
      console.error('[websiteRegister quote]', e.message);
      return json({ error: 'Could not check the price right now.' }, 500);
    }
  }

  const parsed = schema.safeParse(raw);
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
    if (program.registration_closes && today > program.registration_closes && !program.test_mode) {
      return json({ error: 'Registration for this program has closed.' }, 400);
    }

    const donation = cents(d.donation);
    const wantPlan = d.payment_plan === 'three_payments' && program.plan_enabled ? 'three_payments' : 'full';
    const price = await priceOf(base44, program, { plan: wantPlan, donation, discountCode: d.discount_code, email, phone: d.parent_phone, today });
    if (price.code_error) return json({ error: price.code_error, field: 'discount_code' }, 400);
    const plan = price.plan;

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
      ...Object.fromEntries(Object.entries(d).filter(([k]) => !['return_origin', 'donation', 'payment_plan', 'discount_code'].includes(k))),
      parent_email: email,
      program_name: program.name,
      sport_name: program.sport_name,
      season: program.season,
      league_age: age,
      suggested_program_name: suggested?.name || '',
      age_review_needed: !suggested || suggested.id !== program.id,
      signed_at: new Date().toISOString(),
      payment_plan: plan,
      fees_total: dollars(price.gross),
      sibling_discount: dollars(price.sibling),
      discount_code: price.code ? price.code.code : undefined,
      discount_code_id: price.code ? price.code.id : undefined,
      discount_total: dollars(price.discount),
      total: dollars(price.total),
      donation: dollars(donation),
      test_mode: !!program.test_mode,
      payment_status: 'pending_checkout',
      status: 'submitted',
      confirmation_code: confirmation,
      source_ip: ip,
    });

    // Invoices (Payment records, amounts in cents). Line items are the full fees;
    // discount_amount / discount_note record what was taken off; amount is what's owed.
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
      created_by_email: 'website@cornerstoneunitedlions.com',
      created_by_name: 'Website registration',
      notes: `Website registration ${confirmation}${program.test_mode ? ' (TEST MODE)' : ''}`,
    };

    const payments = [];
    for (const inst of price.installments) {
      const settled = inst.net <= 0;
      payments.push(await base44.asServiceRole.entities.Payment.create({
        ...base, description: inst.description, fee_type: inst.fee_type, due_date: inst.due_date,
        amount: Math.max(0, inst.net), line_items: JSON.stringify(inst.items),
        discount_amount: inst.discount || 0,
        discount_note: inst.discount ? price.note : undefined,
        status: settled ? 'paid' : 'pending',
        ...(settled ? { paid_amount: 0 } : {}),
      }));
    }
    // Checkout only when something is due today (a big enough discount can cover payment 1).
    const first = payments[0] && payments[0].amount > 0 ? payments[0] : null;
    const dueToday = first ? first.amount : 0;
    await base44.asServiceRole.entities.ProgramRegistration.update(reg.id, {
      payment_ids: payments.map((p) => p.id).join(','),
      amount_due_today: dueToday / 100,
    });

    // Nothing due today: finish now (the Stripe webhook does this for paid ones).
    if (!first) {
      const owed = payments.some((p) => p.amount > 0);
      await base44.asServiceRole.entities.ProgramRegistration.update(reg.id, { payment_status: owed ? 'deposit_paid' : 'paid_in_full' });
      await countCodeUse(base44, price.code?.id);
      let isNewUser = false;
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (!users.length) {
          isNewUser = true;
          const svc = base44.asServiceRole;
          if (svc.users?.inviteUser) await svc.users.inviteUser(email, 'user', '/AcceptInvite');
          else await base44.users.inviteUser(email, 'user', '/AcceptInvite');
        }
      } catch (e) { console.error('[websiteRegister] invite failed:', e.message); }
      try {
        const fresh = await base44.asServiceRole.entities.ProgramRegistration.get(reg.id);
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `${program.test_mode ? '[TEST] ' : ''}You're registered: ${program.name} (${confirmation})`,
          body: freeEmail(fresh, isNewUser),
        });
      } catch (e) { console.error('[websiteRegister] email failed:', e.message); }
      console.log(`[websiteRegister] ${confirmation} ${program.name} nothing due today (${price.note})`);
      return json({ ok: true, free: !owed, nothing_due_today: true, confirmation_code: confirmation, registration_id: reg.id, quote: breakdown(price) });
    }

    // Stripe Checkout for today's payment. Test programs always use test keys.
    const key = program.test_mode ? Deno.env.get('STRIPE_TEST_SECRET_KEY') : Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return json({ error: 'Payments are not set up yet. Your registration was saved; we will contact you.', confirmation_code: confirmation }, 503);
    const stripe = new Stripe(key);

    const origin = d.return_origin && ALLOWED_RETURN.some((re) => re.test(new URL(d.return_origin).origin))
      ? new URL(d.return_origin).origin
      : 'https://cu-connect.app';
    const firstItems = JSON.parse(first.line_items);
    // Show the discount on Stripe's page as a one-time coupon for exactly this invoice.
    let discounts;
    if (first.discount_amount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: first.discount_amount, currency: 'usd', duration: 'once', max_redemptions: 1,
        name: (price.note || 'Discount').slice(0, 40),
      });
      discounts = [{ coupon: coupon.id }];
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: firstItems.map((x) => ({
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: x.unit_amount, product_data: { name: `${x.name} (${program.name})` } },
      })),
      ...(discounts ? { discounts } : {}),
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
        discount_code_id: price.code ? price.code.id : '',
        test_mode: program.test_mode ? 'true' : 'false',
      },
    });
    await Promise.all([
      base44.asServiceRole.entities.ProgramRegistration.update(reg.id, { stripe_session_id: session.id }),
      base44.asServiceRole.entities.Payment.update(first.id, { stripe_session_id: session.id }),
    ]);

    console.log(`[websiteRegister] ${confirmation} ${program.name} plan=${plan} today=${dueToday} discount=${price.discount} test=${!!program.test_mode}`);
    return json({ ok: true, checkout_url: session.url, confirmation_code: confirmation });
  } catch (error) {
    console.error('[websiteRegister]', error.message);
    return json({ error: 'Something went wrong. Please try again or email info@cornerstoneunitedlions.com.' }, 500);
  }
});
