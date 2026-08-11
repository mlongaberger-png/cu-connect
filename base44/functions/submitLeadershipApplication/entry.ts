import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

// Self-service "Apply for Leadership Role" (LeadershipApplicationForm.jsx).
// LeadershipApplication.jsonc's create RLS is {"data.applicant_email":
// "{{user.email}}"} -- a self-service data-matching create rule, the same
// shape already found unreliable for self-service client-side creates
// elsewhere in this app (PlayerGuardian/ChannelMember's "data.user_email"
// $or branch, section 47/48 of the project doc; NotificationPreference's
// flat "user_email" shape, same section). Per that established finding,
// any data-matching branch of a create RLS rule should be treated as
// unreliable for a direct client create and routed through asServiceRole
// instead -- this function follows that same pattern.
//
// It also closes a real, separate gap: applicant_email in the form is
// self-typed, not auto-filled from the caller's login email, so a typo or
// a different contact email would have 403'd against the RLS rule even if
// client-side creates worked. Stamping applicant_email server-side from
// the authenticated caller removes that failure mode entirely -- the typed
// value is no longer trusted for identity, matching the same
// don't-trust-client-supplied-identity-fields pattern used by
// updateMyProfile/promoteAthlete elsewhere in this app.
const schema = z.object({
  applicant_name: z.string().min(1),
  applicant_phone: z.string().optional(),
  role_applying_for: z.enum([
    'coach', 'assistant_coach', 'athletic_director', 'team_manager', 'volunteer_coordinator', 'other',
  ]),
  sport_interest: z.string().optional(),
  experience: z.string().optional(),
  certifications: z.string().optional(),
  availability: z.string().optional(),
  notes: z.string().optional(),
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

    const record = await base44.asServiceRole.entities.LeadershipApplication.create({
      ...parsed.data,
      applicant_email: caller.email,
      status: 'pending',
    });

    console.log(`submitLeadershipApplication: created application ${record.id} for ${caller.email} (role: ${parsed.data.role_applying_for})`);
    return Response.json({ success: true, application: record });
  } catch (error) {
    console.error('submitLeadershipApplication error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
