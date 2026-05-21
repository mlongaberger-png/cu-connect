import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Deletes all child records associated with a given user email and/or user ID.
 * Called internally by adminDeleteAccount and available as a standalone admin utility.
 *
 * Payload: { target_email: string, target_user_id?: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const caller = await base44.auth.me();
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email, target_user_id } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email is required' }, { status: 400 });
    }

    const results = {};

    // Helper: delete all records matching a filter, return count
    const purge = async (entityName, filter) => {
      const records = await base44.asServiceRole.entities[entityName].filter(filter);
      await Promise.all(records.map(r => base44.asServiceRole.entities[entityName].delete(r.id)));
      results[entityName] = (results[entityName] || 0) + records.length;
      return records.length;
    };

    // Run all independent deletes concurrently
    await Promise.all([
      purge('PlayerGuardian', { user_email: target_email }),
      purge('PushSubscription', { user_email: target_email }),
      purge('NotificationPreference', { user_email: target_email }),
      purge('NotificationQueue', { user_email: target_email }),
      purge('BlockedUser', { blocker_email: target_email }),
      purge('BlockedUser', { blocked_email: target_email }),
      purge('UserChatPreference', { user_id: target_user_id || target_email }),
      purge('CarpoolRequest', { requester_email: target_email }),
      purge('MessageReport', { reporter_email: target_email }),
      purge('MessageReadReceipt', { reader_email: target_email }),
    ]);

    // ChannelMember — email-keyed
    await purge('ChannelMember', { user_email: target_email });

    // SnackAssignment — assigned_email
    await purge('SnackAssignment', { assigned_email: target_email });

    console.log(`orphanedRecordCleaner: purged records for ${target_email}`, results);
    return Response.json({ success: true, deleted: results });
  } catch (error) {
    console.error('orphanedRecordCleaner error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});