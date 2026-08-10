import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  full_name: z.string().trim().min(1).max(200),
}).strict();

// Self-service "Full Name" save on Account Settings (AccountSettings.jsx).
//
// full_name is a Base44 platform auth field (same table as email) and is NOT
// writable via base44.auth.updateMe() or any entity update -- a PUT to
// /entities/User/me that includes full_name returns 200 and silently drops
// that field, while phone/avatar_url (real custom User.jsonc properties) do
// persist. This was confirmed live: the response body's full_name is
// unchanged even though the request body and the UI's "Changes saved" toast
// both show the new value.
//
// The app already has an established, correct pattern for this exact
// problem on the ADMIN side (updateParentName/entry.ts): store the display
// name as the User entity's own `display_name` custom field instead, which
// every read site in the app already prefers via `display_name || full_name`
// (ParentHome.jsx, AthleteHome.jsx, ParentPortal.jsx, StaffAccountsPanel.jsx,
// ParentAccountsTab.jsx, AuthContext.jsx's own auth/entity merge). This
// function is the self-service equivalent of updateParentName for a caller
// updating their OWN name (no target_user_id, no admin check needed) --
// User's default RLS is admin-only for both read and write, so a parent
// self-update still requires asServiceRole, same reasoning as
// updateFamilyAccess/snackSlotSelfService/etc.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { full_name } = parsed.data;

    await base44.asServiceRole.entities.User.update(caller.id, { display_name: full_name });

    // Keep the roster's denormalized parent_name in sync, same consistency
    // step updateParentName already performs for the admin-driven path.
    const players = await base44.asServiceRole.entities.Player.filter({ parent_email: caller.email });
    await Promise.all(
      players.map(p => base44.asServiceRole.entities.Player.update(p.id, { parent_name: full_name }))
    );

    console.log(`updateMyProfile: ${caller.email} set display_name="${full_name}", synced ${players.length} Player record(s)`);
    return Response.json({ success: true, display_name: full_name });
  } catch (error) {
    console.error('updateMyProfile error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
