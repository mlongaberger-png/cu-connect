import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, role, relationship, players } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    // Invite the user — magic link will land them at /AcceptInvite
    await base44.users.inviteUser(email, 'user', '/AcceptInvite');

    // Create PlayerGuardian links for each player
    const playerList = Array.isArray(players) ? players : [];
    for (const { player_id, player_name } of playerList) {
      if (!player_id) continue;
      const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({ player_id, user_email: email });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.PlayerGuardian.create({
          player_id,
          player_name: player_name || '',
          user_email: email,
          relationship: relationship || 'Guardian',
          invited_by: 'admin',
        });
        console.log(`Linked ${email} → player ${player_id}`);
      }
    }

    // If user already exists, set role to parent
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    const assignRole = role === 'grandparent' ? 'grandparent' : 'parent';
    if (existingUsers.length > 0) {
      const u = existingUsers[0];
      if (u.role !== 'admin' && u.role !== 'coach') {
        await base44.asServiceRole.entities.User.update(u.id, { role: assignRole });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteParent error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});