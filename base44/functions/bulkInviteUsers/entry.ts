import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Bulk-invite users to the app.
 * POST body: { users: [{ name, email }] }
 * "role" is not accepted — it is not stored in the DB and must be rejected.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // Reject unexpected top-level fields (mass assignment protection)
    const allowedTopLevel = new Set(['users']);
    for (const key of Object.keys(body)) {
      if (!allowedTopLevel.has(key)) {
        return Response.json({ error: `Invalid field: '${key}' is not accepted` }, { status: 400 });
      }
    }

    const { users } = body;

    if (!Array.isArray(users) || users.length === 0) {
      return Response.json({ error: 'users must be a non-empty array' }, { status: 400 });
    }

    // Allowed per-user fields
    const allowedUserFields = new Set(['email', 'name']);
    for (const u of users) {
      for (const key of Object.keys(u)) {
        if (!allowedUserFields.has(key)) {
          return Response.json({ error: `Invalid field in user entry: '${key}' is not accepted` }, { status: 400 });
        }
      }
    }

    const results = [];
    for (const u of users) {
      if (!u.email) {
        results.push({ email: u.email || '(missing)', status: 'skipped', reason: 'Missing email' });
        continue;
      }
      try {
        await base44.users.inviteUser(u.email, 'user');
        results.push({ email: u.email, status: 'invited' });
      } catch (e) {
        results.push({ email: u.email, status: 'failed', reason: e.message });
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error('[bulkInviteUsers]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});