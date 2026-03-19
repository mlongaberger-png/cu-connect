import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, player_id, player_name, relationship, players } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    // Invite the user to the platform
    await base44.users.inviteUser(email, 'user');

    // Build the list of players to link — support multi-player array or legacy single
    const playerLinks = players && players.length > 0
      ? players
      : player_id ? [{ player_id, player_name: player_name || "" }] : [];

    for (const { player_id: pid, player_name: pname } of playerLinks) {
      if (!pid) continue;
      const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({
        player_id: pid,
        user_email: email,
      });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.PlayerGuardian.create({
          player_id: pid,
          player_name: pname || "",
          user_email: email,
          relationship: relationship || "Guardian",
          invited_by: "admin",
        });
      }
    }

    return Response.json({ success: true, linked: playerLinks.length });
  } catch (error) {
    console.error('Invite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});