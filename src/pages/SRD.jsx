import { useEffect, useRef } from "react";
import jsPDF from "jspdf";

export default function SRD() {
  const generated = useRef(false);

  useEffect(() => {
    if (generated.current) return;
    generated.current = true;
    generateSRD();
  }, []);

  function generateSRD() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 0;

    const addPage = () => {
      doc.addPage();
      y = margin;
    };

    const checkY = (needed = 10) => {
      if (y + needed > 277) addPage();
    };

    const h1 = (text) => {
      checkY(14);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.text(text, margin, y);
      y += 10;
      doc.setDrawColor(180, 140, 60);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + contentW, y);
      y += 6;
    };

    const h2 = (text) => {
      checkY(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(50, 50, 50);
      doc.text(text, margin, y);
      y += 7;
    };

    const h3 = (text) => {
      checkY(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(70, 70, 70);
      doc.text(text, margin, y);
      y += 6;
    };

    const body = (text, indent = 0) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(text, contentW - indent);
      lines.forEach((line) => {
        checkY(6);
        doc.text(line, margin + indent, y);
        y += 5.5;
      });
      y += 1;
    };

    const bullet = (text, indent = 4) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(`• ${text}`, contentW - indent - 4);
      lines.forEach((line, i) => {
        checkY(6);
        doc.text(i === 0 ? line : `  ${line}`, margin + indent, y);
        y += 5.5;
      });
    };

    const spacer = (n = 4) => { y += n; };

    // ── Cover Page ──────────────────────────────────────────────────
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, 210, 297, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.setTextColor(180, 140, 60);
    doc.text("CU CONNECT", 105, 90, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(220, 220, 220);
    doc.text("System Requirements Document (SRD)", 105, 105, { align: "center" });

    doc.setFontSize(11);
    doc.setTextColor(160, 160, 160);
    doc.text("Version 1.0  |  Confidential — Internal Review Only", 105, 118, { align: "center" });
    doc.text("Security & Accessibility Assessment", 105, 126, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 105, 134, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("NOT FOR DISTRIBUTION — FOR INTERNAL REVIEW ONLY", 105, 270, { align: "center" });

    // ── Page 2+ ──────────────────────────────────────────────────────
    addPage();

    // 1. Introduction
    h1("1. Introduction");
    h2("1.1 Purpose");
    body("This System Requirements Document (SRD) defines the functional, non-functional, security, and accessibility requirements for CU Connect — a youth sports organization management platform. This document is intended for internal security and accessibility assessment only and is not for public distribution.");
    spacer();

    h2("1.2 Scope");
    body("CU Connect serves athletic organizations managing multiple sports (baseball, football, cheerleading, and others), providing tools for team management, parent/guardian communication, event scheduling, payments, and real-time notifications. The platform is delivered as a Progressive Web Application (PWA) accessible on mobile and desktop devices.");
    spacer();

    h2("1.3 Document Conventions");
    bullet("SHALL — mandatory requirement");
    bullet("SHOULD — recommended requirement");
    bullet("MAY — optional requirement");
    spacer();

    h2("1.4 Intended Audience");
    bullet("Security auditors and penetration testers");
    bullet("Accessibility compliance reviewers");
    bullet("Platform architects and senior developers");
    bullet("Athletic directors and organizational admins");
    spacer();

    h2("1.5 System Overview");
    body("CU Connect is a multi-tenant, role-based web application built on the Base44 platform (React/Vite frontend, Deno serverless backend functions, managed database). It serves three primary user classes: Administrators/Staff, Coaches, and Parents/Guardians.");
    spacer();

    // 2. System Architecture
    h1("2. System Architecture");
    h2("2.1 Technology Stack");
    h3("Frontend");
    bullet("React 18 with Vite build tooling");
    bullet("Tailwind CSS design system with custom dark theme");
    bullet("Shadcn/UI component library (Radix UI primitives)");
    bullet("TanStack React Query for server state management");
    bullet("React Router DOM v6 for client-side routing");
    bullet("Progressive Web App (PWA) with service worker for offline support and push notifications");
    spacer(2);
    h3("Backend");
    bullet("Base44 managed backend-as-a-service");
    bullet("Deno Deploy serverless functions for custom business logic");
    bullet("Base44 SDK v0.8.x for entity operations and authentication");
    bullet("Stripe for payment processing (live mode)");
    bullet("Web Push API for browser push notifications");
    spacer(2);
    h3("Data Layer");
    bullet("Base44 managed entity database (NoSQL document store)");
    bullet("Real-time subscriptions via Base44 SDK");
    bullet("File storage via Base44 UploadFile integration");
    spacer();

    h2("2.2 Deployment Environment");
    bullet("Hosted on Base44 cloud infrastructure");
    bullet("CDN-distributed frontend assets");
    bullet("Serverless backend functions on Deno Deploy");
    bullet("Published as installable PWA on iOS and Android");
    spacer();

    h2("2.3 Key Entities (Data Models)");
    body("The following primary entities exist in the system:");
    const entities = [
      ["User", "Authenticated user accounts with role-based access (admin, coach, user)"],
      ["Player", "Athlete profiles linked to teams and guardians"],
      ["Team", "Team records with sport, season, and coach associations"],
      ["Sport", "Sport definitions within an organization"],
      ["Event", "Scheduled games, practices, and tournaments"],
      ["PlayerGuardian", "Guardian-to-player relationships with permission scopes"],
      ["Channel / Message", "Team and direct messaging channels with message records"],
      ["Payment / InvoiceTemplate", "Financial records and invoice management"],
      ["Document / PlayerDocument", "Document storage and player-specific document tracking"],
      ["PushSubscription", "Web push subscription endpoints per user"],
      ["NotificationQueue", "Queued push notification delivery records"],
      ["AuditLog", "System-wide action audit trail"],
      ["RegistrationSubmission", "Online registration form submissions"],
      ["Announcement", "Organization-wide and team-specific announcements"],
    ];
    entities.forEach(([name, desc]) => {
      checkY(7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`${name}:`, margin + 4, y);
      doc.setFont("helvetica", "normal");
      const labelW = doc.getTextWidth(`${name}: `);
      const lines = doc.splitTextToSize(desc, contentW - 4 - labelW);
      doc.text(lines[0], margin + 4 + labelW, y);
      y += 5.5;
      if (lines.length > 1) {
        lines.slice(1).forEach(l => { doc.text(l, margin + 4 + labelW, y); y += 5.5; });
      }
    });
    spacer();

    // 3. User Roles & Access Control
    h1("3. User Roles & Access Control");
    h2("3.1 Role Definitions");

    h3("Administrator (admin)");
    bullet("Full system access across all teams and organizations");
    bullet("User management: invite, promote, demote, delete accounts");
    bullet("Financial administration: create invoices, view all payments");
    bullet("Content management: legal pages, announcements, sponsors");
    bullet("System configuration: sport setup, field status, audit log access");
    bullet("Access to all backend admin-only functions");
    spacer(2);

    h3("Coach / Staff");
    bullet("Team-scoped access: manage assigned team's roster, events, playbooks");
    bullet("Can invite parents and manage player profiles within their team");
    bullet("Access to film room, practice plans, depth charts");
    bullet("Cannot access financial data or system-wide settings");
    spacer(2);

    h3("Parent / Guardian (user)");
    bullet("Access limited to teams/players linked via PlayerGuardian records");
    bullet("View-only schedule, team announcements, and player documents");
    bullet("Messaging within permitted channels");
    bullet("RSVP, carpool coordination, volunteer sign-ups");
    bullet("Payment submission for assigned invoices");
    bullet("Scoped permissions per guardian record: view_calendar, view_messages, financial_contributor");
    spacer(2);

    h3("Athlete (promoted user)");
    bullet("Promoted from player record by parent or admin");
    bullet("Access to playbooks, film assignments, and personal stats");
    bullet("Cannot access other players' data or administrative functions");
    spacer();

    h2("3.2 Access Control Implementation");
    bullet("Role stored on User entity, enforced in both frontend route guards and backend functions");
    bullet("Backend admin-only functions validate user.role === 'admin' before execution");
    bullet("Frontend StaffRoute and useAdminGuard hooks enforce role-based UI gating");
    bullet("PlayerGuardian permission arrays control granular parent access");
    bullet("Base44 platform enforces entity-level read/write rules");
    spacer();

    // 4. Functional Requirements
    h1("4. Functional Requirements");

    h2("4.1 Authentication & Session Management");
    bullet("FR-AUTH-01: The system SHALL authenticate users via Base44's managed authentication service");
    bullet("FR-AUTH-02: Sessions SHALL persist across browser/app restarts via platform-managed tokens");
    bullet("FR-AUTH-03: Users SHALL be able to log out, which invalidates the active session");
    bullet("FR-AUTH-04: Unauthenticated users attempting to access protected routes SHALL be redirected to login");
    bullet("FR-AUTH-05: The system SHALL support role-based route access control on both client and server");
    spacer();

    h2("4.2 Team & Roster Management");
    bullet("FR-TEAM-01: Admins SHALL be able to create, edit, and archive teams");
    bullet("FR-TEAM-02: Players SHALL be assignable to teams with jersey numbers and positions");
    bullet("FR-TEAM-03: Rosters SHALL support depth chart management with unit/slot/order");
    bullet("FR-TEAM-04: Team rosters SHALL be exportable as PDF when roster_published flag is true");
    bullet("FR-TEAM-05: Coach contact information SHALL be visible to linked parents");
    spacer();

    h2("4.3 Scheduling & Events");
    bullet("FR-SCHED-01: Admins/coaches SHALL be able to create events (game, practice, tournament)");
    bullet("FR-SCHED-02: Events SHALL support location, time, uniform info, and notes fields");
    bullet("FR-SCHED-03: Parents SHALL receive push notifications when new events are created for their team");
    bullet("FR-SCHED-04: Parents SHALL be able to RSVP to events");
    bullet("FR-SCHED-05: Events SHALL be exportable to standard calendar formats (ICS/iCal)");
    bullet("FR-SCHED-06: Deep-link URLs SHALL route parents directly to specific events (?eventId=)");
    spacer();

    h2("4.4 Messaging & Communication");
    bullet("FR-MSG-01: The system SHALL support team channels, direct messages, carpool channels, and announcements");
    bullet("FR-MSG-02: Broadcast-only channels SHALL restrict posting to admins/coaches");
    bullet("FR-MSG-03: Messages SHALL support text content, event cards, and carpool request cards");
    bullet("FR-MSG-04: Unread message counts SHALL be tracked per user per channel");
    bullet("FR-MSG-05: Messages SHALL support emoji reactions and threaded replies");
    bullet("FR-MSG-06: Users SHALL be able to block other users");
    bullet("FR-MSG-07: Users SHALL be able to report messages; reports SHALL be reviewable by admins");
    bullet("FR-MSG-08: Push notifications SHALL be sent when new messages are received");
    spacer();

    h2("4.5 Payments & Finance");
    bullet("FR-PAY-01: Admins SHALL be able to create invoice templates and assign them to players/teams");
    bullet("FR-PAY-02: Payment processing SHALL use Stripe in live mode");
    bullet("FR-PAY-03: Parents SHALL be able to view and pay assigned invoices within the portal");
    bullet("FR-PAY-04: Payment status SHALL be tracked and visible to both parents and admins");
    bullet("FR-PAY-05: Stripe webhooks SHALL update payment records on successful transactions");
    bullet("FR-PAY-06: Checkout SHALL be blocked when running in an iframe context");
    spacer();

    h2("4.6 Push Notifications");
    bullet("FR-NOTIF-01: The system SHALL support Web Push Notifications via the Push API");
    bullet("FR-NOTIF-02: Users SHALL be able to subscribe/unsubscribe from push notifications");
    bullet("FR-NOTIF-03: Notification preferences SHALL be configurable per category (schedule, messages, weather, snacks, documents)");
    bullet("FR-NOTIF-04: Notifications SHALL include deep-link URLs to relevant content");
    bullet("FR-NOTIF-05: A notification queue entity SHALL deduplicate notifications using dedup_key");
    bullet("FR-NOTIF-06: iOS users SHALL see an install banner prompting PWA installation for notification support");
    spacer();

    h2("4.7 Documents & Signatures");
    bullet("FR-DOC-01: Admins SHALL be able to upload and manage team/org documents");
    bullet("FR-DOC-02: Signature requests SHALL be sendable to parents for required documents");
    bullet("FR-DOC-03: Document completion status SHALL be trackable per player");
    bullet("FR-DOC-04: Automated reminders SHALL be sent for incomplete document signatures");
    spacer();

    // 5. Non-Functional Requirements
    h1("5. Non-Functional Requirements");

    h2("5.1 Performance");
    bullet("NFR-PERF-01: Initial page load SHALL complete within 3 seconds on a 4G mobile connection");
    bullet("NFR-PERF-02: Entity queries SHALL be paginated; no full dataset loads into memory");
    bullet("NFR-PERF-03: React Query caching SHALL minimize redundant API calls");
    bullet("NFR-PERF-04: Images and media SHALL be served via CDN");
    bullet("NFR-PERF-05: Real-time subscriptions SHALL replace polling wherever possible");
    spacer();

    h2("5.2 Scalability");
    bullet("NFR-SCALE-01: The system SHALL support multiple organizations and sports on a shared platform");
    bullet("NFR-SCALE-02: Backend functions SHALL be stateless and horizontally scalable");
    bullet("NFR-SCALE-03: Entity subscriptions SHALL degrade gracefully under high load");
    spacer();

    h2("5.3 Reliability & Availability");
    bullet("NFR-REL-01: The system SHOULD target 99.9% uptime (dependent on Base44 SLA)");
    bullet("NFR-REL-02: Backend functions SHALL include try/catch error handling and return structured error responses");
    bullet("NFR-REL-03: Service worker SHALL enable basic offline functionality for previously loaded content");
    bullet("NFR-REL-04: Push notification delivery failures SHALL be logged and tracked in NotificationQueue");
    spacer();

    h2("5.4 Maintainability");
    bullet("NFR-MAINT-01: Frontend code SHALL be organized into focused, single-responsibility components");
    bullet("NFR-MAINT-02: Backend functions SHALL be independently deployable with no local imports");
    bullet("NFR-MAINT-03: Entity schemas SHALL be versioned and documented");
    spacer();

    // 6. Security Requirements
    h1("6. Security Requirements");

    h2("6.1 Authentication Security");
    bullet("SEC-AUTH-01: Authentication tokens SHALL be managed exclusively by the Base44 platform; custom token storage in localStorage is prohibited");
    bullet("SEC-AUTH-02: All session tokens SHALL be invalidated server-side on logout");
    bullet("SEC-AUTH-03: Backend functions SHALL validate user identity via base44.auth.me() before processing privileged requests");
    bullet("SEC-AUTH-04: Admin-only backend functions SHALL verify user.role === 'admin' and return HTTP 403 if not met");
    bullet("SEC-AUTH-05: The system SHALL NOT expose authentication tokens in frontend code, logs, or URLs");
    spacer();

    h2("6.2 Authorization & Data Access");
    bullet("SEC-AUTHZ-01: Parents SHALL only access data for players linked via verified PlayerGuardian records");
    bullet("SEC-AUTHZ-02: Permission arrays on PlayerGuardian SHALL be enforced before exposing financial, calendar, or messaging data");
    bullet("SEC-AUTHZ-03: Cross-tenant data isolation SHALL be enforced; users SHALL NOT access data belonging to other organizations");
    bullet("SEC-AUTHZ-04: Athlete-promoted accounts SHALL be scoped to their own player record only");
    bullet("SEC-AUTHZ-05: Admin role escalation SHALL only be performable by existing admins");
    spacer();

    h2("6.3 Payment Security");
    bullet("SEC-PAY-01: All payment processing SHALL occur server-side via Stripe; raw card data SHALL never touch application servers");
    bullet("SEC-PAY-02: Stripe webhook endpoints SHALL validate signatures using STRIPE_WEBHOOK_SECRET before processing");
    bullet("SEC-PAY-03: Stripe secret keys SHALL be stored as environment secrets and never exposed to the frontend");
    bullet("SEC-PAY-04: Live mode Stripe keys (STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY) SHALL be used in production");
    bullet("SEC-PAY-05: Checkout sessions SHALL be blocked in iframe contexts to prevent clickjacking attacks");
    bullet("SEC-PAY-06: All Stripe API calls SHALL include base44_app_id in metadata for transaction traceability");
    spacer();

    h2("6.4 Data Protection");
    bullet("SEC-DATA-01: Personally identifiable information (PII) — including names, emails, phone numbers, medical notes — SHALL be stored in the managed database, not in client-side storage");
    bullet("SEC-DATA-02: File uploads SHALL use Base44 UploadFile integration; binary/base64 data SHALL NOT be stored directly on entity fields");
    bullet("SEC-DATA-03: Push subscription keys (p256dh, auth) SHALL be stored securely and used only for intended notification delivery");
    bullet("SEC-DATA-04: Audit logs SHALL capture all significant administrative actions for forensic review");
    bullet("SEC-DATA-05: Medical notes and emergency contact data SHALL only be visible to admin and authorized coaching staff");
    spacer();

    h2("6.5 API & Backend Security");
    bullet("SEC-API-01: Backend functions SHALL only be invokable via the Base44 SDK from authenticated frontend contexts or validated webhook sources");
    bullet("SEC-API-02: Webhook endpoints SHALL validate request authenticity via provider signatures or shared secrets before processing");
    bullet("SEC-API-03: Environment secrets SHALL be accessed only via Deno.env.get(); hardcoded credentials are prohibited");
    bullet("SEC-API-04: Backend functions SHALL NOT perform file write operations outside the /tmp directory");
    bullet("SEC-API-05: Error responses SHALL NOT expose stack traces, internal paths, or sensitive configuration data to clients");
    bullet("SEC-API-06: All cross-origin requests SHALL be handled by the Base44 platform's managed CORS policy");
    spacer();

    h2("6.6 Push Notification Security");
    bullet("SEC-PUSH-01: VAPID public/private keys SHALL be stored as secrets and never exposed in frontend code");
    bullet("SEC-PUSH-02: Push subscription endpoints SHALL be validated before delivery attempts");
    bullet("SEC-PUSH-03: Expired or invalid push subscriptions SHALL be deactivated (is_active = false) to prevent endpoint enumeration");
    bullet("SEC-PUSH-04: Notification payloads SHALL not contain sensitive PII beyond what is necessary for display");
    spacer();

    h2("6.7 Messaging Security");
    bullet("SEC-MSG-01: Broadcast-only channels SHALL enforce posting restrictions server-side, not only on the frontend");
    bullet("SEC-MSG-02: Message content SHALL be sanitized before storage to prevent XSS injection");
    bullet("SEC-MSG-03: Message reports SHALL be reviewed by admins before any enforcement action is taken");
    bullet("SEC-MSG-04: Blocked user relationships SHALL be honored in message visibility on both client and server");
    spacer();

    h2("6.8 Account Management Security");
    bullet("SEC-ACCT-01: Account deletion SHALL cascade to remove or anonymize all associated PII");
    bullet("SEC-ACCT-02: Admin account deletion (adminDeleteAccount) SHALL require admin role verification");
    bullet("SEC-ACCT-03: Parent invitations SHALL be sent only to verified email addresses via the platform invitation system");
    bullet("SEC-ACCT-04: Athlete account promotion SHALL require explicit authorization from a linked parent or admin");
    spacer();

    // 7. Accessibility Requirements
    h1("7. Accessibility Requirements");

    h2("7.1 Standards Compliance");
    bullet("ACC-STD-01: The application SHOULD conform to WCAG 2.1 Level AA guidelines");
    bullet("ACC-STD-02: The application SHALL support screen readers on iOS (VoiceOver) and Android (TalkBack)");
    bullet("ACC-STD-03: All interactive elements SHALL have appropriate ARIA labels or accessible names");
    spacer();

    h2("7.2 Visual Accessibility");
    bullet("ACC-VIS-01: Text contrast ratios SHALL meet WCAG AA minimums (4.5:1 for normal text, 3:1 for large text)");
    bullet("ACC-VIS-02: The application SHALL NOT rely solely on color to convey information");
    bullet("ACC-VIS-03: Interactive elements SHALL have visible focus indicators");
    bullet("ACC-VIS-04: The application SHALL support system-level font scaling without layout breakage");
    bullet("ACC-VIS-05: All images and icons that convey information SHALL have descriptive alt text");
    spacer();

    h2("7.3 Motor Accessibility");
    bullet("ACC-MOT-01: All touch targets SHALL have a minimum size of 44x44 CSS pixels (iOS HIG / WCAG 2.5.5)");
    bullet("ACC-MOT-02: All functionality SHALL be operable via keyboard navigation");
    bullet("ACC-MOT-03: Touch interactions SHALL use manipulation CSS to prevent double-tap zoom interference");
    bullet("ACC-MOT-04: Swipe and gesture interactions SHOULD have alternative button-based equivalents");
    spacer();

    h2("7.4 Cognitive Accessibility");
    bullet("ACC-COG-01: Error messages SHALL be descriptive and provide corrective guidance");
    bullet("ACC-COG-02: Critical actions (account deletion, payment submission) SHALL require confirmation dialogs");
    bullet("ACC-COG-03: Loading states SHALL be clearly indicated with visual feedback");
    bullet("ACC-COG-04: Navigation SHALL be consistent and predictable across all sections");
    spacer();

    h2("7.5 Mobile & PWA Accessibility");
    bullet("ACC-MOB-01: The application SHALL be fully functional on viewport widths from 320px to 1920px");
    bullet("ACC-MOB-02: Safe area insets (iOS notch, Android cutout) SHALL be respected in layout");
    bullet("ACC-MOB-03: The application SHALL prevent body scroll bounce (overscroll-behavior: none) to prevent disorientation");
    bullet("ACC-MOB-04: Modals and overlays SHALL be constrained to the visible viewport to prevent hidden content");
    bullet("ACC-MOB-05: iOS install banner SHALL guide users through PWA installation for native-like access");
    spacer();

    h2("7.6 Internationalization & Language");
    bullet("ACC-I18N-01: The application content is currently in English; RTL language support is not implemented in v1.0");
    bullet("ACC-I18N-02: Date and time displays SHOULD use locale-aware formatting");
    bullet("ACC-I18N-03: Timezone handling SHALL respect organization-configured or user-device timezone");
    spacer();

    // 8. Integration Requirements
    h1("8. Integration Requirements");

    h2("8.1 Stripe Payment Integration");
    bullet("INT-STRIPE-01: Integration uses Stripe Checkout Sessions API");
    bullet("INT-STRIPE-02: Live mode keys are active; test mode keys are available for staging");
    bullet("INT-STRIPE-03: Webhook handler validates signatures; processes checkout.session.completed events");
    spacer();

    h2("8.2 Web Push Notifications");
    bullet("INT-PUSH-01: Uses Web Push Protocol with VAPID authentication");
    bullet("INT-PUSH-02: Service worker (sw.js + sw-push-patch) handles background push receipt and display");
    bullet("INT-PUSH-03: Push subscription management via saveSubscription backend function");
    spacer();

    h2("8.3 Calendar Integration");
    bullet("INT-CAL-01: ICS calendar feed generated via icsCalendarFeed backend function");
    bullet("INT-CAL-02: Supports subscription URL for Apple Calendar, Google Calendar, and Outlook");
    spacer();

    h2("8.4 AI/LLM Integration");
    bullet("INT-AI-01: Base44 InvokeLLM core integration used for stat extraction from uploaded images/PDFs");
    bullet("INT-AI-02: extractBaseballStats and extractTeamStats functions process uploaded media");
    spacer();

    h2("8.5 Weather Integration");
    bullet("INT-WEATHER-01: gameDayWeatherAlert function provides game-day weather notifications");
    bullet("INT-WEATHER-02: Weather data is supplemented with internet context via InvokeLLM");
    spacer();

    // 9. Constraints & Assumptions
    h1("9. Constraints & Assumptions");

    h2("9.1 Platform Constraints");
    bullet("The application is built exclusively on Base44 platform; infrastructure decisions are managed by Base44");
    bullet("Frontend technology is fixed: React 18, Vite, Tailwind CSS, Shadcn/UI");
    bullet("Backend functions are Deno Deploy serverless; Node.js-specific APIs are not available");
    bullet("No server-side rendering (SSR); this is a client-rendered SPA");
    spacer();

    h2("9.2 Assumptions");
    bullet("Users access the application on modern browsers (Chrome 90+, Safari 14+, Firefox 90+)");
    bullet("Push notification support requires HTTPS; HTTP contexts are not supported");
    bullet("Live video streaming is not implemented in v1.0; it is planned as a future phase");
    bullet("The platform organization is assumed to be a single athletic organization (single-tenant usage model)");
    spacer();

    h2("9.3 Known Limitations");
    bullet("iOS Safari has limited Web Push support; users must install as PWA for full notification functionality");
    bullet("Offline mode is read-only; write operations require network connectivity");
    bullet("File write operations in backend functions are ephemeral (/tmp only); no persistent server-side file storage");
    spacer();

    // 10. Revision History
    h1("10. Revision History");
    checkY(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    const tableX = margin;
    const colW = [25, 30, 40, contentW - 95];
    const headers = ["Version", "Date", "Author", "Description"];
    let tx = tableX;
    headers.forEach((h, i) => { doc.text(h, tx, y); tx += colW[i]; });
    y += 2;
    doc.setDrawColor(150, 150, 150);
    doc.line(margin, y, margin + contentW, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const rows = [
      ["1.0", new Date().toLocaleDateString("en-US"), "System", "Initial SRD — security & accessibility review"],
    ];
    rows.forEach(row => {
      tx = tableX;
      row.forEach((cell, i) => { doc.text(cell, tx, y); tx += colW[i]; });
      y += 6;
    });
    spacer();

    // Footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text("CU Connect — System Requirements Document v1.0 | CONFIDENTIAL", margin, 290);
      doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageW - margin, 290, { align: "right" });
      doc.setDrawColor(180, 140, 60);
      doc.setLineWidth(0.3);
      doc.line(margin, 286, pageW - margin, 286);
    }

    doc.save("CU_Connect_SRD_v1.0.pdf");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">📄</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">CU Connect SRD</h1>
        <p className="text-muted-foreground mb-6">
          Your System Requirements Document is being generated and downloaded automatically.
        </p>
        <p className="text-xs text-muted-foreground border border-border rounded-lg p-3 bg-card">
          <span className="font-semibold text-yellow-500">⚠ Confidential</span><br />
          This document is for internal security & accessibility review only.
          Not for public distribution.
        </p>
        <button
          onClick={() => { generated.current = false; generateSRD(); }}
          className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Re-download PDF
        </button>
      </div>
    </div>
  );
}