import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Admin-only: links an Apple private relay email to an existing parent's guardian records
// so they can sign in with Apple ID and land directly in their portal.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { primary_email, relay_email } = await req.json();
    if (!primary_email || !relay_email) {
      return Response.json({ error: 'primary_email and relay_email are required' }, { status: 400 });
    }
    if (primary_email === relay_email) {
      return Response.json({ error: 'relay_email must be different from primary_email' }, { status: 400 });
    }

    // Find all guardian links for the primary email
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: primary_email });
    if (guardianLinks.length === 0) {
      return Response.json({ error: 'No guardian links found for this parent email.' }, { status: 404 });
    }

    let created = 0;
    for (const link of guardianLinks) {
      const existing = await base44.asServiceRole.entities.PlayerGuardian.filter({
        player_id: link.player_id,
        user_email: relay_email,
      });
      if (existing.length === 0) {
        await base44.asServiceRole.entities.PlayerGuardian.create({
          player_id: link.player_id,
          player_name: link.player_name,
          user_email: relay_email,
          relationship: link.relationship || 'Guardian',
          invited_by: user.email,
        });
        created++;
      }
    }

    // If a user account already exists for the relay email, set role = parent
    try {
      const relayUsers = await base44.asServiceRole.entities.User.filter({ email: relay_email });
      if (relayUsers.length > 0) {
        await base44.asServiceRole.entities.User.update(relayUsers[0].id, { role: 'parent' });
        console.log(`Set role=parent for relay user: ${relay_email}`);
      }
    } catch (e) {
      console.warn('Could not set role on relay user:', e.message);
    }

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'relay_email_linked',
      category: 'user',
      actor_email: user.email,
      actor_name: user.full_name || user.email,
      actor_role: user.role,
      target_entity: 'PlayerGuardian',
      target_name: relay_email,
      description: `Admin ${user.email} linked Apple relay email ${relay_email} to parent ${primary_email} (${created} guardian link(s) created).`,
    });

    return Response.json({ success: true, links_created: created });
  } catch (error) {
    console.error('linkRelayEmail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});