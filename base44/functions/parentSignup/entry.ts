import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { parent_name, parent_email, parent_phone, child_names, sport_interest, notes } = await req.json();

    if (!parent_name || !parent_email || !child_names) {
      return Response.json({ error: 'Name, email, and child name(s) are required.' }, { status: 400 });
    }

    // Check for duplicate pending/approved request
    const existing = await base44.asServiceRole.entities.AccessRequest.filter({ parent_email });
    const active = existing.find(r => r.status === 'pending' || r.status === 'approved');
    if (active) {
      return Response.json({ error: 'An account request for this email already exists.' }, { status: 409 });
    }

    // Create access request record
    await base44.asServiceRole.entities.AccessRequest.create({
      parent_name,
      parent_email,
      parent_phone: parent_phone || '',
      child_names,
      sport_interest: sport_interest || '',
      notes: notes || '',
      status: 'pending',
    });

    // Notify admins via email
    const reviewUrl = 'https://cu-connect.base44.app/AthleticDirectors?tab=people&sub=access';
    const athleteLines = child_names
      .split(',')
      .map(n => `<tr><td style="padding:4px 0;color:#e8e0d0;font-size:15px;">• ${n.trim()}</td></tr>`)
      .join('');

    const emailBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:24px;">
            <span style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;">CU Connect</span>
          </td>
        </tr>

        <!-- Status badge -->
        <tr>
          <td style="padding-bottom:8px;">
            <span style="display:inline-block;background-color:#c9a84c22;border:1px solid #c9a84c55;color:#c9a84c;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:20px;">Pending Approval</span>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding-bottom:28px;">
            <h1 style="margin:0;font-size:26px;font-weight:800;color:#f5f0e8;line-height:1.2;">New Parent Signup Request</h1>
          </td>
        </tr>

        <!-- Parent Information -->
        <tr>
          <td style="padding-bottom:20px;background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;">Parent Information</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Name</span>
                  <span style="font-size:15px;color:#f5f0e8;font-weight:600;">${parent_name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Email</span>
                  <span style="font-size:15px;color:#c9a84c;">${parent_email}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:2px;">Phone</span>
                  <span style="font-size:15px;color:#f5f0e8;">${parent_phone || 'Not provided'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:12px;"></td></tr>

        <!-- Athletes -->
        <tr>
          <td style="background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;">Athletes</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${athleteLines}
            </table>
          </td>
        </tr>

        <tr><td style="height:12px;"></td></tr>

        <!-- Sport & Notes -->
        <tr>
          <td style="background-color:#1a1a1a;border-radius:12px;padding:20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:14px;border-bottom:1px solid #2a2a2a;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;display:block;margin-bottom:6px;">Sport Interest</span>
                  <span style="font-size:15px;color:#e8e0d0;">${sport_interest || 'Not specified'}</span>
                </td>
              </tr>
              <tr>
                <td style="padding-top:14px;">
                  <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#888;display:block;margin-bottom:6px;">Notes</span>
                  <span style="font-size:15px;color:#e8e0d0;">${notes || 'None'}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr><td style="height:28px;"></td></tr>

        <!-- CTA Button -->
        <tr>
          <td align="center">
            <a href="${reviewUrl}" style="display:block;background-color:#c9a84c;color:#111111;font-size:16px;font-weight:800;text-decoration:none;text-align:center;padding:16px 32px;border-radius:10px;letter-spacing:0.3px;">Review Request →</a>
          </td>
        </tr>

        <tr><td style="height:36px;"></td></tr>

        <!-- Footer -->
        <tr>
          <td style="border-top:1px solid #2a2a2a;padding-top:20px;">
            <p style="margin:0 0 6px;font-size:12px;color:#555;text-align:center;">You are receiving this email because you are an administrator of CU Connect.</p>
            <p style="margin:0;font-size:12px;color:#444;text-align:center;">
              <a href="${reviewUrl}" style="color:#c9a84c;text-decoration:none;">Manage Preferences</a>
              &nbsp;·&nbsp;
              <a href="${reviewUrl}" style="color:#c9a84c;text-decoration:none;">Unsubscribe</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject: `New Parent Signup Request – ${parent_name}`,
        body: emailBody,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('parentSignup error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});