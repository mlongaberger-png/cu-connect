import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check (not JWT claim) + IP allowlist + audit log ──
    const gate = await base44.functions.invoke('requireAdminAuth', {
      endpoint: 'inviteStaff',
      action: 'invite_staff',
    });
    if (!gate.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { email, role, sport_id, sport_name, team_id, team_name } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
    if (!role) return Response.json({ error: 'Role required' }, { status: 400 });

    const validAppRoles = ['admin', 'athletic_director', 'coach', 'parent'];
    if (!validAppRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Workspace only accepts 'admin' or 'user' — map app roles accordingly
    const workspaceRole = role === 'admin' ? 'admin' : 'user';
    // Staff land on the main portal; parents land on AcceptInvite onboarding
    const redirectPath = role === 'parent' ? '/AcceptInvite' : '/Portal';
    await base44.users.inviteUser(email, workspaceRole, redirectPath);

    // Set the app-level role on the User record after invite
    // The user record is created on first login; attempt to update if it already exists
    try {
      const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
      if (existingUsers.length > 0) {
        await base44.asServiceRole.entities.User.update(existingUsers[0].id, { role });
      }
    } catch (roleErr) {
      // Non-fatal: user may not exist yet (pre-login), role will be set on first login or next invite
      console.warn('Could not pre-set app role (user may not exist yet):', roleErr.message);
    }

    console.log(`Invited ${email} as workspace:${workspaceRole} / app:${role}${team_name ? ` for team ${team_name}` : ''}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Invite staff error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});