import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { application_id } = body;
    if (!application_id) return Response.json({ error: 'application_id is required' }, { status: 400 });

    // Fetch the application (service role to bypass RLS scoping for coaches)
    let application;
    try {
      const apps = await base44.asServiceRole.entities.RegistrationApplication.filter({ id: application_id });
      application = apps?.[0];
    } catch {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }
    if (!application) return Response.json({ error: 'Application not found' }, { status: 404 });

    if (application.status === 'approved') {
      return Response.json({ error: 'Application already approved' }, { status: 409 });
    }

    // Authorization: admin / athletic_director always allowed; coach only if head coach of target team
    const isAdmin = user.role === 'admin' || user.role === 'athletic_director' || user.role === 'ad';
    let isHeadCoach = false;
    if (user.role === 'coach') {
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({ user_email: user.email });
      isHeadCoach = profiles.some(
        p => p.team_id === application.target_team_id && p.role_type === 'head_coach'
      );
    }

    if (!isAdmin && !isHeadCoach) {
      return Response.json({ error: 'Not authorized to approve this application' }, { status: 403 });
    }

    // 1. Create Player record
    const player = await base44.asServiceRole.entities.Player.create({
      first_name: application.athlete_first_name,
      last_name: application.athlete_last_name,
      date_of_birth: application.athlete_dob || '',
      team_id: application.target_team_id,
      team_name: application.target_team_name || '',
      sport_name: application.sport_name || '',
      parent_name: application.parent_name || '',
      parent_email: application.parent_email || '',
      is_active: true,
    });

    // 2. Create PlayerGuardian record linking parent email to player
    await base44.asServiceRole.entities.PlayerGuardian.create({
      player_id: player.id,
      player_name: `${application.athlete_first_name} ${application.athlete_last_name}`,
      user_email: application.parent_email,
      user_id: application.parent_user_id || '',
      relationship: 'Guardian',
      invited_by: user.email,
      permissions: ['view_calendar', 'view_messages'],
    });

    // 3. Update application status to approved
    await base44.asServiceRole.entities.RegistrationApplication.update(application_id, {
      status: 'approved',
    });

    // 4. Post in-app notification to parent
    if (application.parent_email) {
      await base44.asServiceRole.entities.NotificationQueue.create({
        user_email: application.parent_email,
        title: 'Application Approved!',
        body: `Great news! ${application.athlete_first_name}'s application for ${application.target_team_name || 'their team'} has been approved. You now have access to the team portal.`,
        url: '/ParentPortal',
        source: 'other',
        dedup_key: `reg_app_approved_${application_id}`,
      });
    }

    return Response.json({ success: true, player_id: player.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});