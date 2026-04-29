import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { parent_emails, doc_type_label, team_name, coach_name, missing_player_names } = await req.json();

    if (!parent_emails || parent_emails.length === 0) {
      return Response.json({ error: 'No parent emails provided' }, { status: 400 });
    }

    const subject = `Action Required: Missing ${doc_type_label} for ${team_name}`;
    const body = `Hi,

This is a reminder from ${coach_name} and the ${team_name} team.

We are still missing ${doc_type_label} for the following athlete(s):
${missing_player_names}

Please log in to CU Connect and upload the required document at your earliest convenience to ensure your athlete remains eligible to participate.

How to upload:
1. Log in to your Parent Portal
2. Go to Documents
3. Select the athlete and upload the required document

If you have any questions, please reach out to your coach directly.

Thank you,
${team_name} Staff`;

    const results = await Promise.allSettled(
      parent_emails.map(email =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject,
          body,
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Document reminder sent: ${sent} emails sent, ${failed} failed. Doc type: ${doc_type_label}, Team: ${team_name}`);

    return Response.json({ success: true, sent, failed });
  } catch (error) {
    console.error('sendDocumentReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});