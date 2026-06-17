import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Secure single-record access gate.
 *
 * Prevents cross-tenant data leakage: validates that the authenticated user
 * has a legitimate relationship to the requested record before returning it.
 *
 * Event  → user must be admin, AD, coach of that team, or parent of a player on that team
 * Message → user must be a ChannelMember of the message's channel (or staff)
 *
 * Usage (frontend):
 *   const res = await base44.functions.invoke('secureGetRecord', { entity: 'Event', id: eventId });
 *   const event = res.data.record; // null if forbidden
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity, id } = await req.json();
    if (!entity || !id) return Response.json({ error: 'entity and id required' }, { status: 400 });

    if (!['Event', 'Message'].includes(entity)) {
      return Response.json({ error: 'Unsupported entity' }, { status: 400 });
    }

    // ── Fetch the record (service role to bypass any read RLS) ──
    const record = await base44.asServiceRole.entities[entity].get(id).catch(() => null);
    if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

    // ── Event: validate team membership ──────────────────────────
    if (entity === 'Event') {
      if (!record.team_id) {
        // Events without a team_id are org-level; staff only
        if (!['admin', 'athletic_director'].includes(user.role)) {
          return Response.json({ error: 'Forbidden — staff-only event' }, { status: 403 });
        }
        return Response.json({ record });
      }

      // Re-fetch role from DB
      const dbUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const role = dbUsers[0]?.role || user.role;

      // Admins/ADs: unrestricted
      if (['admin', 'athletic_director'].includes(role)) {
        return Response.json({ record });
      }

      // Coaches: must have CoachProfile for this team
      if (role === 'coach') {
        const profiles = await base44.asServiceRole.entities.CoachProfile.filter({
          user_id: user.id,
          team_id: record.team_id,
        });
        if (profiles.length > 0) return Response.json({ record });
      }

      // Parents: must have a child on this team
      // Check PlayerGuardian links
      const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({
        user_email: user.email,
      });
      const guardedPlayerIds = guardians.map(g => g.player_id).filter(Boolean);

      if (guardedPlayerIds.length > 0) {
        const matchingPlayers = await base44.asServiceRole.entities.Player.filter({
          id: { $in: guardedPlayerIds },
          team_id: record.team_id,
        });
        if (matchingPlayers.length > 0) return Response.json({ record });
      }

      // Also check direct parent_email match
      const directPlayers = await base44.asServiceRole.entities.Player.filter({
        parent_email: user.email,
        team_id: record.team_id,
      });
      if (directPlayers.length > 0) return Response.json({ record });

      return Response.json({ error: 'Forbidden — not authorized for this event' }, { status: 403 });
    }

    // ── Message: validate channel membership ──────────────────────
    if (entity === 'Message') {
      if (!record.channel_id) {
        return Response.json({ error: 'Forbidden — message has no channel' }, { status: 403 });
      }

      const dbUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const role = dbUsers[0]?.role || user.role;

      // Admins/ADs: unrestricted
      if (['admin', 'athletic_director'].includes(role)) {
        return Response.json({ record });
      }

      // Check ChannelMember
      const memberships = await base44.asServiceRole.entities.ChannelMember.filter({
        channel_id: record.channel_id,
        user_email: user.email,
      });

      if (memberships.length > 0) return Response.json({ record });

      // Coaches: check if they coach the team linked to this channel
      if (role === 'coach') {
        const channel = await base44.asServiceRole.entities.Channel.get(record.channel_id).catch(() => null);
        if (channel?.team_id) {
          const profiles = await base44.asServiceRole.entities.CoachProfile.filter({
            user_id: user.id,
            team_id: channel.team_id,
          });
          if (profiles.length > 0) return Response.json({ record });
        }
      }

      return Response.json({ error: 'Forbidden — not a member of this channel' }, { status: 403 });
    }

    return Response.json({ record });
  } catch (error) {
    console.error('[secureGetRecord]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});