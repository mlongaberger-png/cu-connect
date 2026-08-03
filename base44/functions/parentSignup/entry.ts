import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { z } from 'npm:zod@3.24.2';

const parentSignupSchema = z.object({
  parent_name: z.string().min(1),
  parent_email: z.string().email(),
  parent_phone: z.string().optional(),
  child_names: z.string().min(1),
  sport_interest: z.string().optional(),
  notes: z.string().optional(),
  recaptcha_token: z.string().optional(),
}).strict();

// ── Rate limiting ──────────────────────────────────────────────────
// Baseline bot protection for this public, unauthenticated form. Not a
// hard security boundary (x-forwarded-for is attacker-controllable and
// email is self-reported), but it raises the cost of naive spam/bot
// submissions. Backed by the SubmissionAttempt entity.
const IP_LIMIT = 5;          // max attempts per IP per hour
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;       // max attempts per email per day
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

// -- reCAPTCHA v3 verification ---------------------------------------
// Second layer of bot protection, layered on top of (not replacing) the
// rate limiting above. The client obtains a token via
// grecaptcha.execute() and we verify it server-side with Google,
// checking both `success` and the 0.0 (bot) - 1.0 (human) `score`.
// The secret key is stored in the AppConfig entity (key:
// 'recaptcha_secret_key'), following the same pattern already used for
// fcm_service_account -- server-only secrets live in AppConfig, never
// hardcoded in source.
const RECAPTCHA_SCORE_THRESHOLD = 0.5; // 0.0 (bot) - 1.0 (human); adjust here if false-positive/negative rate changes
const RECAPTCHA_EXPECTED_ACTION = 'parent_signup';

let cachedRecaptchaSecret = null;

async function getRecaptchaSecret(base44) {
  if (cachedRecaptchaSecret) return cachedRecaptchaSecret;
  const configs = await base44.asServiceRole.entities.AppConfig.filter({ key: 'recaptcha_secret_key' });
  if (!configs.length) return null;
  cachedRecaptchaSecret = configs[0].value;
  return cachedRecaptchaSecret;
}

async function verifyRecaptcha(base44, { token, ip }) {
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }

  const secret = await getRecaptchaSecret(base44);
  if (!secret) {
    // Not configured -- fail open on this layer so a missing/rotated
    // secret doesn't take down the form; rate limiting (already checked)
    // remains the operative protection in that case.
    console.error('recaptcha_secret_key not configured in AppConfig, skipping reCAPTCHA check');
    return { ok: true, skipped: true };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') params.set('remoteip', ip);

    const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const result = await verifyRes.json();

    if (!result.success) {
      return { ok: false, reason: 'verification_failed' };
    }
    if (result.action && result.action !== RECAPTCHA_EXPECTED_ACTION) {
      return { ok: false, reason: 'action_mismatch' };
    }
    if (typeof result.score === 'number' && result.score < RECAPTCHA_SCORE_THRESHOLD) {
      return { ok: false, reason: 'low_score' };
    }
    return { ok: true };
  } catch (e) {
    // Network/Google-side failure -- fail open so a Google outage doesn't
    // take the signup form down; rate limiting still applies.
    console.error('reCAPTCHA verification request failed:', e.message);
    return { ok: true, skipped: true };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const rawBody = await req.json();
    const parsed = parentSignupSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { parent_name, parent_email, parent_phone, child_names, sport_interest, notes } = parsed.data;

    if (!parent_name || !parent_email || !child_names) {
      return Response.json({ error: 'Name, email, and child name(s) are required.' }, { status: 400 });
    }

    const clientIP = getClientIP(req);
    const normalizedEmail = parent_email.trim().toLowerCase();

    const rate = await checkRateLimit(base44, { ip: clientIP, email: normalizedEmail, formType: 'parent_signup' });
    if (rate.limited) {
      await recordAttempt(base44, { ip: clientIP, email: normalizedEmail, formType: 'parent_signup', blocked: true });
      return Response.json({ error: 'Too many attempts, please try again later.' }, { status: 429 });
    }
    await recordAttempt(base44, { ip: clientIP, email: normalizedEmail, formType: 'parent_signup', blocked: false });

    // Check for duplicate pending/approved request
    const existing = await base44.asServiceRole.entities.AccessRequest.filter({ parent_email });
    const active = existing.find(r => r.status === 'pending' || r.status === 'approved');
    if (active) {
      return Response.json({ error: 'An account request for this email already exists.' }, { status: 409 });
    }

    // Create access request record
    await base44.asServiceRole.entities.AccessRequest.create({
      parent_name,
      parent_email,
      parent_phone: parent_phone || '',
      child_names,
      sport_interest: sport_interest || '',
      notes: notes || '',
      status: 'pending',
    });

    // Notify admins via email
    const reviewUrl = 'https://cu-connect.base44.app/AthleticDirectors?tab=people&sub=access';
    const athleteLines = child_names
      .split(',')
      .map(n => `<tr><td style="padding:4px 0;color:#e8e0d0;font-size:15px;">• ${n.trim()}</td></tr>`)
      .join('');

    const emailBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:24px;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;">CU Connect</span>
          </td>
        </tr>

        <!-- Status badge -->
        <tr>
          <td style="padding-bottom:8px;">
            <span style="display:inline-block;background-color:#c9a84c22;border:1px solid #c9a84c55;color:#c9a84c;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;">Pending Approval</span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding-bottom:28px;">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#f5f0e8;line-height:1.2;">New Parent Signup Request</h1>
          </td>
        </tr>

        <!-- Parent Information -->
        <tr>
          <td style="padding-bottom:20px;background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;">Parent Information</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Name</span>
                  <span style="font-size:15px;color:#f5f0e8;font-weight:600;">${parent_name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Email</span>
                  <span style="font-size:15px;color:#c9a84c;">${parent_email}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Phone</span>
                  <span style="font-size:15px;color:#f5f0e8;">${parent_phone || 'Not provided'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:12px;"></td></tr>

        <!-- Athletes -->
        <tr>
          <td style="background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;">Athletes</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${athleteLines}
            </table>
          </td>
        </tr>

        <tr><td style="height:12px;"></td></tr>

        <!-- Sport & Notes -->
        <tr>
          <td style="background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:14px;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;display:block;margin-bottom:6px;">Sport Interest</span>
                  <span style="font-size:15px;color:#e8e0d0;">${sport_interest || 'Not specified'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:14px;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;display:block;margin-bottom:6px;">Notes</span>
                  <span style="font-size:15px;color:#e8e0d0;">${notes || 'None'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:28px;"></td></tr>

        <!-- CTA Button -->
        <tr>
          <td align="center">
            <a href="${reviewUrl}" style="display:block;background-color:#c9a84c;color:#111111;font-size:16px;font-weight:800;text-decoration:none;text-align:center;padding:16px 32px;border-radius:10px;letter-spacing:0.3px;">Review Request →</a>
          </td>
        </tr>

        <tr><td style="height:36px;"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #2a2a2a;padding-top:20px;">
            <p style="margin:0 0 6px;font-size:12px;color:#555;text-align:center;">You are receiving this email because you are an administrator of CU Connect.</p>
            <p style="margin:0;font-size:12px;color:#444;text-align:center;">
              <a href="${reviewUrl}" style="color:#c9a84c;text-decoration:none;">Manage Preferences</a>
              &nbsp;·&nbsp;
              <a href="${reviewUrl}" style="color:#c9a84c;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `New Parent Signup Request – ${parent_name}`,
        body: emailBody,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('parentSignup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});