import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// placeWebsiteRegistration (admin / athletic director)
//
// Turns a paid website registration into a roster spot, the same way handleApproval
// does for in-app applications:
//   1. creates the Player on the chosen team (or moves the existing one if re-placed)
//   2. links the parent as guardian (with payment access) and joins them to the team chat
//   3. moves the registration's invoices from the placeholder "registration:<id>" onto
//      the real player, so payments 2 and 3 show up in the parent's app
//   4. marks the registration placed and notifies the parent
// Also handles { action: 'waitlist' | 'withdraw' | 'note' } for the admin list.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = user.role || user._app_role;
    if (!['admin', 'athletic_director', 'ad'].includes(role)) {
      return Response.json({ error: 'Only admins and athletic directors can place athletes' }, { status: 403 });
    }

    const { registration_id, team_id, action = 'place', note } = await req.json();
    if (!registration_id) return Response.json({ error: 'registration_id is required' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const reg = await db.ProgramRegistration.get(registration_id).catch(() => null);
    if (!reg) return Response.json({ error: 'Registration not found' }, { status: 404 });

    if (action === 'note') {
      await db.ProgramRegistration.update(reg.id, { admin_notes: String(note || '').slice(0, 2000) });
      return Response.json({ success: true });
    }
    if (action === 'waitlist' || action === 'withdraw') {
      await db.ProgramRegistration.update(reg.id, { status: action === 'waitlist' ? 'waitlist' : 'withdrawn' });
      return Response.json({ success: true });
    }

    if (!team_id) return Response.json({ error: 'Choose a team' }, { status: 400 });
    if (reg.payment_status === 'pending_checkout' || reg.payment_status === 'abandoned') {
      return Response.json({ error: 'This registration has not been paid yet' }, { status: 409 });
    }
    const team = await db.Team.get(team_id).catch(() => null);
    if (!team) return Response.json({ error: 'Team not found' }, { status: 404 });

    const athlete = `${reg.athlete_first_name} ${reg.athlete_last_name}`;
    const parentName = `${reg.parent_first_name || ''} ${reg.parent_last_name || ''}`.trim();
    const parentUser = (await db.User.filter({ email: reg.parent_email }))[0];

    // 1. Player (create, or move if this registration was placed before)
    const playerFields = {
      team_id: team.id,
      team_name: team.name,
      sport_name: team.sport_name || reg.sport_name || '',
      is_active: true,
    };
    let player = reg.player_id ? await db.Player.get(reg.player_id).catch(() => null) : null;
    if (player) {
      await db.Player.update(player.id, playerFields);
    } else {
      player = await db.Player.create({
        ...playerFields,
        first_name: reg.athlete_first_name,
        last_name: reg.athlete_last_name,
        date_of_birth: reg.athlete_dob || '',
        parent_name: parentName,
        parent_email: reg.parent_email,
        parent_phone: reg.parent_phone || '',
        emergency_contact: reg.emergency_contact || '',
        medical_notes: reg.medical_notes || '',
        position: reg.positions || '',
      });
    }

    // 2. Guardian link (payment access) + team chat
    const links = await db.PlayerGuardian.filter({ player_id: player.id, user_email: reg.parent_email });
    if (!links.length) {
      await db.PlayerGuardian.create({
        player_id: player.id,
        player_name: athlete,
        user_email: reg.parent_email,
        user_id: parentUser?.id || '',
        relationship: 'Guardian',
        invited_by: user.email,
        permissions: ['view_calendar', 'view_messages', 'financial_contributor'],
      });
    }
    try {
      const channels = (await db.Channel.filter({ team_id: team.id })).filter((c) => c.type === 'team' || c.type === 'announcement');
      for (const ch of channels) {
        const existing = await db.ChannelMember.filter({ channel_id: ch.id, user_email: reg.parent_email });
        if (!existing.length) {
          await db.ChannelMember.create({ channel_id: ch.id, user_email: reg.parent_email, user_id: parentUser?.id || '', user_name: parentName, unread_count: 0 });
        }
      }
    } catch (e) {
      console.error('[placeWebsiteRegistration] chat membership (non-fatal):', e.message);
    }

    // 3. Invoices onto the real player
    const ids = String(reg.payment_ids || '').split(',').filter(Boolean);
    const now = new Date().toISOString();
    for (const id of ids) {
      const inv = await db.Payment.get(id).catch(() => null);
      if (!inv) continue;
      await db.Payment.update(id, { player_id: player.id, player_name: athlete, team_name: team.name, sent_at: inv.sent_at || now });
    }

    // 4. Registration + parent notification
    await db.ProgramRegistration.update(reg.id, {
      status: 'placed',
      player_id: player.id,
      placed_team_id: team.id,
      placed_team_name: team.name,
      placed_at: now,
      placed_by: user.email,
    });
    try {
      await db.NotificationQueue.create({
        user_email: reg.parent_email,
        title: `${reg.athlete_first_name} is on ${team.name}`,
        body: `${reg.athlete_first_name} has been placed on ${team.name}. The team schedule and chat are now in CU Connect.`,
        url: '/ParentPortal',
        source: 'other',
        dedup_key: `web_reg_placed_${reg.id}_${team.id}`,
      });
    } catch (e) {
      console.error('[placeWebsiteRegistration] notification (non-fatal):', e.message);
    }

    return Response.json({ success: true, player_id: player.id, team_name: team.name });
  } catch (error) {
    console.error('[placeWebsiteRegistration]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
