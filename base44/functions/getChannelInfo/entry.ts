import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Member count + member list for one chat, for the chat header ("24 members") and the
 * chat settings sheet. Added 2026-09-25 with the GroupMe-style messaging redesign.
 *
 * Runs asServiceRole because team-chat membership is DERIVED (active players on the team ->
 * their parent_email + PlayerGuardian links, plus explicit ChannelMember rows, plus the
 * team's coaches), and a parent's RLS can't read other families' Player/PlayerGuardian/User
 * rows. Same audience rule onMessageCreated uses to decide who gets a message, so the list
 * shown == the people who actually receive posts.
 *
 * Authorization: staff (admin/AD/coach) may look up any chat; everyone else only a chat
 * they are themselves a member of by that same rule.
 *
 * Privacy: returns display names, initials and a role label only -- never emails, phone
 * numbers or player details beyond "Parent · <player first name + last initial>".
 *
 * Request:  { channel_id }
 * Response: { member_count, members: [{ name, initials, role_label, is_staff }] }
 */
const STAFF = ['admin', 'athletic_director', 'coach'];
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', athletic_director: 'Athletic Director', coach: 'Coach',
  parent: 'Parent', grandparent: 'Grandparent', relative: 'Family', athlete: 'Athlete',
};

function displayName(u: any, email: string) {
  const n = (u?.full_name || '').trim();
  if (n && !n.includes('@')) return n;
  return email.split('@')[0];
}
function initials(name: string) {
  const p = name.split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { channel_id } = await req.json();
    if (!channel_id || typeof channel_id !== 'string') {
      return Response.json({ error: 'channel_id is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole.entities;
    const channel = (await sr.Channel.filter({ id: channel_id }))[0];
    if (!channel) return Response.json({ error: 'Not found' }, { status: 404 });

    // email(lowercase) -> label context (e.g. "Parent · Tyler B.")
    const members = new Map<string, { context?: string; coach?: boolean }>();
    const add = (email?: string, info: { context?: string; coach?: boolean } = {}) => {
      if (!email) return;
      const k = email.toLowerCase();
      const prev = members.get(k) || {};
      members.set(k, { context: prev.context || info.context, coach: prev.coach || info.coach });
    };

    if ((channel.type === 'team' || channel.type === 'announcement') && channel.team_id) {
      const players = await sr.Player.filter({ team_id: channel.team_id, is_active: true });
      const byId = new Map(players.map((p: any) => [p.id, p]));
      const kidLabel = (p: any) => [p.first_name, p.last_name ? `${p.last_name[0]}.` : ''].filter(Boolean).join(' ');
      players.forEach((p: any) => add(p.parent_email, { context: kidLabel(p) }));
      if (players.length) {
        const guardians = await sr.PlayerGuardian.filter({});
        guardians.forEach((g: any) => {
          const p = byId.get(g.player_id);
          if (p) add(g.user_email, { context: kidLabel(p) });
        });
      }
      try {
        const coaches = await sr.CoachProfile.filter({ team_id: channel.team_id });
        coaches.forEach((c: any) => add(c.user_email, { coach: true }));
      } catch { /* CoachProfile optional */ }
    }
    // Explicit members (DMs, carpool, team channels without a team_id, and anyone added directly)
    const explicit = await sr.ChannelMember.filter({ channel_id });
    explicit.forEach((m: any) => add(m.user_email));
    try {
      JSON.parse(channel.member_emails || '[]').forEach((e: string) => add(e));
    } catch { /* ignore malformed */ }

    const callerEmail = (caller.email || '').toLowerCase();
    if (!STAFF.includes(caller.role) && !members.has(callerEmail)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const emails = Array.from(members.keys());
    const users = emails.length ? await sr.User.filter({}) : [];
    const userByEmail = new Map(users.map((u: any) => [(u.email || '').toLowerCase(), u]));

    const list = emails
      .map((email) => {
        const u: any = userByEmail.get(email);
        const info = members.get(email)!;
        const role = u?.role || (info.coach ? 'coach' : 'parent');
        const isStaff = STAFF.includes(role) || !!info.coach;
        const name = displayName(u, email);
        const base = isStaff ? (info.coach && !STAFF.includes(role) ? 'Coach' : ROLE_LABEL[role] || 'Staff') : (ROLE_LABEL[role] || 'Member');
        const role_label = !isStaff && info.context ? `${base} · ${info.context}` : base;
        return { name, initials: initials(name), role_label, is_staff: isStaff };
      })
      // staff first, then alphabetical
      .sort((a, b) => (Number(b.is_staff) - Number(a.is_staff)) || a.name.localeCompare(b.name));

    return Response.json({ member_count: list.length, members: list });
  } catch (error) {
    console.error('getChannelInfo error:', (error as Error).message);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
