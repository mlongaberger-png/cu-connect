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
    const { users } = body;

    if (!Array.isArray(users) || users.length === 0) {
      return Response.json({ error: 'users must be a non-empty array' }, { status: 400 });
    }

    for (const u of users) {
      // Reject any payload that includes "role" — it is not stored in the DB
      if ('role' in u) {
        return Response.json({ error: 'Invalid field: role is not accepted' }, { status: 400 });
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