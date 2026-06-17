import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Bulk-invite users to the app.
 * POST body: { users: [{ name, email, role }] }
 * Only admins can invite other admins; non-admins are limited to role "user".
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

    const results = [];
    for (const u of users) {
      if (!u.email) {
        results.push({ email: u.email || '(missing)', status: 'skipped', reason: 'Missing email' });
        continue;
      }
      const role = u.role === 'admin' ? 'admin' : 'user';
      // Non-admins cannot invite admins
      if (role === 'admin' && user.role !== 'admin') {
        results.push({ email: u.email, status: 'skipped', reason: 'Only admins can invite admins' });
        continue;
      }
      try {
        await base44.users.inviteUser(u.email, role);
        results.push({ email: u.email, status: 'invited', role });
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