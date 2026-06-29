import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'athletic_director') {
      return Response.json({ error: 'Forbidden — admin or athletic director role required' }, { status: 403 });
    }

    const body = await req.json();
    const { registration_id, is_open } = body;

    if (!registration_id || typeof is_open !== 'boolean') {
      return Response.json({ error: 'registration_id and is_open (boolean) are required' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.TeamRegistration.update(registration_id, { is_open });

    return Response.json({ success: true, registration: updated });
  } catch (error) {
    console.error('toggleRegistrationStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});