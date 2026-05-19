import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Scheduled daily — deletes CarpoolRequests whose event_date has passed
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split("T")[0];
    console.log(`cleanupExpiredCarpools: running for date ${today}`);

    // Fetch all open carpool requests
    const allRequests = await base44.asServiceRole.entities.CarpoolRequest.list("-event_date", 500);

    const expired = allRequests.filter(r => r.event_date && r.event_date < today);
    console.log(`Found ${expired.length} expired carpool requests to delete`);

    let deleted = 0;
    for (const r of expired) {
      await base44.asServiceRole.entities.CarpoolRequest.delete(r.id);
      deleted++;
    }

    console.log(`Deleted ${deleted} expired carpool requests`);
    return Response.json({ success: true, deleted });
  } catch (error) {
    console.error('cleanupExpiredCarpools error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});