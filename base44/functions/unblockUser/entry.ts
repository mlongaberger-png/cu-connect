import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  blocked_id: z.string().min(1),
}).strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { blocked_id } = schema.parse(await req.json());

    const blocks = await base44.asServiceRole.entities.BlockedUser.filter({
      blocker_id: user.id,
      blocked_id,
    });

    if (blocks.length === 0) {
      return Response.json({ unblocked: false, note: 'Not currently blocked' });
    }

    // Delete all matching blocks
    for (const b of blocks) {
      await base44.asServiceRole.entities.BlockedUser.delete(b.id);
    }

    console.log(`[unblockUser] ${user.email} unblocked ${blocked_id}`);
    return Response.json({ unblocked: true });
  } catch (error) {
    console.error('[unblockUser]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});