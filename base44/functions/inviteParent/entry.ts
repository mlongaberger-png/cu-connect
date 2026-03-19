import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, player_id, player_name, relationship } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    // Invite the user to the platform
    await base44.users.inviteUser(email, 'user');

    // If a player_id is provided, ensure a PlayerGuardian link exists
    if (player_id) {
      const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({
        player_id,
        user_email: email,
      });

      if (existing.length === 0) {
        await base44.asServiceRole.entities.PlayerGuardian.create({
          player_id,
          player_name: player_name || "",
          user_email: email,
          relationship: relationship || "Guardian",
          invited_by: "admin",
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Invite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});