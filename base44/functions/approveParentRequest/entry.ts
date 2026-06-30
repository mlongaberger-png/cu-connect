import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const approveRequestSchema = z.object({
  request_id: z.string().min(1),
  action: z.enum(['approve', 'reject']),
  player_ids: z.array(z.string()).optional(),
  alternate_email: z.string().optional(),
}).strict();

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check (not JWT claim) + audit log ──────
    const authUser = await base44.auth.me();
    const ip = getClientIP(req);

    if (!authUser) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: 'unknown', user_email: 'unknown',
        endpoint: 'approveParentRequest', action: 'approve_parent_request',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRecord = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    if (userRecord.length === 0 || userRecord[0].role !== 'admin') {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: authUser.id, user_email: authUser.email,
        endpoint: 'approveParentRequest', action: 'approve_parent_request',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: authUser.id, user_email: authUser.email,
      endpoint: 'approveParentRequest', action: 'approve_parent_request',
      ip_address: ip, result: 'allowed',
    }).catch(() => {});

    const user = { email: authUser.email, id: authUser.id };

    const rawBody = await req.json();
    const parsed = approveRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { request_id, action, player_ids, alternate_email } = parsed.data;
    if (!request_id || !action) {
      return Response.json({ error: 'request_id and action are required.' }, { status: 400 });
    }

    // Use .get() instead of .filter({id}) — filter by id is not supported
    let accessReq;
    try {
      accessReq = await base44.asServiceRole.entities.AccessRequest.get(request_id);
    } catch (e) {
      console.error('Could not fetch AccessRequest:', e.message);
      return Response.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (!accessReq) {
      return Response.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (action === 'reject') {
      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: accessReq.parent_email,
        subject: 'Update on Your Cornerstone United Access Request',
        body: `Hi ${accessReq.parent_name},\n\nUnfortunately, your access request was not approved at this time. Please contact your organization admin for more information.\n\nCornerstone United Athletics`,
      });

      return Response.json({ success: true, invited: false });
    }

    if (action === 'approve') {
      // Persist relay email onto the request record immediately
      if (alternate_email) {
        await base44.asServiceRole.entities.AccessRequest.update(request_id, { alternate_email });
      }

      const emailsToLink = [accessReq.parent_email];
      if (alternate_email && alternate_email !== accessReq.parent_email) {
        emailsToLink.push(alternate_email);
      }

      // ── STEP 1: Pre-flight existence check — runs BEFORE any writes ──────────
      // Check primary + relay emails directly in User table.
      // Also cross-reference AccessRequest records that may have stored a relay
      // for this user (e.g. previously linked via linkRelayEmail).
      let existingUserId = null;

      for (const emailCandidate of emailsToLink) {
        if (existingUserId) break;
        try {
          const found = await base44.asServiceRole.entities.User.filter({ email: emailCandidate });
          if (found.length > 0) {
            existingUserId = found[0].id;
            if (!found[0].role || found[0].role === 'pending') {
              await base44.asServiceRole.entities.User.update(found[0].id, { role: 'user' });
            }
            console.log(`Pre-flight: existing user found for ${emailCandidate} (id: ${existingUserId})`);
          }
        } catch (e) {
          console.warn(`Pre-flight lookup failed for ${emailCandidate}:`, e.message);
        }
      }

      // Cross-reference: look for any approved AccessRequest whose alternate_email
      // matches the primary email (covers relay-registered accounts that signed up
      // before this request was submitted).
      if (!existingUserId) {
        try {
          const relayMatches = await base44.asServiceRole.entities.AccessRequest.filter({
            alternate_email: accessReq.parent_email,
            status: 'approved',
          });
          if (relayMatches.length > 0) {
            // The primary email was previously stored as a relay — find that user
            const relayOwnerEmail = relayMatches[0].parent_email;
            const found = await base44.asServiceRole.entities.User.filter({ email: relayOwnerEmail });
            if (found.length > 0) {
              existingUserId = found[0].id;
              console.log(`Pre-flight relay cross-ref: found user ${relayOwnerEmail} (id: ${existingUserId}) via alternate_email match`);
            }
          }
        } catch (e) {
          console.warn('Pre-flight relay cross-reference failed:', e.message);
        }
      }

      // ── STEP 2: Branch — link-only vs fresh invite ────────────────────────────
      let userAlreadyExists = !!existingUserId;

      if (!userAlreadyExists) {
        // New user — send invite. Treat any failure as "already exists" to avoid 500s.
        try {
          await base44.users.inviteUser(accessReq.parent_email, 'user');
          console.log(`Invite sent to: ${accessReq.parent_email}`);
        } catch (inviteErr) {
          console.warn(`inviteUser failed (likely duplicate): ${inviteErr.message}`);
          userAlreadyExists = true;
          // Re-fetch in case the account was created between our check and invite
          try {
            const retry = await base44.asServiceRole.entities.User.filter({ email: accessReq.parent_email });
            if (retry.length > 0) existingUserId = retry[0].id;
          } catch (_) {}
        }
      }

      // ── STEP 3: Create / backfill PlayerGuardian links ────────────────────────
      if (player_ids && player_ids.length > 0) {
        for (const pid of player_ids) {
          let player;
          try {
            player = await base44.asServiceRole.entities.Player.get(pid);
          } catch (e) {
            console.warn(`Player ${pid} not found, skipping.`);
            continue;
          }
          if (!player) continue;

          for (const linkEmail of emailsToLink) {
            const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({
              player_id: pid,
              user_email: linkEmail,
            });
            if (existing.length === 0) {
              await base44.asServiceRole.entities.PlayerGuardian.create({
                player_id: pid,
                player_name: `${player.first_name} ${player.last_name}`,
                user_email: linkEmail,
                user_id: existingUserId || undefined,
                relationship: 'Guardian',
                invited_by: user.email,
              });
              console.log(`Guardian link created: ${linkEmail} → ${player.first_name} ${player.last_name}`);
            } else if (existingUserId && !existing[0].user_id) {
              // Backfill user_id onto an existing guardian record that's missing it
              await base44.asServiceRole.entities.PlayerGuardian.update(existing[0].id, { user_id: existingUserId });
              console.log(`Backfilled user_id on existing guardian link ${existing[0].id}`);
            }
          }
        }
      }

      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      const appleNote = alternate_email
        ? `\nNOTE: If you use "Sign in with Apple" and hide your email, your portal account will use your Apple private relay address (${alternate_email}). That has been linked to your account, so you can sign in either way.\n`
        : '\nIMPORTANT: If you plan to use "Sign in with Apple," please contact your administrator so they can link your Apple private relay email to your account.\n';

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: accessReq.parent_email,
        subject: '🎉 Welcome to Cornerstone United – Your Portal Access Is Ready!',
        body: `Hi ${accessReq.parent_name},

Great news! Your Cornerstone United parent portal access has been approved.

${userAlreadyExists
  ? 'Your existing account has been linked to your athlete(s). Simply sign in at the portal with this email address.'
  : "You should receive a separate email shortly with a link to set up your account. Simply click that link, create your password, and you'll be taken straight to the portal."
}

Once logged in, you can:
• View your child's schedule & events
• Track attendance and RSVPs
• Manage payments & invoices
• Access team documents

IMPORTANT: Make sure to sign in with this email address: ${accessReq.parent_email}
${appleNote}
${userAlreadyExists ? '' : "If you don't receive the account setup email within a few minutes, check your spam folder.\n"}
Welcome aboard!
— Cornerstone United Athletics`,
      });

      return Response.json({ success: true, invited: !userAlreadyExists });
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('approveParentRequest error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});