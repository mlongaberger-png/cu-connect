import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify requester is admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role, sport_id, sport_name, team_id, team_name } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
    if (!role) return Response.json({ error: 'Role required' }, { status: 400 });

    const validRoles = ['admin', 'athletic_director', 'coach'];
    if (!validRoles.includes(role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Invite the user with the specified role
    await base44.users.inviteUser(email, role);

    console.log(`Invited ${email} as ${role}${team_name ? ` for team ${team_name}` : ''}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Invite staff error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});