import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_user_id, full_name, role } = await req.json();
    if (!target_user_id) {
      return Response.json({ error: 'target_user_id is required' }, { status: 400 });
    }

    const updates = {};
    if (role !== undefined) updates.role = role;

    // full_name is a built-in auth field that cannot be changed via entity update.
    // We store it as display_name override on the User entity instead.
    if (full_name !== undefined) updates.display_name = full_name;

    await base44.asServiceRole.entities.User.update(target_user_id, updates);

    // Also update parent_name on any linked Player records so the roster stays consistent
    if (full_name !== undefined) {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const targetUser = allUsers.find(u => u.id === target_user_id);
      if (targetUser?.email) {
        const players = await base44.asServiceRole.entities.Player.filter({ parent_email: targetUser.email });
        await Promise.all(players.map(p =>
          base44.asServiceRole.entities.Player.update(p.id, { parent_name: full_name })
        ));
        console.log(`Updated parent_name on ${players.length} player record(s) for ${targetUser.email}`);
      }
    }

    console.log(`Admin ${user.email} updated user ${target_user_id}:`, updates);
    return Response.json({ success: true });
  } catch (error) {
    console.error('updateParentName error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});