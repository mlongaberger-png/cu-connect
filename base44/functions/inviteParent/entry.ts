import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { z } from 'npm:zod@3.24.2';

const inviteParentSchema = z.object({
  email: z.string().email(),
  role: z.enum(['parent', 'grandparent']).optional(),
  relationship: z.string().optional(),
  players: z.array(z.object({
    player_id: z.string(),
    player_name: z.string().optional(),
  }).strict()).optional(),
}).strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Require authenticated admin or coach
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    if (!['admin', 'coach'].includes(callerRole)) {
      console.error(`inviteParent: forbidden role '${callerRole}' for ${caller.email}`);
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parsed = inviteParentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, role, relationship, players } = parsed.data;
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