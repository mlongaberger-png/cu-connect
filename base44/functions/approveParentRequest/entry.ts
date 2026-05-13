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

      // Check if user already exists — skip inviteUser if so (prevents 500 on duplicate invite)
      let userAlreadyExists = false;
      for (const linkEmail of emailsToLink) {
        try {
          const existingUsers = await base44.asServiceRole.entities.User.filter({ email: linkEmail });
          if (existingUsers.length > 0) {
            userAlreadyExists = true;
            await base44.asServiceRole.entities.User.update(existingUsers[0].id, { role: 'user' });
            console.log(`Existing user found for ${linkEmail} — skipping invite, updated role.`);
          }
        } catch (roleErr) {
          console.warn(`Could not update role for ${linkEmail}:`, roleErr.message);
        }
      }

      // Only invite if no existing account was found
      if (!userAlreadyExists) {
        try {
          await base44.users.inviteUser(accessReq.parent_email, 'user');
          console.log(`Invite sent to new user: ${accessReq.parent_email}`);
        } catch (inviteErr) {
          // If invite fails because user already exists, treat as existing user
          console.warn(`inviteUser failed (user may already exist): ${inviteErr.message}`);
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