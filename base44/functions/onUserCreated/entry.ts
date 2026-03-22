import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Entity automation handler: fires when a new User is created.
// If the user's email already has PlayerGuardian links, set role to 'parent' immediately.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const data = body.data;

    const userEmail = data?.email;
    const userId = data?.id;
    if (!userEmail || !userId) return Response.json({ ok: true });

    // Check for PlayerGuardian records matching this email
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: userEmail });

    if (guardianLinks.length > 0) {
      await base44.asServiceRole.entities.User.update(userId, { role: 'parent' });
      console.log(`Auto-set role=parent for new user ${userEmail} (${guardianLinks.length} guardian link(s))`);

      // Backfill user_id on guardian links
      for (const link of guardianLinks) {
        if (!link.user_id) {
          await base44.asServiceRole.entities.PlayerGuardian.update(link.id, { user_id: userId });
        }
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error('onUserCreated error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});