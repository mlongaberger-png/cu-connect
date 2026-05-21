import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Shared role-verification utility function.
 * Fetches the caller's User record directly from the DB — never trusts the JWT claim alone.
 *
 * Payload: { allowed_roles: string[] }
 * Returns: { authorized: boolean, role: string|null, email: string|null, error?: string }
 *
 * Usage from another function:
 *   const check = await base44.asServiceRole.functions.invoke('verifyRole', { allowed_roles: ['admin'] });
 *   if (!check.authorized) return Response.json({ error: 'Forbidden' }, { status: 403 });
 *
 * NOTE: Must be called with the user's auth token in the request context (createClientFromRequest),
 * not from asServiceRole, so the me() call resolves the actual caller.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { allowed_roles } = await req.json();

    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ authorized: false, role: null, email: null, error: 'Unauthenticated' });
    }

    // Re-fetch role from DB — prevents stale/tampered JWT role claims
    const dbUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const dbRole = dbUsers[0]?.role || null;

    const authorized = Array.isArray(allowed_roles) && allowed_roles.includes(dbRole);

    return Response.json({
      authorized,
      role: dbRole,
      email: caller.email,
      name: caller.full_name || caller.email,
    });
  } catch (error) {
    console.error('verifyRole error:', error.message);
    return Response.json({ authorized: false, role: null, email: null, error: error.message });
  }
});