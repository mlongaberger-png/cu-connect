import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  slot_id: z.string(),
  action: z.enum(['sign_up', 'drop']),
}).strict();

// Self-service sign-up/drop for a SnackAssignment slot (SnacksTab.jsx's
// "Sign Up"/"Drop" buttons). SnackAssignment's own RLS only allows
// admin/athletic_director/coach to update records -- correct for staff
// creating/managing slots via SnackManagerPanel, but it means a parent's own
// sign-up/drop click always failed with a permission-denied error. Unlike
// CarpoolRequest's cancel-your-own-request RLS (which works because the
// anchor field, requester_email, never changes on cancel), the field a
// parent needs to write here -- assigned_email -- is exactly the field an
// ownership RLS rule would need to already match, and it doesn't exist yet
// on an open slot. Same class of "can't check a value that doesn't exist
// yet" limitation documented elsewhere in this app for grant-access-to-self
// flows (see inviteFamilyMember) -- the fix is the same pattern: a dedicated
// asServiceRole function that re-implements the authorization server-side
// instead of relying on client RLS.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { slot_id, action } = parsed.data;

    const slot = await base44.asServiceRole.entities.SnackAssignment.get(slot_id);
    if (!slot) return Response.json({ error: 'Snack slot not found.' }, { status: 404 });

    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    const isStaff = ['admin', 'athletic_director', 'coach'].includes(callerRole);

    if (!isStaff) {
      // Same union getMyPlayers uses server-side (direct parent_email match
      // OR an existing PlayerGuardian link), re-implemented inline here to
      // keep this a single round trip rather than an extra function call.
      const [byParentEmail, guardianLinks] = await Promise.all([
        base44.asServiceRole.entities.Player.filter({ parent_email: caller.email }),
        base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: caller.email }),
      ]);
      const guardianPlayerIds = [...new Set(guardianLinks.map(g => g.player_id).filter(Boolean))];
      const byGuardianLink = guardianPlayerIds.length
        ? (await Promise.all(guardianPlayerIds.map(pid => base44.asServiceRole.entities.Player.filter({ id: pid })))).flat()
        : [];
      const myTeamIds = new Set([...byParentEmail, ...byGuardianLink].map(p => p.team_id).filter(Boolean));

      if (!myTeamIds.has(slot.team_id)) {
        console.error(`snackSlotSelfService: ${caller.email} has no linked player on team ${slot.team_id}, forbidden`);
        return Response.json({ error: "You don't have access to this team's snack slots." }, { status: 403 });
      }
    }

    if (action === 'sign_up') {
      if (slot.assigned_email) {
        return Response.json({ error: 'This slot has already been taken.' }, { status: 409 });
      }
      await base44.asServiceRole.entities.SnackAssignment.update(slot_id, {
        assigned_email: caller.email,
        assigned_name: caller.full_name || caller.email,
      });

      // Best-effort confirmation notification. Written directly here
      // (asServiceRole, same dedup_key convention sendSnackReminder already
      // uses) rather than invoking sendSnackReminder over HTTP, since that
      // function's own permission gate only ever allowed 'admin' through
      // when an auth header is present -- a signed-in parent calling it
      // directly would always be forbidden. Not worth threading that
      // function's permission model through here just to enqueue one row.
      base44.asServiceRole.entities.NotificationQueue.create({
        user_email: caller.email,
        title: `🍎 Snack Confirmed: ${slot.slot_label || slot.slot_type}`,
        body: `You're signed up for ${slot.slot_label || slot.slot_type} at ${slot.event_title} on ${slot.event_date}.`,
        url: '/ParentPortal',
        source: 'snack_reminder',
        dedup_key: `snack_confirm_${slot_id}`,
        status: 'pending',
      }).catch(err => console.error('snackSlotSelfService: notification enqueue failed (non-fatal):', err.message));

      return Response.json({ success: true });
    }

    // action === 'drop'
    if (slot.assigned_email?.toLowerCase() !== caller.email.toLowerCase()) {
      return Response.json({ error: 'You can only drop a slot you signed up for yourself.' }, { status: 403 });
    }
    await base44.asServiceRole.entities.SnackAssignment.update(slot_id, {
      assigned_email: '',
      assigned_name: '',
    });
    return Response.json({ success: true });
  } catch (error) {
    console.error('snackSlotSelfService error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
