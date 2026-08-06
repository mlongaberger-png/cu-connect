import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Called when a user with "user" or "pending" role logs in — the safety net
// for the entity-created automations (onUserCreated), which can occasionally
// run before the signal they key off of (a PlayerGuardian link, or a
// Player.athlete_email stamp) exists yet. This re-checks on every login until
// the account lands on a real role, so a missed automation self-heals the
// next time the person signs in instead of staying stuck.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ upgraded: false, error: 'Not authenticated' }, { status: 401 });

    // Only act on 'user' or 'pending' roles — these are the pre-approval states
    if (user.role !== 'user' && user.role !== 'pending') {
      return Response.json({ upgraded: false, role: user.role });
    }

    // Check for a Player this email was promoted as the athlete login for.
    // Checked first — it's the more specific signal, and an athlete is never
    // also their own guardian, so there's no ambiguity to resolve here.
    const athletePlayers = await base44.asServiceRole.entities.Player.filter({ athlete_email: user.email });
    if (athletePlayers.length > 0) {
      // See onUserCreated for why athlete_paused must be explicitly stamped false
      // here too: it has no real schema default, and the Player/Message/Payment
      // read RLS requires the literal boolean false, not just "not true".
      await base44.asServiceRole.entities.User.update(user.id, { role: 'athlete', athlete_paused: false });
      console.log(`Auto-upgraded ${user.email} from "${user.role}" → "athlete", athlete_paused=false (matched Player.athlete_email)`);
      return Response.json({ upgraded: true, role: 'athlete' });
    }

    // Check for guardian links
    const guardianLinks = await base44.asServiceRole.entities.PlayerGuardian.filter({ user_email: user.email });
    if (guardianLinks.length > 0) {
      await base44.asServiceRole.entities.User.update(user.id, { role: 'parent' });
      console.log(`Auto-upgraded ${user.email} from "user" → "parent" (${guardianLinks.length} guardian link(s))`);

      // Backfill user_id on guardian records
      for (const link of guardianLinks) {
        if (!link.user_id) {
          await base44.asServiceRole.entities.PlayerGuardian.update(link.id, { user_id: user.id });
        }
      }
      return Response.json({ upgraded: true, role: 'parent' });
    }

    return Response.json({ upgraded: false, role: 'user' });
  } catch (error) {
    console.error('autoUpgradeParentRole error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});