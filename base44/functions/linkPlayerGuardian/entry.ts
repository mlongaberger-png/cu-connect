import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  player_id: z.string().min(1),
  player_name: z.string().trim().min(1).max(200),
  relationship: z.string().trim().max(50).optional().default('Guardian'),
  join_channels: z.boolean().optional().default(false),
}).strict();

// Self-service "link my own account to an existing player" flow, used by:
//  - LinkPlayerByEmail.jsx (parent searches by the email the child was
//    registered under, then confirms linking the matched player(s))
//  - AddChildForm.jsx (parent's typed name/DOB auto-suggests an existing
//    player, they click it to link instead of creating a duplicate)
//
// Both call sites previously called base44.entities.PlayerGuardian.create()
// directly, whose create RLS is:
//   { $or: [ role=admin, role=athletic_director, role=coach, data.user_email == {{user.email}} ] }
// The data.user_email branch is exactly what a self-service parent should
// match (they're creating a link with THEIR OWN email) -- but it never
// evaluates true in practice. Confirmed live with a raw probe POST as a real
// logged-in parent, body.user_email === caller's own email, still 403
// "Permission denied for create operation on PlayerGuardian entity". A
// second probe against ChannelMember (same $or shape, same data.user_email
// branch) 403'd identically, so this isn't a PlayerGuardian-specific
// misconfiguration -- it looks like the data.field branch of an $or create
// rule never fires for self-service parents on this platform, only the
// role-based branches do (which is why the ADMIN-side direct client calls in
// StaffAccountsPanel.jsx/PendingChildrenPanel.jsx are unaffected). Routing
// through asServiceRole sidesteps it entirely, same as every other
// self-service write in this app.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { player_id, player_name, relationship, join_channels } = parsed.data;

    const players = await base44.asServiceRole.entities.Player.filter({ id: player_id });
    const player = players[0];
    if (!player) {
      return Response.json({ error: 'Player not found' }, { status: 404 });
    }

    const existingLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({
      player_id,
      user_email: caller.email,
    });

    if (existingLinks.length === 0) {
      await base44.asServiceRole.entities.PlayerGuardian.create({
        player_id,
        player_name,
        user_email: caller.email,
        relationship,
        invited_by: caller.email,
      });
    }

    let channelsJoined = 0;
    if (join_channels && player.team_id) {
      const teamChannels = await base44.asServiceRole.entities.Channel.filter({ team_id: player.team_id });
      const joinable = teamChannels.filter(c => c.type === 'team' || c.type === 'announcement');
      for (const channel of joinable) {
        const existingMembership = await base44.asServiceRole.entities.ChannelMember.filter({
          channel_id: channel.id,
          user_email: caller.email,
        });
        if (existingMembership.length === 0) {
          await base44.asServiceRole.entities.ChannelMember.create({
            channel_id: channel.id,
            user_email: caller.email,
            user_name: caller.display_name || caller.full_name || '',
            unread_count: 0,
          });
          channelsJoined++;
        }
      }
    }

    console.log(`linkPlayerGuardian: ${caller.email} linked to player ${player_id} (${player_name}), joined ${channelsJoined} channel(s)`);
    return Response.json({ success: true, already_linked: existingLinks.length > 0, channels_joined: channelsJoined });
  } catch (error) {
    console.error('linkPlayerGuardian error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
