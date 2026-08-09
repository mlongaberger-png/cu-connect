import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Returns Payment (invoice) records the calling user is authorized to view, mirroring
// the exact same ownership logic createCheckout already enforces server-side when
// actually processing a payment (direct parent_email match, OR a guardian with
// financial_contributor permission, OR the promoted-and-unpaused athlete themselves).
//
// Bug this fixes: ParentPortal.jsx's Payments tab (via PlayerPaymentCard in
// PlayerPayments.jsx) fetches invoices via a raw, unfiltered `Payment.filter({player_id})`
// / `Payment.list()` client call. Payment's RLS read rule can only check
// `data.parent_email == caller` directly (or `data.athlete_email` for an unpaused
// athlete) -- it has no way to also allow a secondary guardian linked only via
// PlayerGuardian (RLS can't join tables, same platform limitation as
// getMyPlayers/getEventsFiltered). So a guardian invited with "financial_contributor"
// permission (e.g. via Invite Family Member) would see "No invoices yet" for a player
// they're correctly permitted to pay for -- the Payments TAB itself was already
// correctly gated (that reads PlayerGuardian.permissions directly client-side, which
// has an open read RLS), but the underlying DATA FETCH silently came back empty.
// createCheckout's own ownership check already correctly allows this guardian to pay
// once they have an invoice ID -- they just had no way to discover that ID from the UI.
// This function closes that gap. The athlete's own flow (AthleteHome.jsx) already
// worked correctly via the direct athlete_email RLS match -- this function is a no-op
// change in behavior for that path, just routed through the same call for consistency.
//
// - admin / athletic_director / coach -> all payments (staff already has full RLS
//   read access directly via role; included here for a single consistent call path)
// - athlete -> Payment.athlete_email == caller only, and only if not paused (fresh
//   server-side re-check, same pattern as createCheckout)
// - everyone else (parent/guardian) -> union of:
//     - payments for players where Player.parent_email == caller (primary parent,
//       full access, no permission check needed)
//     - payments for players linked via PlayerGuardian where user_email == caller
//       AND that specific link's permissions include "financial_contributor"
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = user.role;

    if (['admin', 'athletic_director', 'coach'].includes(role)) {
      const payments = await base44.asServiceRole.entities.Payment.list('-created_date', 2000);
      return Response.json({ payments });
    }

    if (role === 'athlete') {
      const freshUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
      const isPaused = freshUsers.length > 0 ? !!freshUsers[0].athlete_paused : true;
      if (isPaused) {
        console.log(`[getMyPaymentsFiltered] user=${user.email} role=athlete paused=true -> 0 payments`);
        return Response.json({ payments: [] });
      }
      const payments = await base44.asServiceRole.entities.Payment.filter({ athlete_email: user.email });
      return Response.json({ payments });
    }

    const [byParentEmail, guardianLinks] = await Promise.all([
      base44.asServiceRole.entities.Player.filter({ parent_email: user.email }),
      base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email }),
    ]);

    const primaryPlayerIds = byParentEmail.map(p => p.id);
    const financialGuardianPlayerIds = guardianLinks
      .filter(g => (g.permissions || []).includes('financial_contributor'))
      .map(g => g.player_id)
      .filter(Boolean);

    const allowedPlayerIds = [...new Set([...primaryPlayerIds, ...financialGuardianPlayerIds])];
    if (allowedPlayerIds.length === 0) {
      return Response.json({ payments: [] });
    }

    const paymentLists = await Promise.all(
      allowedPlayerIds.map(pid => base44.asServiceRole.entities.Payment.filter({ player_id: pid }))
    );
    const merged = new Map();
    paymentLists.flat().forEach(p => merged.set(p.id, p));
    const payments = [...merged.values()];

    console.log(`[getMyPaymentsFiltered] user=${user.email} role=${role} players=${allowedPlayerIds.length} payments=${payments.length}`);
    return Response.json({ payments });

  } catch (error) {
    console.error('[getMyPaymentsFiltered]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
