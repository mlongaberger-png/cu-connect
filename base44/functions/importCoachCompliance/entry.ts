import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Bulk-upserts reviewed coach compliance rows (from parseCoachComplianceFile,
// after the safety officer/AD reviews and corrects them client-side) into
// CoachCompliance, matched by user_email. Runs server-side under
// asServiceRole so a single import can create/update many records regardless
// of the caller's own per-record RLS, with a clean created/updated/skipped
// summary returned to the UI.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'athletic_director')) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { records } = await req.json();
    if (!Array.isArray(records) || records.length === 0) {
      return Response.json({ error: 'records array is required' }, { status: 400 });
    }
    if (records.length > 500) {
      return Response.json({ error: 'Too many records in one import (max 500).' }, { status: 400 });
    }

    let created = 0, updated = 0, skipped = 0;
    const errors = [];

    for (const [idx, r] of records.entries()) {
      const email = (r.user_email || '').trim();
      if (!email) {
        skipped++;
        errors.push({ row: idx, name: r.user_name || '(no name)', reason: 'Missing email' });
        continue;
      }

      const payload = {
        user_name: r.user_name || '',
        user_email: email,
        bg_check_passed: !!r.bg_check_passed,
        bg_check_expires: r.bg_check_expires || null,
        nays_completed: !!r.nays_completed,
        nays_expires: r.nays_expires || null,
        notes: r.notes || '',
      };

      try {
        const existing = await base44.asServiceRole.entities.CoachCompliance.filter({ user_email: email });
        if (existing.length > 0) {
          await base44.asServiceRole.entities.CoachCompliance.update(existing[0].id, payload);
          updated++;
        } else {
          await base44.asServiceRole.entities.CoachCompliance.create(payload);
          created++;
        }
      } catch (err) {
        skipped++;
        errors.push({ row: idx, name: r.user_name || email, reason: err.message });
      }
    }

    console.log(`[importCoachCompliance] ${created} created, ${updated} updated, ${skipped} skipped by ${user.email}`);
    return Response.json({ success: true, created, updated, skipped, errors });
  } catch (error) {
    console.error('importCoachCompliance error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
