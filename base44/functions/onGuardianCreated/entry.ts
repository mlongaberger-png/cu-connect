import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Entity automation handler: fires when a PlayerGuardian is created.
// If the guardian's email matches an existing user, set their role to 'parent'.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const data = body.data;

    const userEmail = data?.user_email;
    if (!userEmail) return Response.json({ ok: true });

    const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
    if (users.length > 0) {
      const existingUser = users[0];
      if (existingUser.role !== 'parent' && existingUser.role !== 'admin' && existingUser.role !== 'coach') {
        await base44.asServiceRole.entities.User.update(existingUser.id, { role: 'parent' });
        console.log(`Updated role to parent for existing user ${userEmail}`);
      }
      // Backfill user_id on the guardian record
      if (!data.user_id) {
        await base44.asServiceRole.entities.PlayerGuardian.update(data.id, { user_id: existingUser.id });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('onGuardianCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});