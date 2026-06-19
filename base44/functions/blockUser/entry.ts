import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { z } from 'npm:zod@3.24.2';

const schema = z.object({
  blocked_id: z.string().min(1),
  blocked_email: z.string().email().optional(),
  blocked_name: z.string().optional(),
  reason: z.string().optional(),
}).strict();

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: 'Invalid fields', details: parsed.error.flatten() }, { status: 400 });
    }
    const { blocked_id, blocked_email, blocked_name, reason } = parsed.data;

    // Prevent self-blocking
    if (blocked_id === user.id) {
      return Response.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    // Check for existing block (idempotent)
    const existing = await base44.entities.BlockedUser.filter({
      blocker_id: user.id,
      blocked_id,
    });
    if (existing.length > 0) {
      return Response.json({ blocked: true, id: existing[0].id, note: 'Already blocked' });
    }

    const record = await base44.entities.BlockedUser.create({
      blocker_id: user.id,
      blocker_email: user.email,
      blocked_id,
      blocked_email: blocked_email || null,
      blocked_name: blocked_name || null,
      reason: reason || null,
    });

    console.log(`[blockUser] ${user.email} blocked ${blocked_email || blocked_id}`);
    return Response.json({ blocked: true, id: record.id });
  } catch (error) {
    console.error('[blockUser]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});