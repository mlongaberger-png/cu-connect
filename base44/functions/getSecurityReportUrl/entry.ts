import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 50;

    const checkPage = (needed = 16) => {
      if (y + needed > 760) { doc.addPage(); y = 50; }
    };

    const addHeading = (text, size, color) => {
      checkPage(size + 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(text, 50, y);
      y += size + 10;
    };

    const addText = (text, indent = 0, opts = {}) => {
      checkPage(20);
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
      doc.setFontSize(opts.size || 10);
      doc.setTextColor(...(opts.color || [60, 60, 60]));
      const lines = doc.splitTextToSize(text, pageW - 100 - indent);
      for (const line of lines) {
        checkPage(14);
        doc.text(line, 50 + indent, y);
        y += (opts.size || 10) + 4;
      }
    };

    const bullet = (text, indent = 20) => addText('\u2022  ' + text, indent);

    const divider = () => {
      checkPage(20);
      doc.setDrawColor(180, 180, 180);
      doc.line(50, y, pageW - 50, y);
      y += 16;
    };

    const gap = (n = 6) => { y += n; };

    // ── COVER HEADER ──────────────────────────────────────────────────────────
    addHeading('CU Connect \u2014 Security Audit Report', 18, [30, 40, 50]);
    addText('Phase 1 Fixes + Phase 2 QA Verification Sweep', 0, { size: 11, color: [80, 80, 80] });
    addText('June 19, 2026  |  Internal \u2014 Confidential', 0, { size: 9, color: [130, 130, 130] });
    addText(`Prepared for: ${user.full_name || user.email}`, 0, { size: 9, color: [130, 130, 130] });
    gap(); divider();

    // ── 1. EXECUTIVE SUMMARY ──────────────────────────────────────────────────
    addHeading('1. Executive Summary', 14, [40, 50, 70]);
    addText('A two-phase security review was conducted on the CU Connect application. Phase 1 identified and patched 10 vulnerability classes across authentication, authorization, and data isolation layers. Phase 2 performed a full QA verification sweep confirming that all patchable findings are remediated with no functional regressions.');
    gap();
    addText('Result: 8 of 10 findings PASS. 2 findings are accepted platform-level constraints documented below.', 0, { bold: true, size: 10, color: [40, 100, 40] });
    gap(10); divider();

    // ── 2. PHASE 1 FINDINGS & FIXES ───────────────────────────────────────────
    addHeading('2. Phase 1 Findings & Fixes', 14, [40, 50, 70]);

    addText('F-01  Privilege Escalation \u2014 bulkInviteUsers', 0, { bold: true, size: 11 });
    bullet('Attack: POST body contained role: "admin" to elevate invited user privileges.');
    bullet('Fix: Strict Zod schema rejects any payload containing a role field with HTTP 400.');
    bullet('File: functions/bulkInviteUsers.js');
    gap(4);

    addText('F-02  Privilege Escalation \u2014 inviteParent', 0, { bold: true, size: 11 });
    bullet('Attack: POST body with role: "admin" attempting to grant admin to a parent invite.');
    bullet('Fix: Zod enum restricts role to ["parent", "grandparent"]; unrecognized keys rejected.');
    bullet('File: functions/inviteParent.js');
    gap(4);

    addText('F-03  Mass Assignment \u2014 createCheckout', 0, { bold: true, size: 11 });
    bullet('Attack: Injected tenant_id and price_id in POST body to override Stripe pricing scope.');
    bullet('Fix: Strict Zod schema with .strict() blocks unrecognized keys with HTTP 400.');
    bullet('File: functions/createCheckout.js');
    gap(4);

    addText('F-04  IDOR \u2014 secureGetRecord Entity Allowlist', 0, { bold: true, size: 11 });
    bullet('Attack: Requested Player entity directly by ID to bypass access gating.');
    bullet('Fix: secureGetRecord maintains an explicit entity allowlist; unlisted entities return 400.');
    bullet('File: functions/secureGetRecord.js');
    gap(4);

    addText('F-05  IDOR \u2014 authorizeObjectAccess Email Override', 0, { bold: true, size: 11 });
    bullet('Attack: Supplied attacker email in POST body to impersonate another user for access checks.');
    bullet('Fix: Function derives user identity from JWT (auth.me()) only; body-supplied email ignored.');
    bullet('File: functions/authorizeObjectAccess.js');
    gap(4);

    addText('F-06  Unauthenticated Calendar Feed', 0, { bold: true, size: 11 });
    bullet('Attack: GET icsCalendarFeed with fake or missing token to access team schedule data.');
    bullet('Fix: Token required; SHA-256 hash validated against CalendarToken entity; returns 401 if missing or invalid.');
    bullet('File: functions/icsCalendarFeed.js');
    gap(4);

    addText('F-07  Tenant Isolation \u2014 body-supplied team_id', 0, { bold: true, size: 11 });
    bullet('Attack: POST with foreign team_id in payload to read/write data of another team.');
    bullet('Fix: Server ignores body team_id; uses session-scoped CoachProfile team membership only.');
    bullet('Files: functions/createCheckout.js, functions/gameDayWeatherAlert.js');
    gap(4);

    addText('F-08  Admin Gate Bypass \u2014 requireAdminAuth', 0, { bold: true, size: 11 });
    bullet('Attack: Call admin endpoints without admin role, relying on JWT claim trust only.');
    bullet('Fix: requireAdminAuth queries User entity from DB to verify role; JWT claims not trusted.');
    bullet('File: functions/requireAdminAuth.js');
    gap(4);

    addText('F-09  Block Filter Bypass via Raw SDK (Platform Constraint)', 0, { bold: true, size: 11 });
    bullet('Finding: Message entity has read: true RLS; direct SDK calls bypass block filtering.');
    bullet('Mitigation: All UI paths use getMessagesFiltered which enforces BlockedUser checks server-side.');
    bullet('Accepted risk: Platform entity RLS cannot reference cross-entity relationships. Raw API access requires authenticated session regardless.');
    gap(4);

    addText('F-10  JWT Reuse After App-Level Session Revocation (Platform Constraint)', 0, { bold: true, size: 11 });
    bullet('Finding: Platform JWTs are stateless; revoking UserSession does not invalidate the JWT.');
    bullet('Mitigation: Session gate added to all sensitive write endpoints (createCheckout, deleteAccount, etc.).');
    bullet('Mitigation: Client logout calls base44.auth.logout() which clears the JWT from the browser.');
    bullet('Accepted risk: Server-side JWT blacklisting is not available on Base44 platform.');
    gap(10); divider();

    // ── 3. PHASE 2 QA VERIFICATION TABLE ─────────────────────────────────────
    addHeading('3. Phase 2 QA Verification Results', 14, [40, 50, 70]);
    addText('Each finding was retested by attempting to reproduce the original attack vector exactly as described.', 0, { size: 10, color: [80, 80, 80] });
    gap(8);

    // Table header
    const col1 = 50, col2 = 90, col3 = 250, col4 = 390, col5 = 470;
    const rowH = 18;

    doc.setFillColor(40, 50, 70);
    doc.rect(col1, y, pageW - 100, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('#', col1 + 4, y + 12);
    doc.text('Finding', col2 + 4, y + 12);
    doc.text('Attack Vector', col3 + 4, y + 12);
    doc.text('Expected', col4 + 4, y + 12);
    doc.text('Result', col5 + 4, y + 12);
    y += rowH;

    const findings = [
      ['F-01', 'Priv Escalation bulkInvite', 'POST with role:"admin"', '400', '\u2705 PASS'],
      ['F-02', 'Priv Escalation inviteParent', 'POST with role:"admin"', '400', '\u2705 PASS'],
      ['F-03', 'Mass Assign createCheckout', 'Inject tenant_id, price_id', '400', '\u2705 PASS'],
      ['F-04', 'IDOR secureGetRecord', 'Request unlisted entity', '400', '\u2705 PASS'],
      ['F-05', 'IDOR authorizeObjectAccess', 'Override user_email in body', '400', '\u2705 PASS'],
      ['F-06', 'Unauth Calendar Feed', 'GET with fake/no token', '401', '\u2705 PASS'],
      ['F-07', 'Tenant Isolation', 'Inject foreign team_id', 'Ignored', '\u2705 PASS'],
      ['F-08', 'Admin Gate Bypass', 'Non-admin calls admin endpoint', '403', '\u2705 PASS'],
      ['F-09', 'Block Filter via Raw SDK', 'Direct Message.filter() call', 'Arch limit', '\u26A0 ACCEPTED'],
      ['F-10', 'JWT Reuse After Revoke', 'Replay token post-revoke', 'Platform limit', '\u26A0 ACCEPTED'],
    ];

    findings.forEach(([num, finding, vector, expected, result], i) => {
      checkPage(rowH + 4);
      const bgColor = i % 2 === 0 ? [248, 249, 252] : [255, 255, 255];
      doc.setFillColor(...bgColor);
      doc.rect(col1, y, pageW - 100, rowH, 'F');
      doc.setDrawColor(210, 215, 225);
      doc.rect(col1, y, pageW - 100, rowH, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(num, col1 + 4, y + 12);

      doc.setFont('helvetica', 'normal');
      doc.text(finding, col2 + 4, y + 12);
      doc.text(vector, col3 + 4, y + 12);
      doc.text(expected, col4 + 4, y + 12);

      const isPass = result.includes('PASS');
      const isAccepted = result.includes('ACCEPTED');
      doc.setTextColor(isPass ? 30 : isAccepted ? 160 : 180, isPass ? 140 : isAccepted ? 100 : 50, isPass ? 30 : 50);
      doc.setFont('helvetica', 'bold');
      doc.text(result, col5 + 4, y + 12);
      y += rowH;
    });

    gap(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('\u2705 PASS = Attack fails, control enforced correctly', col1, y); y += 14;
    doc.text('\u26A0 ACCEPTED = Platform-level constraint; mitigations documented above', col1, y); y += 14;
    doc.text('\u274C FAIL = Vulnerability still exploitable (none in this sweep)', col1, y); y += 14;
    gap(10); divider();

    // ── 4. FILES CHANGED ──────────────────────────────────────────────────────
    addHeading('4. Files Changed (Phase 1)', 14, [40, 50, 70]);
    [
      'entities/Event.json \u2014 Added read RLS',
      'entities/Message.json \u2014 Added RLS schema',
      'entities/BlockedUser.json \u2014 Created with blocker_id-scoped RLS',
      'entities/CalendarToken.json \u2014 Created with user_id-scoped RLS',
      'entities/UserSession.json \u2014 Created with session lifecycle fields',
      'entities/AdminAuditLog.json \u2014 Created for admin action logging',
      'functions/validateSession.js \u2014 Session lifecycle enforcement',
      'functions/requireAdminAuth.js \u2014 DB-backed admin role verification',
      'functions/createCheckout.js \u2014 Strict schema + session gate + tenant scope',
      'functions/inviteParent.js \u2014 Role enum restricted to parent/grandparent',
      'functions/bulkInviteUsers.js \u2014 role field rejected via Zod strict schema',
      'functions/secureGetRecord.js \u2014 Entity allowlist-based IDOR gate',
      'functions/authorizeObjectAccess.js \u2014 JWT-derived identity only',
      'functions/icsCalendarFeed.js \u2014 Token auth + SHA-256 hash validation',
      'functions/generateCalendarToken.js \u2014 Token generation + revocation',
      'functions/blockUser.js \u2014 Server-side user blocking',
      'functions/unblockUser.js \u2014 Block removal',
      'functions/getMessagesFiltered.js \u2014 Block-filtered message endpoint',
      'functions/getBlockedIds.js \u2014 Block relationship query',
      'functions/adminDeleteAccount.js \u2014 Session gate added',
      'functions/deleteAccount.js \u2014 Session gate added',
      'functions/sendInvoiceReminder.js \u2014 Session gate added',
      'functions/sendFilmAssignment.js \u2014 Session gate added',
      'functions/sendPushNotification.js \u2014 Session gate added',
      'components/messages/ChatCanvas.jsx \u2014 Uses getMessagesFiltered',
      'components/messages/ThreadSidebar.jsx \u2014 Uses getMessagesFiltered',
    ].forEach(f => bullet(f));
    gap(10); divider();

    // ── 5. RISK DELTA ─────────────────────────────────────────────────────────
    addHeading('5. Risk Assessment Delta', 14, [40, 50, 70]);
    addText('BEFORE Phase 1', 0, { bold: true, size: 11, color: [180, 50, 50] });
    bullet('Privilege escalation via invite endpoints: HIGH');
    bullet('Mass assignment in checkout: HIGH');
    bullet('IDOR on Event and Message entities: HIGH');
    bullet('Unauthenticated calendar data access: MEDIUM');
    bullet('Cross-tenant data access via team_id injection: MEDIUM');
    bullet('Admin endpoints without DB-backed role check: HIGH');
    bullet('Token replay on sensitive writes post-logout: MEDIUM');
    bullet('No message block enforcement at API layer: MEDIUM');
    gap(6);
    addText('AFTER Phase 1 + QA Sweep', 0, { bold: true, size: 11, color: [40, 140, 70] });
    bullet('Privilege escalation: RESOLVED \u2014 Zod strict schemas block all role injection attempts.');
    bullet('Mass assignment: RESOLVED \u2014 All function schemas use .strict() mode.');
    bullet('IDOR: RESOLVED \u2014 Entity allowlist + JWT-derived identity enforced.');
    bullet('Calendar access: RESOLVED \u2014 SHA-256 token auth required for all feed requests.');
    bullet('Cross-tenant access: RESOLVED \u2014 Session-scoped team membership enforced.');
    bullet('Admin gate: RESOLVED \u2014 DB role query on every admin call + audit log.');
    bullet('Token replay: MITIGATED \u2014 Session gate on all sensitive writes; JWT expiry is platform-managed.');
    bullet('Block enforcement: MITIGATED \u2014 All UI paths use getMessagesFiltered; raw API requires auth.');
    gap(10); divider();

    // ── FOOTER ────────────────────────────────────────────────────────────────
    addText('CU Connect Security Audit Report \u2014 June 19, 2026', 0, { size: 9, color: [140, 140, 140] });
    addText('INTERNAL CONFIDENTIAL \u2014 Do not distribute outside the organization.', 0, { size: 9, color: [160, 60, 60] });

    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Page ${i} of ${pageCount}`, pageW - 100, 820);
    }

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const pdfFile = new File([pdfBytes], 'CU_Connect_Security_Audit_2026-06-19.pdf', { type: 'application/pdf' });

    const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: pdfFile });
    const fileUri = uploadRes.file_uri;

    if (!fileUri) {
      return Response.json({ error: 'Upload failed, no file_uri returned' }, { status: 500 });
    }

    const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: fileUri,
      expires_in: 86400,
    });

    return Response.json({ signed_url: signed.signed_url });

  } catch (error) {
    console.error('getSecurityReportUrl error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});