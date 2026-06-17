import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Cross-tenant data leakage test:
 * "As User A, can I read User B's event and message by ID?"
 *
 * The test:
 *   1. Finds another user's event (one not on the current user's teams)
 *   2. Finds another user's message (one in a channel the current user isn't a member of)
 *   3. Tries to read both via direct entity get(id)
 *   4. Reports whether the platform allowed it
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const results = {};

    // ── 1. Determine the current user's team scope ──
    let userTeamIds = new Set();

    // Admin/AD coach profiles
    const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_id: user.id });
    profiles.forEach(p => { if (p.team_id) userTeamIds.add(p.team_id); });

    // Parent scope: teams of their linked players
    const guardians = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email });
    for (const g of guardians) {
      if (g.player_id) {
        const players = await base44.asServiceRole.entities.Player.filter({ id: g.player_id });
        players.forEach(p => { if (p.team_id) userTeamIds.add(p.team_id); });
      }
    }

    // Also check players where parent_email matches
    const directPlayers = await base44.asServiceRole.entities.Player.filter({ parent_email: user.email });
    directPlayers.forEach(p => { if (p.team_id) userTeamIds.add(p.team_id); });

    results.user_scope = {
      email: user.email,
      role: user.role,
      team_ids: [...userTeamIds],
    };

    // ── 2. Find another user's event (not on current user's teams) ──
    const allEvents = await base44.asServiceRole.entities.Event.list('-created_date', 50);
    const foreignEvent = allEvents.find(e => e.team_id && !userTeamIds.has(e.team_id));

    if (!foreignEvent) {
      results.event_test = { status: 'skipped', reason: 'No foreign event found (user may be on all teams)' };
    } else {
      results.event_test = {
        foreign_event_id: foreignEvent.id,
        foreign_event_title: foreignEvent.title,
        foreign_team_name: foreignEvent.team_name,
        foreign_team_id: foreignEvent.team_id,
        user_team_ids: [...userTeamIds],
      };

      // Now try to read it via the USER-scoped SDK (same thing a malicious
      // frontend call `base44.entities.Event.get(id)` would do)
      try {
        const readBack = await base44.entities.Event.get(foreignEvent.id);
        results.event_test.access = 'ALLOWED';
        results.event_test.leaked_data = {
          title: readBack.title,
          team_name: readBack.team_name,
          date: readBack.date,
          notes: readBack.notes,
          location: readBack.location,
        };
      } catch (e) {
        results.event_test.access = 'DENIED';
        results.event_test.error = e.message;
      }
    }

    // ── 3. Find another user's message (not in the current user's channels) ──
    // First find channels the user IS a member of
    const userChannels = await base44.asServiceRole.entities.ChannelMember.filter({ user_email: user.email });
    const userChannelIds = new Set(userChannels.map(cm => cm.channel_id));

    const allMessages = await base44.asServiceRole.entities.Message.list('-created_date', 50);
    const foreignMsg = allMessages.find(m => m.channel_id && !userChannelIds.has(m.channel_id));

    if (!foreignMsg) {
      results.message_test = { status: 'skipped', reason: 'No foreign message found (user may be in all channels)' };
    } else {
      results.message_test = {
        foreign_message_id: foreignMsg.id,
        foreign_channel_id: foreignMsg.channel_id,
        foreign_sender_name: foreignMsg.sender_name,
        user_channel_ids: [...userChannelIds],
      };

      try {
        const readBack = await base44.entities.Message.get(foreignMsg.id);
        results.message_test.access = 'ALLOWED';
        results.message_test.leaked_data = {
          content_text: readBack.content_text,
          sender_name: readBack.sender_name,
          channel_id: readBack.channel_id,
        };
      } catch (e) {
        results.message_test.access = 'DENIED';
        results.message_test.error = e.message;
      }
    }

    // ── 4. Summary ──
    const eventLeaked = results.event_test?.access === 'ALLOWED';
    const messageLeaked = results.message_test?.access === 'ALLOWED';
    const anyLeak = eventLeaked || messageLeaked;

    results.verdict = {
      event_leaked: eventLeaked,
      message_leaked: messageLeaked,
      any_cross_tenant_leak: anyLeak,
      action: anyLeak
        ? 'FAIL — User A CAN read User B data. Add RLS or backend-function gate.'
        : 'PASS — No cross-tenant data leakage detected',
    };

    return Response.json(results);
  } catch (error) {
    console.error('[testCrossTenantAccess]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});