import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id } = await req.json();
    if (!invoice_id) return Response.json({ error: 'invoice_id required' }, { status: 400 });

    // Fetch the invoice
    const invoices = await base44.asServiceRole.entities.Payment.filter({ id: invoice_id });
    if (!invoices.length) return Response.json({ error: 'Invoice not found' }, { status: 404 });
    const inv = invoices[0];

    if (!inv.parent_email) return Response.json({ error: 'No parent email on invoice' }, { status: 400 });

    const amountDue = ((inv.amount - (inv.paid_amount || 0)) / 100).toFixed(2);
    const dueDateStr = inv.due_date
      ? new Date(inv.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : 'soon';

    const subject = `Payment Reminder: ${inv.description} — $${amountDue} due ${dueDateStr}`;
    const body = `Hi,

This is a friendly reminder that the following invoice is due:

  Player:      ${inv.player_name || 'Your athlete'}
  Invoice:     ${inv.description}
  Amount Due:  $${amountDue}
  Due Date:    ${dueDateStr}
  ${inv.notes ? `\n  Notes: ${inv.notes}` : ''}

Please log in to your Parent Portal to pay: https://cuconnect.base44.app/ParentPortal

If you have questions, please contact your team administrator.

Thank you,
Cornerstone United Athletics`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: inv.parent_email,
      subject,
      body,
    });

    // Update reminder_sent_at on the invoice
    await base44.asServiceRole.entities.Payment.update(invoice_id, {
      reminder_sent_at: new Date().toISOString(),
    });

    console.log(`Reminder sent for invoice ${invoice_id} to ${inv.parent_email}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('sendInvoiceReminder error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});