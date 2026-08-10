import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const methodEnum = z.enum(['email', 'push', 'both']);

// Self-service "Save Preferences" on the granular Notification Settings page
// (NotificationSettings.jsx). NotificationPreference.jsonc's RLS looks correct
// on paper (create/update both keyed on "user_email": "{{user.email}}"), but a
// client-side create/update against this entity returns 403 "Permission denied
// for create operation on NotificationPreference entity" even when the request
// body's user_email exactly matches the caller -- confirmed live via a raw XHR
// capture showing the 403 body. READ (filter) on the same entity returns 200
// fine, so only writes are affected, and the page's save mutation has no
// onError handler, so this failed silently with zero user-facing feedback
// (no error toast, no success toast, nothing) while the toggles kept
// reverting to their old values on reload.
//
// This is the same "field": "{{user.email}}" (flat, non-"data."-prefixed) RLS
// shape used by PushSubscription and ChannelMember, and the codebase already
// never trusts that shape for direct client writes -- saveSubscription/entry.ts
// and startDirectMessage/entry.ts both route those writes through
// asServiceRole instead. This function follows the same established pattern
// for NotificationPreference.
const schema = z.object({
  messages_enabled: z.boolean().optional(),
  messages_method: methodEnum.optional(),
  schedule_enabled: z.boolean().optional(),
  schedule_method: methodEnum.optional(),
  attendance_enabled: z.boolean().optional(),
  attendance_method: methodEnum.optional(),
  payments_enabled: z.boolean().optional(),
  payments_method: methodEnum.optional(),
  volunteers_enabled: z.boolean().optional(),
  volunteers_method: methodEnum.optional(),
  documents_enabled: z.boolean().optional(),
  documents_method: methodEnum.optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_start: z.string().max(5).optional(),
  quiet_end: z.string().max(5).optional(),
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me().catch(() => null);
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    const existing = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: caller.email });

    let record;
    if (existing.length > 0) {
      record = await base44.asServiceRole.entities.NotificationPreference.update(existing[0].id, data);
    } else {
      record = await base44.asServiceRole.entities.NotificationPreference.create({ ...data, user_email: caller.email });
    }

    console.log(`saveNotificationPreferences: saved prefs for ${caller.email} (${existing.length > 0 ? 'update' : 'create'})`);
    return Response.json({ success: true, preference: record });
  } catch (error) {
    console.error('saveNotificationPreferences error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
