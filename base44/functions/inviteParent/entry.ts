import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();

    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

    // Anyone can invite a parent (role = user)
    await base44.asServiceRole.users.inviteUser(email, 'user');

    return Response.json({ success: true });
  } catch (error) {
    console.error('Invite error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});