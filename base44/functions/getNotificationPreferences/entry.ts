import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Self-service read for the Notification Settings page. Companion to
// saveNotificationPreferences.
//
// Found live while retesting the save fix: the write side works fine now
// (asServiceRole create/update, confirmed via admin query -- the record
// really is created and its fields really do update), but a normal
// client-side read (`base44.entities.NotificationPreference.filter({
// user_email: ... })`, called by this same caller with their own email)
// always comes back empty, even though NotificationPreference's read RLS is
// the exact same "{{user.email}}" match. Confirmed via a raw probe: the
// record exists (visible via an admin-level query, correct fields, correct
// user_email), but base44.entities.NotificationPreference.filter() as the
// owning parent returns []. Net effect: every save silently "worked" but the
// page always reloaded back to DEFAULTS, because it could never see its own
// saved row. Read RLS with this shape is apparently just as unreliable for
// self-service callers as create/update RLS turned out to be (see
// linkPlayerGuardian/saveNotificationPreferences's own comments) -- treat
// ALL of create/read/update on this "{{user.email}}"-matching shape as
// unreliable for direct client calls, not just writes.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: caller.email });

    return Response.json({ success: true, preference: existing[0] || null });
  } catch (error) {
    console.error('getNotificationPreferences error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
