import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

// submitRegistrationApplication
//
// Backs the /Register page (athlete/team application form). The page itself
// requires a logged-in user before it will even render the form (see
// Register.jsx), so this is not an anonymous endpoint — but it's still a
// prime target for scripted/bot abuse (throwaway accounts spamming coaches
// with fake applications), so it gets the same baseline rate limiting as
// the truly-public parentSignup form.
//
// Submissions are written server-side (asServiceRole) with parent_user_id
// taken from the authenticated session — never trusted from the client —
// so this also closes the "any caller can post as another user" gap that
// existed when the frontend wrote to RegistrationApplication directly via
// the client SDK.

const athleteSchema = z.object({
  team_id: z.string().min(1),
  athlete_first_name: z.string().min(1),
  athlete_last_name: z.string().min(1),
  athlete_dob: z.string().optional(),
}).strict();

const requestSchema = z.object({
  parent_name: z.string().min(1),
  parent_email: z.string().email(),
  parent_phone: z.string().optional(),
  athletes: z.array(athleteSchema).min(1).max(10),
  referral_source: z.string().optional(),
  referral_note: z.string().optional(),
}).strict();

// ── Rate limiting ──────────────────────────────────────────────────
// Baseline bot protection, backed by the SubmissionAttempt entity (shared
// with parentSignup). Thresholds are per-submission-call, not per-athlete,
// so a legitimate parent registering several siblings in one visit (the
// "Add Another Athlete" flow on the form) only counts once here.
const IP_LIMIT = 5;          // max submissions per IP per hour
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;       // max submissions per email per day
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

async function checkRateLimit(base44, { ip, email, formType }) {
  const now = Date.now();

  const ipAttempts = await base44.asServiceRole.entities.SubmissionAttempt.filter({ ip_address: ip, form_type: formType });
  const ipRecent = ipAttempts.filter(a => now - new Date(a.created_date).getTime() < IP_WINDOW_MS);
  if (ipRecent.length >= IP_LIMIT) {
    return { limited: true, reason: 'ip' };
  }

  if (email) {
    const emailAttempts = await base44.asServiceRole.entities.SubmissionAttempt.filter({ email, form_type: formType });
    const emailRecent = emailAttempts.filter(a => now - new Date(a.created_date).getTime() < EMAIL_WINDOW_MS);
    if (emailRecent.length >= EMAIL_LIMIT) {
      return { limited: true, reason: 'email' };
    }
  }

  return { limited: false };
}

async function recordAttempt(base44, { ip, email, formType, blocked }) {
  try {
    await base44.asServiceRole.entities.SubmissionAttempt.create({
      ip_address: ip,
      email: email || undefined,
      form_type: formType,
      blocked: !!blocked,
    });
  } catch (e) {
    // Never let tracking failures block/break the real submission flow.
    console.error('SubmissionAttempt logging failed:', e.message);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Register.jsx already gates the form behind login, but enforce it
    // server-side too — nothing about this endpoint should be reachable
    // by an unauthenticated caller.
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'You must be logged in to submit an application.' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = requestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { parent_name, parent_email, parent_phone, athletes, referral_source, referral_note } = parsed.data;

    const clientIP = getClientIP(req);
    const normalizedEmail = parent_email.trim().toLowerCase();

    const rate = await checkRateLimit(base44, { ip: clientIP, email: normalizedEmail, formType: 'registration_application' });
    if (rate.limited) {
      await recordAttempt(base44, { ip: clientIP, email: normalizedEmail, formType: 'registration_application', blocked: true });
      return Response.json({ error: 'Too many attempts, please try again later.' }, { status: 429 });
    }
    await recordAttempt(base44, { ip: clientIP, email: normalizedEmail, formType: 'registration_application', blocked: false });

    // Look up teams server-side rather than trusting client-supplied
    // team_name/sport_name text.
    const teamIds = [...new Set(athletes.map(a => a.team_id))];
    const teams = await base44.asServiceRole.entities.Team.filter({});
    const teamById = new Map(teams.filter(t => teamIds.includes(t.id)).map(t => [t.id, t]));

    for (const a of athletes) {
      if (!teamById.has(a.team_id)) {
        return Response.json({ error: 'One or more selected teams could not be found.' }, { status: 400 });
      }
    }

    const siblingGroupId = athletes.length > 1
      ? `sib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : undefined;

    const appliedAt = new Date().toISOString();
    const created = [];
    for (const a of athletes) {
      const team = teamById.get(a.team_id);
      const record = await base44.asServiceRole.entities.RegistrationApplication.create({
        parent_user_id: user.id,
        parent_name,
        parent_email,
        parent_phone: parent_phone?.trim() || undefined,
        athlete_first_name: a.athlete_first_name,
        athlete_last_name: a.athlete_last_name,
        athlete_dob: a.athlete_dob,
        target_team_id: a.team_id,
        target_team_name: team?.name || '',
        sport_name: team?.sport_name || '',
        status: 'pending',
        applied_at: appliedAt,
        referral_source: referral_source || undefined,
        referral_note: referral_note?.trim() || undefined,
        sibling_group_id: siblingGroupId,
      });
      created.push(record.id);
    }

    return Response.json({ success: true, count: created.length, ids: created });
  } catch (error) {
    console.error('submitRegistrationApplication error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
