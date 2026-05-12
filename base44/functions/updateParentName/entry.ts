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
    if (full_name !== undefined) updates.full_name = full_name;
    if (role !== undefined) updates.role = role;

    await base44.asServiceRole.entities.User.update(target_user_id, updates);

    console.log(`Admin ${user.email} updated user ${target_user_id}:`, updates);
    return Response.json({ success: true });
  } catch (error) {
    console.error('updateParentName error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});