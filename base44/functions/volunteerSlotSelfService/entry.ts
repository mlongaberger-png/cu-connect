import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  action: z.enum(['sign_up', 'cancel']),
  opportunity_id: z.string().optional(),
  player_id: z.string().optional(),
  assignment_id: z.string().optional(),
}).strict();

// Self-service sign-up/cancel for a VolunteerOpportunity (ParentVolunteerView.jsx's
// "Sign Up"/"Cancel" buttons). VolunteerAssignment's create RLS already allows a
// parent to create their own record (data.volunteer_email == caller), so "sign_up"
// could technically go straight through the client SDK -- but its delete RLS is
// admin/athletic_director only, so a parent's own "Cancel" click always failed with
// a permission-denied error, same class of bug as SnackAssignment's self-service gap
// (see snackSlotSelfService). Routing BOTH actions through one function here also lets
// the signup_deadline field -- documented on the entity as "Cutoff date for parents to
// sign up or cancel" -- actually be enforced server-side for both directions, instead
// of only being checked client-side (where the "Cancel" button is just hidden after
// the deadline, which a technically-savvy parent could bypass by calling the raw SDK
// directly), and lets required_count/is_locked be re-checked at write time instead of
// only being used to disable a button in the UI.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { action, opportunity_id, player_id, assignment_id } = parsed.data;

    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    const isStaff = ['admin', 'athletic_director', 'coach'].includes(callerRole);

    // Same union getMyPlayers uses server-side (direct parent_email match OR an
    // existing PlayerGuardian link) -- only needed for the ownership check below,
    // so skip it entirely for staff callers (who don't go through this endpoint
    // in normal use, but shouldn't be blocked if they ever do).
    const getMyPlayerIds = async () => {
      if (isStaff) return null;
      const [byParentEmail, guardianLinks] = await Promise.all([
        base44.asServiceRole.entities.Player.filter({ parent_email: caller.email }),
        base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: caller.email }),
      ]);
      const guardianPlayerIds = [...new Set(guardianLinks.map((g) => g.player_id).filter(Boolean))];
      const byGuardianLink = guardianPlayerIds.length
        ? (await Promise.all(guardianPlayerIds.map((pid) => base44.asServiceRole.entities.Player.filter({ id: pid })))).flat()
        : [];
      const merged = new Map();
      [...byParentEmail, ...byGuardianLink].forEach((p) => merged.set(p.id, p));
      return merged;
    };

    if (action === 'sign_up') {
      if (!opportunity_id || !player_id) {
        return Response.json({ error: 'opportunity_id and player_id are required.' }, { status: 400 });
      }

      const opp = await base44.asServiceRole.entities.VolunteerOpportunity.get(opportunity_id);
      if (!opp) return Response.json({ error: 'Volunteer opportunity not found.' }, { status: 404 });

      if (!isStaff) {
        const myPlayers = await getMyPlayerIds();
        const player = myPlayers?.get(player_id);
        if (!player) {
          console.error(`volunteerSlotSelfService: ${caller.email} has no linked player ${player_id}, forbidden`);
          return Response.json({ error: "You don't have a linked player for this signup." }, { status: 403 });
        }
        if (player.team_id !== opp.team_id) {
          return Response.json({ error: "That player isn't on this opportunity's team." }, { status: 403 });
        }
      }

      if (opp.is_locked) {
        return Response.json({ error: 'This opportunity is locked and no longer accepting signups.' }, { status: 409 });
      }
      if (opp.signup_deadline && new Date(opp.signup_deadline) < new Date()) {
        return Response.json({ error: 'The signup deadline for this opportunity has passed.' }, { status: 409 });
      }

      const existingAssignments = await base44.asServiceRole.entities.VolunteerAssignment.filter({ opportunity_id });
      const alreadySignedUp = existingAssignments.some(
        (a) => a.volunteer_email?.toLowerCase() === caller.email.toLowerCase()
      );
      if (alreadySignedUp) {
        return Response.json({ error: "You're already signed up for this opportunity." }, { status: 409 });
      }
      const filledCount = existingAssignments.filter((a) => a.status !== 'no_show').length;
      if (filledCount >= (opp.required_count || 1)) {
        return Response.json({ error: 'This opportunity is already full.' }, { status: 409 });
      }

      let playerName = '';
      if (!isStaff) {
        const myPlayers = await getMyPlayerIds();
        const player = myPlayers?.get(player_id);
        playerName = player ? `${player.first_name} ${player.last_name}` : '';
      } else {
        const player = await base44.asServiceRole.entities.Player.get(player_id).catch(() => null);
        playerName = player ? `${player.first_name} ${player.last_name}` : '';
      }

      await base44.asServiceRole.entities.VolunteerAssignment.create({
        opportunity_id,
        player_id,
        player_name: playerName,
        team_id: opp.team_id,
        volunteer_name: caller.full_name || caller.email,
        volunteer_email: caller.email,
        status: 'signed_up',
      });

      return Response.json({ success: true });
    }

    // action === 'cancel'
    if (!assignment_id) {
      return Response.json({ error: 'assignment_id is required.' }, { status: 400 });
    }
    const assignment = await base44.asServiceRole.entities.VolunteerAssignment.get(assignment_id);
    if (!assignment) return Response.json({ error: 'Volunteer signup not found.' }, { status: 404 });

    if (!isStaff && assignment.volunteer_email?.toLowerCase() !== caller.email.toLowerCase()) {
      return Response.json({ error: 'You can only cancel a signup you made yourself.' }, { status: 403 });
    }

    if (!isStaff && assignment.opportunity_id) {
      const opp = await base44.asServiceRole.entities.VolunteerOpportunity.get(assignment.opportunity_id).catch(() => null);
      if (opp?.signup_deadline && new Date(opp.signup_deadline) < new Date()) {
        return Response.json({
          error: 'The signup deadline has passed, so this can no longer be cancelled online. Contact your coach or admin.',
        }, { status: 409 });
      }
    }

    await base44.asServiceRole.entities.VolunteerAssignment.delete(assignment_id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('volunteerSlotSelfService error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
