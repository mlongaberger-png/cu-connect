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
    // action: 'approve' | 'reject'

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
      return Response.json({ success: true });
    }

    if (action === 'approve') {
      // Invite the user to the workspace as role=parent
      await base44.users.inviteUser(accessReq.parent_email, 'parent');

      // Link to players if provided
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

      await base44.asServiceRole.entities.AccessRequest.update(request_id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });

      // Notify the parent
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: accessReq.parent_email,
        subject: 'Your Parent Portal Access Has Been Approved',
        body: `
Hi ${accessReq.parent_name},

Your request to access the Cornerstone United parent portal has been approved!

You can now log in at the portal using your email address: ${accessReq.parent_email}

If you haven't set up your password yet, use the "Forgot Password" option on the login page.

Welcome aboard!
        `.trim(),
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    console.error('approveParentRequest error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});