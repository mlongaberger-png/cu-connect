import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Fixes a real bug found live Aug 12, 2026, the day after the coach compliance feature
// (which this powers) was published: TeamCoachesTab.jsx's "Assign Coach" search called the
// raw client SDK (`base44.entities.User.list()`) to build its staff picker. User's
// platform-default read RLS rejects that call for every non-admin role -- confirmed live via
// network inspection as `athletic_director`, a 403 -- so the search box silently returned zero
// results for every AD user, even though Matthew's explicit decision was to fold the safety
// officer into the AD role specifically so ADs could do this. This is the exact same bug class
// already documented and fixed once in this app for DMs (see getDmContacts's header comment):
// a frontend component needs a broader read than a given caller's RLS allows, so a backend
// function re-implements the intended authorization server-side under asServiceRole, instead
// of loosening User's RLS (which would reopen exactly the over-broad access RLS exists to
// prevent).
//
// Restricted to admin/athletic_director callers, matching TeamCoachesTab.jsx's own
// canManage-only access (TeamDetail.jsx only renders the Coaches tab for admin/AD).
//
// Usage (frontend):
//   const res = await base44.functions.invoke('searchStaffUsers');
//   const users = res.data.users; // [{ id, email, full_name, display_name, role }, ...]

const STAFF_ROLES = ['coach', 'athletic_director', 'admin'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const callerRecords = await base44.asServiceRole.entities.User.filter({ email: authUser.email }, null, 1);
    const role = callerRecords[0]?.role || authUser.role;
    if (role !== 'admin' && role !== 'athletic_director') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list(null, 1000);
    const users = allUsers
      .filter(u => STAFF_ROLES.includes(u.role))
      .map(u => ({ id: u.id, email: u.email, full_name: u.full_name, display_name: u.display_name, role: u.role }));

    return Response.json({ users });
  } catch (error) {
    console.error('searchStaffUsers error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
