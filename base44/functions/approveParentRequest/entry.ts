import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be an admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { request_id, action, player_ids } = await req.json();
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
      // Create PlayerGuardian links FIRST — so when they log in, the role auto-sets via automation
      if (player_ids && player_ids.length > 0) {
        for (const pid of player_ids) {
          const playerList = await base44.asServiceRole.entities.Player.filter({ id: pid });
          const player = playerList[0];
          if (!player) continue;

          const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({
            player_id: pid,
            user_email: accessReq.parent_email,
          });
          if (existing.length === 0) {
            await base44.asServiceRole.entities.PlayerGuardian.create({
              player_id: pid,
              player_name: `${player.first_name} ${player.last_name}`,
              user_email: accessReq.parent_email,
              relationship: 'Guardian',
              invited_by: user.email,
            });
          }
        }
      }

      // Invite via Base44 (sends magic-link email for account setup)
      await base44.users.inviteUser(accessReq.parent_email, 'user');

      // If user account already exists, pre-set role to parent
      try {
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email: accessReq.parent_email });
        if (existingUsers.length > 0) {
          await base44.asServiceRole.entities.User.update(existingUsers[0].id, { role: 'parent' });
        }
      } catch (roleErr) {
        console.warn('Could not pre-set parent role:', roleErr.message);
      }

      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      // Send friendly approval email with clear next steps (no "forgot password" confusion)
      const appUrl = 'https://app.base44.com/app/69bae2515552e76ca1fbd6a0/Portal';
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