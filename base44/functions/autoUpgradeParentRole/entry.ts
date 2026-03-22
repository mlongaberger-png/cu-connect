import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Called when a user with "user" role logs in.
// If they have PlayerGuardian links, upgrade them to "parent" automatically.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ upgraded: false, error: 'Not authenticated' }, { status: 401 });

    // Only act on plain "user" role
    if (user.role !== 'user') {
      return Response.json({ upgraded: false, role: user.role });
    }

    // Check for guardian links
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email });
    if (guardianLinks.length > 0) {
      await base44.asServiceRole.entities.User.update(user.id, { role: 'parent' });
      console.log(`Auto-upgraded ${user.email} from "user" → "parent" (${guardianLinks.length} guardian link(s))`);

      // Backfill user_id on guardian records
      for (const link of guardianLinks) {
        if (!link.user_id) {
          await base44.asServiceRole.entities.PlayerGuardian.update(link.id, { user_id: user.id });
        }
      }
      return Response.json({ upgraded: true, role: 'parent' });
    }

    return Response.json({ upgraded: false, role: 'user' });
  } catch (error) {
    console.error('autoUpgradeParentRole error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});