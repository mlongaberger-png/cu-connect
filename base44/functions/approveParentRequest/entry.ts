import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be an admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { request_id, action, player_ids, alternate_email } = await req.json();
    if (!request_id || !action) {
      return Response.json({ error: 'request_id and action are required.' }, { status: 400 });
    }

    const requests = await base44.asServiceRole.entities.AccessRequest.filter({ id: request_id });
    const accessReq = requests[0];
    if (!accessReq) {
      return Response.json({ error: 'Request not found.' }, { status: 404 });
    }

    if (action === 'reject') {
      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'rejected',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      // Notify parent of rejection
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: accessReq.parent_email,
        subject: 'Update on Your Cornerstone United Access Request',
        body: `Hi ${accessReq.parent_name},\n\nUnfortunately, your access request was not approved at this time. Please contact your organization admin for more information.\n\nCornerstone United Athletics`,
      });

      return Response.json({ success: true });
    }

    if (action === 'approve') {
      // Save alternate email on the request record if provided
      if (alternate_email) {
        await base44.asServiceRole.entities.AccessRequest.update(request_id, { alternate_email });
      }

      // Emails to create guardian links for: primary + optional Apple relay
      const emailsToLink = [accessReq.parent_email];
      if (alternate_email && alternate_email !== accessReq.parent_email) {
        emailsToLink.push(alternate_email);
      }

      // Create PlayerGuardian links FIRST — for ALL relevant emails
      // so when they log in (via any email), the role auto-sets via automation
      if (player_ids && player_ids.length > 0) {
        for (const pid of player_ids) {
          const playerList = await base44.asServiceRole.entities.Player.filter({ id: pid });
          const player = playerList[0];
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
            }
          }
        }
      }

      // If user accounts already exist for any of the emails, ensure role = parent
      for (const linkEmail of emailsToLink) {
        try {
          const existingUsers = await base44.asServiceRole.entities.User.filter({ email: linkEmail });
          if (existingUsers.length > 0) {
            await base44.asServiceRole.entities.User.update(existingUsers[0].id, { role: 'user' });
            console.log(`Set role=user for existing user: ${linkEmail}`);
          }
        } catch (roleErr) {
          console.warn(`Could not set parent role for ${linkEmail}:`, roleErr.message);
        }
      }

      // Invite via Base44 as 'user' — autoUpgradeParentRole automation sets parent role on first login
      await base44.users.inviteUser(accessReq.parent_email, 'user');

      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      // Send friendly approval email with clear next steps
      const appleNote = alternate_email
        ? `\nNOTE: If you use "Sign in with Apple" and hide your email, your portal account will use your Apple private relay address (${alternate_email}). That has been linked to your account, so you can sign in either way.\n`
        : '\nIMPORTANT: If you plan to use "Sign in with Apple," please contact your administrator so they can link your Apple private relay email to your account.\n';

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: accessReq.parent_email,
        subject: '🎉 Welcome to Cornerstone United – Your Portal Access Is Ready!',
        body: `Hi ${accessReq.parent_name},

Great news! Your Cornerstone United parent portal access has been approved.

You should receive a separate email shortly with a link to set up your account. Simply click that link, create your password, and you'll be taken straight to the portal.

Once logged in, you can:
• View your child's schedule & events
• Track attendance and RSVPs
• Manage payments & invoices
• Access team documents

IMPORTANT: Make sure to sign in with this email address: ${accessReq.parent_email}
${appleNote}
If you don't receive the account setup email within a few minutes, check your spam folder.

Welcome aboard!
— Cornerstone United Athletics`,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('approveParentRequest error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});