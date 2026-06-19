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

    // ── Apply block filter ────────────────────────────────────
    const visible = threadFiltered.filter(m => !blockedIds.has(m.sender_user_id));
    const removed = allMessages.length - visible.length;

    // Apply skip + limit to filtered results
    const paged = visible.slice(skip, skip + limit);

    console.log(
      `[getMessagesFiltered] channel=${channelId} total=${allMessages.length} filtered=${removed} returned=${paged.length} skip=${skip} limit=${limit}`
    );

    return Response.json({
      messages: paged,
      filtered_count: removed,
      has_more: skip + limit < visible.length,
    });
  } catch (error) {
    console.error('[getMessagesFiltered]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});