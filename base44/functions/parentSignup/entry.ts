import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { parent_name, parent_email, parent_phone, child_names, sport_interest, notes } = await req.json();

    if (!parent_name || !parent_email || !child_names) {
      return Response.json({ error: 'Name, email, and child name(s) are required.' }, { status: 400 });
    }

    // Check for duplicate pending/approved request
    const existing = await base44.asServiceRole.entities.AccessRequest.filter({ parent_email });
    const active = existing.find(r => r.status === 'pending' || r.status === 'approved');
    if (active) {
      return Response.json({ error: 'An account request for this email already exists.' }, { status: 409 });
    }

    // Create access request record
    await base44.asServiceRole.entities.AccessRequest.create({
      parent_name,
      parent_email,
      parent_phone: parent_phone || '',
      child_names,
      sport_interest: sport_interest || '',
      notes: notes || '',
      status: 'pending',
    });

    // Notify admins via email
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `New Parent Signup Request – ${parent_name}`,
        body: `
A parent has requested access to the Cornerstone United parent portal.

Name: ${parent_name}
Email: ${parent_email}
Phone: ${parent_phone || 'Not provided'}
Child(ren): ${child_names}
Sport/Team Interest: ${sport_interest || 'Not specified'}
Notes: ${notes || 'None'}

Please log in to the Admin panel to review and approve this request.
        `.trim(),
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('parentSignup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});