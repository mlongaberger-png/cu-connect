import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only POST accepted (entity automations always POST)
    if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

    // If a token is present, enforce admin role
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const caller = await base44.auth.me().catch(() => null);
      if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
      const callerRole = callerUsers[0]?.role;
      if (!['admin'].includes(callerRole)) {
        console.error(`propagateTeamNameChange: forbidden role '${callerRole}' for ${caller.email}`);
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    // No auth header = entity automation; proceed as system

    const body = await req.json();

    // Supports direct call or entity automation payload
    const teamId = body.team_id || body.data?.id || body.event?.entity_id;
    const newTeamName = body.team_name || body.data?.name;
    const newSportName = body.sport_name || body.data?.sport_name;

    if (!teamId) {
      return Response.json({ error: 'team_id is required' }, { status: 400 });
    }

    // If name wasn't passed directly, fetch the team
    let teamName = newTeamName;
    let sportName = newSportName;
    if (!teamName) {
      const team = await base44.asServiceRole.entities.Team.get(teamId);
      teamName = team.name;
      sportName = team.sport_name;
    }

    console.log(`Propagating team name change: ${teamId} → "${teamName}"`);

    const updateOps = [];

    // Entities that store team_name (and optionally sport_name) by team_id
    const entitiesWithTeamId = [
      { name: 'Player', fields: ['team_name', 'sport_name'] },
      { name: 'Event', fields: ['team_name', 'sport_name'] },
      { name: 'FilmClip', fields: ['team_name', 'sport_name'] },
      { name: 'FilmAssignment', fields: ['team_name'] },
      { name: 'SnackAssignment', fields: ['team_name'] },
      { name: 'CarpoolRequest', fields: ['team_name'] },
      { name: 'AttendanceRequest', fields: ['team_name'] },
      { name: 'VolunteerOpportunity', fields: ['team_name'] },
    ];

    for (const entity of entitiesWithTeamId) {
      const records = await base44.asServiceRole.entities[entity.name].filter({ team_id: teamId });
      for (const record of records) {
        const updates = {};
        if (entity.fields.includes('team_name')) updates.team_name = teamName;
        if (entity.fields.includes('sport_name') && sportName !== undefined) updates.sport_name = sportName;
        await base44.asServiceRole.entities[entity.name].update(record.id, updates);
        updateOps.push(`${entity.name}:${record.id}`);
      }
    }

    // Announcements use target_name when target_id === teamId
    const announcements = await base44.asServiceRole.entities.Announcement.filter({ target_id: teamId });
    for (const ann of announcements) {
      await base44.asServiceRole.entities.Announcement.update(ann.id, { target_name: teamName });
      updateOps.push(`Announcement:${ann.id}`);
    }

    // MessageRoom names are set by admins manually, skip those.
    // Messages store channel_name — update if channel_id matches teamId
    const messages = await base44.asServiceRole.entities.Message.filter({ channel_id: teamId });
    for (const msg of messages) {
      await base44.asServiceRole.entities.Message.update(msg.id, { channel_name: teamName });
      updateOps.push(`Message:${msg.id}`);
    }

    console.log(`Team name propagation complete. Updated ${updateOps.length} records.`);
    return Response.json({ success: true, updated: updateOps.length });
  } catch (error) {
    console.error('propagateTeamNameChange error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});