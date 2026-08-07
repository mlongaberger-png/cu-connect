import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Creates (or returns the existing) direct-message Channel between the caller and a target
 * contact, with the authorization check re-implemented server-side via asServiceRole.
 *
 * Fixes a second, compounding bug found alongside getDmContacts (2026-08-07): even with the
 * contact list fixed, NewDmDialog.jsx's "Open Chat" button called the raw client
 * `base44.entities.Channel.create({ type: "direct", ... })` — but Channel's own `create` RLS
 * is staff-only (admin/athletic_director/coach), so a parent could never actually create a
 * direct channel even with a valid, staff contact selected ("parents can always DM staff" is
 * the intended behavior per the frontend's own logic/comments, but was structurally blocked).
 * This function re-implements the same "who can DM whom" rule as getDmContacts and then does
 * the create as asServiceRole, so the channel is created on the caller's behalf without
 * loosening Channel's create RLS for any other, unrelated caller.
 *
 * Usage (frontend):
 *   const res = await base44.functions.invoke('startDirectMessage', { contact_email });
 *   const channel = res.data.channel;
 */
const LEADERSHIP_ROLES = ['coach', 'athletic_director', 'admin'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { contact_email } = await req.json();
    if (!contact_email) return Response.json({ error: 'contact_email required' }, { status: 400 });

    const myEmail = authUser.email;
    if (contact_email.toLowerCase() === myEmail.toLowerCase()) {
      return Response.json({ error: 'Cannot start a direct message with yourself' }, { status: 400 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ email: myEmail }, null, 1);
    const role = dbUsers[0]?.role || authUser.role;

    const targetUsers = await base44.asServiceRole.entities.User.filter({ email: contact_email }, null, 1);
    const target = targetUsers[0];
    if (!target) return Response.json({ error: 'Contact not found' }, { status: 404 });

    const isLeadership = LEADERSHIP_ROLES.includes(role);
    let allowed = isLeadership || LEADERSHIP_ROLES.includes(target.role);

    if (!allowed) {
      const allChannels = await base44.asServiceRole.entities.Channel.filter({}, null, 1000);
      const teammateEmails = new Set();
      allChannels.forEach(ch => {
        if (ch.type !== 'team' && ch.type !== 'announcement') return;
        try {
          const members = JSON.parse(ch.member_emails || '[]');
          if (members.includes(myEmail)) members.forEach(e => teammateEmails.add(e));
        } catch { /* skip malformed member_emails */ }
      });
      allowed = teammateEmails.has(contact_email);
    }

    if (!allowed) {
      console.log(`[startDirectMessage] DENIED caller=${myEmail} target=${contact_email} (not a valid contact)`);
      return Response.json({ error: 'Forbidden — not a valid contact' }, { status: 403 });
    }

    // Reuse an existing direct channel between these two if one already exists
    const existing = await base44.asServiceRole.entities.Channel.filter({ type: 'direct' }, null, 1000);
    let channel = existing.find(ch => {
      try {
        const members = JSON.parse(ch.member_emails || '[]');
        return members.includes(myEmail) && members.includes(contact_email);
      } catch { return false; }
    });

    if (!channel) {
      channel = await base44.asServiceRole.entities.Channel.create({
        type: 'direct',
        name: target.full_name || target.email,
        member_emails: JSON.stringify([myEmail, contact_email]),
      });
    }

    // Seed ChannelMember rows for BOTH participants at creation time. Found live 2026-08-07,
    // right after fixing the two bugs above: a brand-new direct channel had member_emails set
    // on the Channel record (the source of truth used everywhere else — NewDmDialog, the
    // sidebar's directChannels filter), but zero ChannelMember rows. getMessagesFiltered gates
    // non-staff reads on ChannelMember, and onMessageCreated only resolves direct/carpool
    // recipients from EXISTING ChannelMember rows rather than from member_emails — so a brand
    // new DM was a dead end for a non-staff recipient: the first message would ever notify or
    // become readable by them, because nothing ever bootstraps ChannelMember from member_emails.
    // Confirmed live: a coach could send into a fresh DM, but the parent on the other end saw
    // "No messages in this channel yet" for a message that existed correctly server-side.
    const memberEmails = [myEmail, contact_email];
    const existingMembers = await base44.asServiceRole.entities.ChannelMember.filter({ channel_id: channel.id }, null, 10);
    const existingEmails = new Set(existingMembers.map(m => (m.user_email || '').toLowerCase()));
    await Promise.all(
      memberEmails
        .filter(e => !existingEmails.has(e.toLowerCase()))
        .map(e => base44.asServiceRole.entities.ChannelMember.create({
          channel_id: channel.id,
          user_email: e,
          unread_count: 0,
        }).catch(err => console.error(`[startDirectMessage] ChannelMember seed failed for ${e}:`, err.message)))
    );

    return Response.json({ channel });
  } catch (error) {
    console.error('[startDirectMessage]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
