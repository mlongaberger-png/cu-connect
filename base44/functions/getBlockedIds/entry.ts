import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Returns the set of blocked user IDs for the authenticated user.
 *
 * Used by message/chat functions to filter out blocked users server-side.
 * Equivalent to the SQL subquery in the RLS policy:
 *   SELECT blocked_id FROM user_blocks WHERE blocker_id = auth.uid()
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Who I've blocked
    const blockedByMe = await base44.entities.BlockedUser.filter(
      { blocker_id: user.id },
      null,
      500
    );
    const iBlocked = blockedByMe.map(b => b.blocked_id);

    // Who has blocked me (so I shouldn't see their content either)
    const blockedMe = await base44.entities.BlockedUser.filter(
      { blocked_id: user.id },
      null,
      500
    );
    const theyBlockedMe = blockedMe.map(b => b.blocker_id);

    // Union of both — we don't show messages to/from blocked users in either direction
    const allBlocked = [...new Set([...iBlocked, ...theyBlockedMe])];

    return Response.json({
      blocked_ids: allBlocked,
      i_blocked: iBlocked,
      they_blocked_me: theyBlockedMe,
    });
  } catch (error) {
    console.error('[getBlockedIds]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});