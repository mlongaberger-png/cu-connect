import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const ALLOWED_PERMISSIONS = ['view_calendar', 'view_messages', 'financial_contributor'];

const schema = z.object({
  action: z.enum(['update_permissions', 'revoke']),
  guardian_id: z.string(),
  permissions: z.array(z.string()).optional(),
}).strict();

// Self-service update/revoke for a PlayerGuardian link (FamilyAccessManager.jsx's
// "Edit Access Permissions" pencil icon and "Revoke Access" trash icon). Both
// buttons previously called base44.entities.PlayerGuardian.update()/.delete()
// directly -- but PlayerGuardian's update AND delete RLS rules are both
// admin/athletic_director/coach ONLY, with no exception for a primary parent
// managing a guardian link on their own child's player record. That meant
// every real parent's click 403'd silently (neither call site had a
// try/catch, so the UI just hung on "Saving..." forever with no error shown).
// This mirrors inviteFamilyMember's authorization pattern: the caller must be
// the direct parent_email match on the target guardian link's player (or
// staff) before they can modify or remove that link, server-side via
// asServiceRole.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { action, guardian_id, permissions } = parsed.data;

    if (action === 'update_permissions') {
      if (!permissions) {
        return Response.json({ error: 'permissions is required for update_permissions.' }, { status: 400 });
      }
      const invalid = permissions.filter(p => !ALLOWED_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        return Response.json({ error: `Unknown permission(s): ${invalid.join(', ')}` }, { status: 400 });
      }
    }

    const guardian = await base44.asServiceRole.entities.PlayerGuardian.get(guardian_id).catch(() => null);
    if (!guardian) return Response.json({ error: 'Family access record not found.' }, { status: 404 });

    const callerUsers = await base44.asServiceRole.entities.User.filter({ email: caller.email });
    const callerRole = callerUsers[0]?.role;
    const isStaff = ['admin', 'athletic_director', 'coach'].includes(callerRole);

    if (!isStaff) {
      const player = await base44.asServiceRole.entities.Player.get(guardian.player_id).catch(() => null);
      if (!player) return Response.json({ error: 'Player not found.' }, { status: 404 });

      const isDirectParent = player.parent_email?.toLowerCase() === caller.email.toLowerCase();
      if (!isDirectParent) {
        console.error(`updateFamilyAccess: ${caller.email} is not the primary parent for player ${guardian.player_id}, forbidden`);
        return Response.json({ error: 'You can only manage family access for your own players.' }, { status: 403 });
      }
    }

    if (action === 'update_permissions') {
      await base44.asServiceRole.entities.PlayerGuardian.update(guardian_id, { permissions });
      console.log(`updateFamilyAccess: ${caller.email} updated permissions for guardian ${guardian_id}`);
    } else {
      await base44.asServiceRole.entities.PlayerGuardian.delete(guardian_id);
      console.log(`updateFamilyAccess: ${caller.email} revoked guardian ${guardian_id}`);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('updateFamilyAccess error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
