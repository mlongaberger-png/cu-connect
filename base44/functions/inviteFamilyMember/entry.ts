import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { z } from 'npm:zod@3.24.2';

const inviteFamilyMemberSchema = z.object({
  email: z.string().email(),
  player_id: z.string(),
  player_name: z.string().optional(),
  relationship: z.string().optional(),
  permissions: z.array(z.string()).optional(),
}).strict();

// Self-service version of inviteParent, for a PARENT inviting a co-guardian
// (grandparent, other family member) to their own child's player record.
// inviteParent itself is intentionally staff-only (admin/coach) and shouldn't
// be loosened for this — this is a separate function with its own narrower
// authorization check instead: the caller must already have legitimate
// access to player_id (as its direct parent_email, or via their own existing
// PlayerGuardian link) before they can grant someone else access to it.
// This re-implements, server-side via asServiceRole, the check that
// PlayerGuardian's own create RLS used to enforce client-side before it was
// tightened (see project notes on the F-01 IDOR fix) — without that check,
// this endpoint would let any caller grant guardian access to ANY player,
// reopening the exact hole that fix closed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const rawBody = await req.json();
    const parsed = inviteFamilyMemberSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { player_id, player_name, relationship, permissions } = parsed.data;
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    if (normalizedEmail === caller.email.toLowerCase()) {
      return Response.json({ error: "You can't invite your own email address." }, { status: 400 });
    }

    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    const isStaff = ['admin', 'athletic_director', 'coach'].includes(callerRole);

    if (!isStaff) {
      const players = await base44.asServiceRole.entities.Player.filter({ id: player_id });
      const player = players[0];
      if (!player) return Response.json({ error: 'Player not found.' }, { status: 404 });

      const isDirectParent = player.parent_email?.toLowerCase() === caller.email.toLowerCase();
      let isLinkedGuardian = false;
      if (!isDirectParent) {
        const myLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ player_id, user_email: caller.email });
        isLinkedGuardian = myLinks.length > 0;
      }

      if (!isDirectParent && !isLinkedGuardian) {
        console.error(`inviteFamilyMember: ${caller.email} has no access to player ${player_id}, forbidden`);
        return Response.json({ error: 'You do not have access to this player.' }, { status: 403 });
      }
    }

    // Don't create a duplicate link if one already exists for this player+email
    const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({ player_id, user_email: normalizedEmail });
    if (existing.length === 0) {
      await base44.asServiceRole.entities.PlayerGuardian.create({
        player_id,
        player_name: player_name || '',
        user_email: normalizedEmail,
        invited_by: caller.email,
        relationship: relationship || 'Guardian',
        permissions: Array.isArray(permissions) ? permissions : [],
      });
      console.log(`inviteFamilyMember: ${caller.email} linked ${normalizedEmail} to player ${player_id}`);
    } else {
      console.log(`inviteFamilyMember: ${normalizedEmail} already linked to player ${player_id}, skipping duplicate create`);
    }

    // Send the invite — magic link lands them at /AcceptInvite, same as
    // inviteParent. If this email already has an account, inviteUser may
    // throw (already-registered); that's fine, the guardian link above is
    // the important side effect either way — onUserCreated/autoUpgradeParentRole
    // will pick up the new PlayerGuardian link and upgrade their role
    // automatically on their next login regardless of how they got invited.
    try {
      await base44.users.inviteUser(normalizedEmail, 'user', '/AcceptInvite');
    } catch (inviteError) {
      console.log(`inviteFamilyMember: inviteUser skipped/failed for ${normalizedEmail} (likely an existing account): ${inviteError.message}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('inviteFamilyMember error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
