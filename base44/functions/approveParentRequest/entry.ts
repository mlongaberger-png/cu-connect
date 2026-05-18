import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { request_id, action, player_ids, alternate_email } = await req.json();
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
      if (alternate_email) {
        await base44.asServiceRole.entities.AccessRequest.update(request_id, { alternate_email });
      }

      const emailsToLink = [accessReq.parent_email];
      if (alternate_email && alternate_email !== accessReq.parent_email) {
        emailsToLink.push(alternate_email);
      }

      // Create PlayerGuardian links for all relevant emails
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
                relationship: 'Guardian',
                invited_by: user.email,
              });
              console.log(`Guardian link created: ${linkEmail} → ${player.first_name} ${player.last_name}`);
            }
          }
        }
      }

      // Pre-flight: check each email (primary + relay) for an existing account.
      // Also check the AccessRequest.alternate_email stored on existing approved requests
      // in case the relay was registered previously via linkRelayEmail.
      let existingUserId = null; // the system id of a matched existing user, if any

      for (const linkEmail of emailsToLink) {
        if (existingUserId) break; // already found one — no need to keep searching
        try {
          const existingUsers = await base44.asServiceRole.entities.User.filter({ email: linkEmail });
          if (existingUsers.length > 0) {
            const existing = existingUsers[0];
            existingUserId = existing.id;
            // Ensure the existing user has at minimum 'user' role
            if (!existing.role || existing.role === 'pending') {
              await base44.asServiceRole.entities.User.update(existing.id, { role: 'user' });
            }
            console.log(`Existing user found for ${linkEmail} (id: ${existing.id}) — skipping invite.`);
          }
        } catch (lookupErr) {
          console.warn(`User lookup failed for ${linkEmail}:`, lookupErr.message);
        }
      }

      // If still no match by email, check relay via existing AccessRequest records that
      // already have an alternate_email resolving to a known user.
      if (!existingUserId && alternate_email) {
        try {
          const relayUsers = await base44.asServiceRole.entities.User.filter({ email: alternate_email });
          if (relayUsers.length > 0) {
            const existing = relayUsers[0];
            existingUserId = existing.id;
            if (!existing.role || existing.role === 'pending') {
              await base44.asServiceRole.entities.User.update(existing.id, { role: 'user' });
            }
            console.log(`Existing user found via relay email ${alternate_email} (id: ${existing.id}) — skipping invite.`);
          }
        } catch (relayLookupErr) {
          console.warn(`Relay user lookup failed for ${alternate_email}:`, relayLookupErr.message);
        }
      }

      // If an existing user was found, backfill their user_id onto all PlayerGuardian links we just created
      if (existingUserId && player_ids && player_ids.length > 0) {
        for (const linkEmail of emailsToLink) {
          try {
            const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: linkEmail });
            for (const link of guardianLinks) {
              if (!link.user_id) {
                await base44.asServiceRole.entities.PlayerGuardian.update(link.id, { user_id: existingUserId });
                console.log(`Backfilled user_id ${existingUserId} on PlayerGuardian ${link.id}`);
              }
            }
          } catch (backfillErr) {
            console.warn(`Guardian backfill failed for ${linkEmail}:`, backfillErr.message);
          }
        }
      }

      // Only invite the primary email if no existing account was found anywhere
      let userAlreadyExists = !!existingUserId;
      if (!userAlreadyExists) {
        try {
          await base44.users.inviteUser(accessReq.parent_email, 'user');
          console.log(`Invite sent to new user: ${accessReq.parent_email}`);
        } catch (inviteErr) {
          // Treat any invite failure as "already exists" to avoid cascading 500s
          console.warn(`inviteUser failed (likely duplicate): ${inviteErr.message}`);
          userAlreadyExists = true;
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