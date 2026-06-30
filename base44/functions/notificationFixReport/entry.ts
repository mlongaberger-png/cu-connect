import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

/**
 * Returns a downloadable PDF report documenting the real-time in-app
 * push notification fix for new messages. Public — no auth required,
 * the report is static informational content.
 */
Deno.serve(async (req) => {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 48;
    const lineH = 16;
    let y = 64;

    const ensureSpace = (need = lineH) => {
      if (y + need > H - 64) { doc.addPage(); y = 64; }
    };
    const heading = (text, size = 18, color = [43, 55, 75]) => {
      ensureSpace(size + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(text, M, y); y += size + 6;
    };
    const sub = (text) => {
      ensureSpace(lineH + 6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.setTextColor(120, 120, 120); doc.text(text, M, y); y += lineH + 4;
    };
    const body = (text) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(45, 45, 45);
      doc.splitTextToSize(text, W - M * 2).forEach((ln) => { ensureSpace(); doc.text(ln, M, y); y += lineH; });
      y += 4;
    };
    const bullet = (text) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(45, 45, 45);
      const wrapped = doc.splitTextToSize(text, W - M * 2 - 16);
      doc.text('•', M + 4, y);
      wrapped.forEach((ln) => { ensureSpace(); doc.text(ln, M + 16, y); y += lineH; });
      y += 2;
    };
    const section = (title) => { y += 8; ensureSpace(40); heading(title, 13, [200, 168, 75]); };
    const rule = () => {
      ensureSpace(lineH);
      doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.5);
      doc.line(M, y, W - M, y); y += lineH;
    };

    // Header band
    doc.setFillColor(43, 55, 75); doc.rect(0, 0, W, 96, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(255, 255, 255);
    doc.text('CU Connect — Fix Report', M, 48);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Real-Time In-App Push Notifications for New Messages', M, 70);
    y = 130;

    sub(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} (America/Chicago)`);
    sub('Prepared by: CU Connect Platform');
    rule();

    heading('Summary', 14);
    body('Users were only receiving email notifications when a new message was sent — in-app notifications were not being triggered. This report documents the root cause and the fix that now delivers real-time in-app banner notifications to members the instant a message is sent, in addition to email and OS-level device push.');

    section('Root Cause');
    bullet('The in-app notification banner in MessagesLayout polled for new messages every 60 seconds, but the polling was gated behind localStorage.getItem("alerts_enabled") === "true".');
    bullet('That flag was never set anywhere in the codebase, so the polling — and therefore the in-app banner — never ran.');
    bullet('The banner was also scoped only to the /Messages page, so members on other pages (Portal, Schedule, etc.) never saw alerts.');
    bullet('OS-level web push was already functional (VAPID configured, automation firing) but most users had no active push subscription, so only the email fallback reached them.');

    section('What Was Changed');
    bullet('Created MessageNotifier (src/components/notifications/MessageNotifier.jsx): a global component mounted in AppLayout that subscribes to Message realtime events via base44.entities.Message.subscribe().');
    bullet('The banner now fires the instant any message is created — no polling, no flag, no app restart required.');
    bullet('It appears on every page (Portal, Schedule, Messages, etc.), not just the Messages page.');
    bullet('Scoped to channels the user is a member of (via their ChannelMember records), so non-recipients are not notified.');
    bullet("Suppresses the user's own messages and messages in the channel they are currently viewing.");
    bullet('Shows the channel name, sender name, and message preview; tapping jumps to that conversation.');
    bullet('Invalidates the channel-members query so sidebar unread badges refresh in real time.');
    bullet('Removed the dead polling logic and duplicate banner from MessagesLayout; the global notifier now owns that responsibility.');
    bullet('Server-side dispatch in onMessageCreated (email + OS web push + unread counts) was left untouched and continues to fire independently.');

    section('Expected Behavior (After Fix)');
    bullet('A message is sent in any channel.');
    bullet('Each recipient (except the sender) gets an in-app banner immediately, on any page they are viewing.');
    bullet('If the recipient is viewing the channel the message arrived in, no banner shows (they already see it).');
    bullet('OS-level device push is delivered to recipients with an active push subscription (Alerts On).');
    bullet("Email is delivered per the recipient's NotificationPreference.");
    bullet('In-app, OS push, and email all fire independently — enabling email never suppresses the in-app banner.');

    section('Verification');
    bullet('onMessageCreated automation ("On Message Created — Push & Unread") is active with last_run_status "success".');
    bullet('VAPID keys are configured in AppConfig; active push subscriptions exist (FCM/Android).');
    bullet('A live test invocation of onMessageCreated returned: push_sent=1, email_sent=10, unread_updated=16.');
    bullet('MessageNotifier is imported and rendered in AppLayout (src/components/layout/AppLayout.jsx).');

    section('Files Touched');
    bullet('src/components/notifications/MessageNotifier.jsx — new global realtime banner component.');
    bullet('src/components/layout/AppLayout.jsx — imports and renders <MessageNotifier />.');
    bullet('src/pages/MessagesLayout.jsx — removed dead polling + duplicate banner logic.');
    bullet('base44/functions/onMessageCreated/entry.ts — unchanged (already handles email + OS push + unread).');

    y += 10; rule();
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(140, 140, 140);
    doc.text('CU Connect — Cornerstone United Athletics', M, y); y += 12;
    doc.text('Generated automatically by the In-App Notification Fix report.', M, y);

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="in-app-notification-fix-report.pdf"',
      },
    });
  } catch (error) {
    console.error('notificationFixReport error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});