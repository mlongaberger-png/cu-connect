import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Reusable authorization guard: verifies the caller has access to the given team.
 *
 * Two modes:
 *   { mode: "team", team_id: string }
 *     → Verifies the authenticated user is admin, athletic_director, or coach of that team.
 *       Coaches must have a CoachProfile record linking user_id → team_id.
 *
 *   { mode: "ownership", entity: "Payment", record_id: string, owner_field: "parent_email" }
 *     → Fetches the record, compares owner_field value to the authenticated user's email.
 *       Staff (admin/AD/coach) bypass the ownership check.
 *
 * Returns: { authorized: boolean, error?: string, user?: { id, email, role } }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ authorized: false, error: 'Unauthenticated' }, { status: 401 });
    }

    // Re-fetch role from DB to prevent stale JWT claims
    const dbUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const role = dbUsers[0]?.role;
    const user = { id: caller.id, email: caller.email, role };

    // ── Team-scope mode ────────────────────────────────────────────────
    if (body.mode === 'team') {
      const { team_id } = body;
      if (!team_id) {
        return Response.json({ authorized: false, error: 'team_id required', user });
      }

      // Admins and Athletic Directors have unrestricted access
      if (['admin', 'athletic_director'].includes(role)) {
        return Response.json({ authorized: true, user });
      }

      // Coaches: must have a CoachProfile linking them to this team
      const profiles = await base44.asServiceRole.entities.CoachProfile.filter({
        user_id: user.id,
        team_id,
      });

      if (profiles.length === 0) {
        return Response.json({ authorized: false, error: 'Not authorized for this team', user }, { status: 403 });
      }

      return Response.json({ authorized: true, user });
    }

    // ── Ownership mode ─────────────────────────────────────────────────
    if (body.mode === 'ownership') {
      const { entity, record_id, owner_field } = body;
      if (!entity || !record_id || !owner_field) {
        return Response.json({ authorized: false, error: 'entity, record_id, and owner_field required', user });
      }

      // Staff bypass ownership check
      if (['admin', 'athletic_director', 'coach'].includes(role)) {
        return Response.json({ authorized: true, user });
      }

      const record = await base44.asServiceRole.entities[entity].get(record_id).catch(() => null);
      if (!record) {
        // Don't reveal whether the record exists — return generic 403
        return Response.json({ authorized: false, error: 'Forbidden', user }, { status: 403 });
      }

      if (record[owner_field] !== user.email) {
        return Response.json({ authorized: false, error: 'Not the owner of this record', user }, { status: 403 });
      }

      return Response.json({ authorized: true, user });
    }

    return Response.json({ authorized: false, error: 'Invalid mode. Use "team" or "ownership".', user }, { status: 400 });
  } catch (error) {
    console.error('authorizeObjectAccess error:', error.message);
    return Response.json({ authorized: false, error: error.message }, { status: 500 });
  }
});