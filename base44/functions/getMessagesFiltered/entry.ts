import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns messages for a channel with block enforcement applied server-side.
 *
 * Equivalent RLS concept (what this function enforces):
 *   SELECT * FROM messages
 *   WHERE sender_user_id NOT IN (
 *     SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid()
 *   )
 *   AND NOT EXISTS (
 *     SELECT 1 FROM user_blocks
 *     WHERE blocker_id = messages.sender_user_id AND blocked_id = auth.uid()
 *   );
 *
 * Two-way filter: A blocks B → A doesn't see B's messages AND B doesn't see A's.
 *
 * GET /api/getMessagesFiltered?channel_id=xxx&limit=50
 * Returns: { messages: [...], filtered_count: N }
 */
// ── Display-name resolution (shared logic, kept in sync with src/lib/displayName.js) ──
// Many accounts were created with an auto-generated full_name (the email's local part, e.g.
// "kmattes08") or none at all (Sign in with Apple private-relay addresses). full_name is a
// built-in auth field that can't be edited, so real names live in User.display_name (set by
// admins, by the backfillDisplayNames job, or by the user via the "What's your name?" prompt).
function nameLooksGenerated(name: string | null | undefined, email?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return true;
  if (n.includes('@') || n.includes('+')) return true;
  const local = (email || '').split('@')[0].toLowerCase();
  if (local && n.toLowerCase() === local) return true;
  if (!/\s/.test(n) && /[0-9._]/.test(n)) return true; // single token like "jsmith7554"
  return false;
}
function tidyName(n: string): string {
  const t = n.trim().replace(/\s+/g, ' ');
  return t === t.toLowerCase() ? t.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
}
function effectiveName(u: any): string {
  if (!u) return 'Member';
  for (const cand of [u.display_name, u.full_name]) {
    if (!nameLooksGenerated(cand, u.email)) return tidyName(cand);
  }
  const email = (u.email || '').toLowerCase();
  if (!email || email.endsWith('privaterelay.appleid.com')) return 'Member';
  return email.split('@')[0];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse params from body (POST) or query string (GET)
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const channelId = body.channel_id || url.searchParams.get('channel_id');
    const limit = parseInt(body.limit || url.searchParams.get('limit') || '50');
    const skip = parseInt(body.skip || url.searchParams.get('skip') || '0');
    const parentMessageId = body.parent_message_id || url.searchParams.get('parent_message_id');
    const sort = body.sort || url.searchParams.get('sort') || '-created_date';

    if (!channelId) {
      return Response.json({ error: 'channel_id required' }, { status: 400 });
    }

    const role = user.role;

    // Admins, ADs, and coaches bypass channel membership checks — matches
    // ChatSidebar.jsx, which already shows these three roles every channel
    // org-wide, unscoped by ChannelMember (see isScopedRole there, and the
    // canCreate staff-role array). ChannelMember rows are only ever auto-
    // created reactively for message *recipients* (onMessageCreated), and
    // the sender is explicitly excluded from that — so a coach who is not
    // already a member (the common case) could see every channel exist but
    // could never read a single message in any of them, including their
    // own. Fixed 2026-08-07.
    const isStaff = role === 'admin' || role === 'athletic_director' || role === 'coach';

    if (!isStaff) {
      // Verify the caller is a ChannelMember of the requested channel
      const memberships = await base44.asServiceRole.entities.ChannelMember.filter(
        { channel_id: channelId, user_email: user.email },
        null,
        1
      );
      if (memberships.length === 0) {
        console.log(`[getMessagesFiltered] DENIED user=${user.email} channel=${channelId} (not a member)`);
        return Response.json({ messages: [], filtered_count: 0, has_more: false });
      }
    }

    // ── Build the blocked-ID set ──────────────────────────────
    const [blockedByMe, blockedMe] = await Promise.all([
      base44.asServiceRole.entities.BlockedUser.filter({ blocker_id: user.id }, null, 500),
      base44.asServiceRole.entities.BlockedUser.filter({ blocked_id: user.id }, null, 500),
    ]);

    const blockedIds = new Set([
      ...blockedByMe.map(b => b.blocked_id),
      ...blockedMe.map(b => b.blocker_id),
    ]);

    // ── Fetch messages ────────────────────────────────────────
    // Fetch all messages for the channel, then filter by parent_message_id in JS.
    // Filtering null in the DB query is unreliable when the field is absent vs explicitly null.
    const fetchLimit = Math.min(limit + 200, 1000);
    const allMessages = await base44.asServiceRole.entities.Message.filter(
      { channel_id: channelId },
      sort,
      fetchLimit
    );

    // Thread drill-down: caller supplied a specific parent_message_id
    // Top-level: no parentMessageId supplied — show only messages without a parent
    const threadFiltered = (parentMessageId !== null && parentMessageId !== undefined && parentMessageId !== '')
      ? allMessages.filter(m => m.parent_message_id === parentMessageId)
      : allMessages.filter(m => !m.parent_message_id);

    // Reply counts per parent message, computed from the full (pre-filter) allMessages set.
    // The top-level feed above deliberately excludes replies (threadFiltered), so a client
    // that only has access to the top-level response can never derive these counts itself —
    // computing it here, from data the client never receives otherwise, is the only way the
    // "💬 N replies" badge under a message can ever be non-zero.
    const replyCounts = {};
    for (const m of allMessages) {
      if (m.parent_message_id) {
        replyCounts[m.parent_message_id] = (replyCounts[m.parent_message_id] || 0) + 1;
      }
    }

    // ── Apply block filter ────────────────────────────────────
    const visible = threadFiltered.filter(m => !blockedIds.has(m.sender_user_id));
    const removed = allMessages.length - visible.length;

    // Apply skip + limit to filtered results
    const paged = visible.slice(skip, skip + limit);

    console.log(
      `[getMessagesFiltered] channel=${channelId} total=${allMessages.length} filtered=${removed} returned=${paged.length} skip=${skip} limit=${limit}`
    );

    // Show each sender's CURRENT real name, not the name stored on the message at send time
    // (which was often an auto-generated username like "mlongaberger"). Bots/system senders
    // with no matching User keep their stored name.
    const senderIds = new Set(paged.map((m: any) => m.sender_user_id).filter(Boolean));
    if (senderIds.size) {
      try {
        const users = await base44.asServiceRole.entities.User.list(null, 2000);
        const byId = new Map(users.map((u: any) => [u.id, u]));
        const byEmail = new Map(users.map((u: any) => [(u.email || '').toLowerCase(), u]));
        for (const m of paged) {
          const u = byId.get(m.sender_user_id) || byEmail.get(String(m.sender_user_id || '').toLowerCase());
          if (u) m.sender_name = effectiveName(u);
        }
      } catch (e) {
        console.error('[getMessagesFiltered] name resolution failed', (e as Error).message);
      }
    }

    return Response.json({
      messages: paged,
      filtered_count: removed,
      has_more: skip + limit < visible.length,
      reply_counts: replyCounts,
    });
  } catch (error) {
    console.error('[getMessagesFiltered]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});