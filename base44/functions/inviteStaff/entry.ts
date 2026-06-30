import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Admin gate — DB role check (not JWT claim) + audit log ──────
    const user = await base44.auth.me();
    const ip = getClientIP(req);

    if (!user) {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: 'unknown', user_email: 'unknown',
        endpoint: 'inviteStaff', action: 'invite_staff',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRecord = await base44.asServiceRole.entities.User.filter({ id: user.id });
    if (userRecord.length === 0 || userRecord[0].role !== 'admin') {
      await base44.asServiceRole.entities.AdminAuditLog.create({
        user_id: user.id, user_email: user.email,
        endpoint: 'inviteStaff', action: 'invite_staff',
        ip_address: ip, result: 'denied',
      }).catch(() => {});
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    await base44.asServiceRole.entities.AdminAuditLog.create({
      user_id: user.id, user_email: user.email,
      endpoint: 'inviteStaff', action: 'invite_staff',
      ip_address: ip, result: 'allowed',
    }).catch(() => {});

    // ── Invitation logic ───────────────────────────────────────────
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
    try {
      const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
      if (existingUsers.length > 0) {
        await base44.asServiceRole.entities.User.update(existingUsers[0].id, { role });
      }
    } catch (roleErr) {
      console.warn('Could not pre-set app role (user may not exist yet):', roleErr.message);
    }

    console.log(`Invited ${email} as workspace:${workspaceRole} / app:${role}${team_name ? ` for team ${team_name}` : ''}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Invite staff error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});