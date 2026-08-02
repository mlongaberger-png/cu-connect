import { jsPDF } from "jspdf";

// ═══════════════════════════════════════════════════════════════════════════════
// CU Connect — Comprehensive Application Documentation PDF Builder
// Generates a multi-page PDF covering: goal, architecture, entities, functions,
// automations, pages, key systems, security, issues, successes, and next steps.
// ═══════════════════════════════════════════════════════════════════════════════

const NAVY = [20, 30, 48];
const GOLD = [200, 168, 75];
const GRAY = [55, 55, 55];
const LIGHT_GRAY = [130, 130, 130];
const RED = [180, 50, 50];
const GREEN = [30, 130, 60];

export default function buildAppDocumentation() {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - margin * 2;
  let y = margin;
  let pageNum = 1;
  const toc = []; // { title, page }

  // ── Helper: page break ──
  const checkPage = (needed = 20) => {
    if (y + needed > pageH - 40) {
      doc.addPage();
      pageNum++;
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text("CU CONNECT — COMPREHENSIVE APPLICATION DOCUMENTATION", margin, 16);
    doc.text(`Page ${pageNum}`, pageW - margin, 16, { align: "right" });
    y = 42;
  };

  // ── Helper: headings ──
  const h1 = (text, registerToc = true) => {
    checkPage(40);
    if (y > 60) y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, y);
    y += 4;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageW - margin, y);
    y += 18;
    if (registerToc) toc.push({ title: text, page: pageNum });
  };

  const h2 = (text) => {
    checkPage(30);
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(text, margin, y);
    y += 14;
  };

  const h3 = (text) => {
    checkPage(20);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text(text, margin, y);
    y += 12;
  };

  // ── Helper: paragraph ──
  const p = (text, opts = {}) => {
    const sz = opts.size || 9.5;
    const lines = doc.splitTextToSize(text, contentW - (opts.indent || 0));
    lines.forEach((line) => {
      checkPage(sz + 4);
      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
      doc.setFontSize(sz);
      doc.setTextColor(...(opts.color || GRAY));
      doc.text(line, margin + (opts.indent || 0), y);
      y += sz + 3.5;
    });
  };

  // ── Helper: bullet ──
  const bullet = (text, indent = 14) => {
    const sz = 9;
    const lines = doc.splitTextToSize(text, contentW - indent - 12);
    lines.forEach((line, i) => {
      checkPage(sz + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(sz);
      doc.setTextColor(...GRAY);
      if (i === 0) doc.text("\u2022", margin + indent, y);
      doc.text(line, margin + indent + 12, y);
      y += sz + 3;
    });
  };

  // ── Helper: labeled line (bold label + text) ──
  const labeled = (label, text) => {
    const sz = 9;
    const lines = doc.splitTextToSize(text, contentW - 120);
    lines.forEach((line, i) => {
      checkPage(sz + 4);
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      doc.setFontSize(sz);
      if (i === 0) {
        doc.setTextColor(...NAVY);
        doc.text(label, margin, y);
      }
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...GRAY);
      doc.text(line, margin + 110, y);
      y += sz + 3;
    });
  };

  // ── Helper: code block ──
  const codeBlock = (text) => {
    const sz = 7.5;
    const lines = doc.splitTextToSize(text, contentW - 20);
    const blockH = lines.length * (sz + 3) + 10;
    checkPage(blockH + 4);
    doc.setFillColor(245, 245, 248);
    doc.roundedRect(margin, y, contentW, blockH, 3, 3, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(sz);
    doc.setTextColor(50, 50, 50);
    lines.forEach((line, i) => {
      doc.text(line, margin + 8, y + 12 + i * (sz + 3));
    });
    y += blockH + 6;
  };

  // ── Helper: callout box ──
  const callout = (title, text, type = "info") => {
    const colors = {
      info: { bg: [240, 248, 255], border: [80, 120, 200], title: [40, 80, 160] },
      success: { bg: [240, 252, 244], border: GREEN, title: GREEN },
      warning: { bg: [255, 248, 230], border: [200, 140, 30], title: [160, 100, 20] },
      danger: { bg: [255, 240, 240], border: RED, title: RED },
    };
    const c = colors[type] || colors.info;
    const lines = doc.splitTextToSize(text, contentW - 20);
    const blockH = lines.length * 12 + 20;
    checkPage(blockH + 4);
    doc.setFillColor(...c.bg);
    doc.setDrawColor(...c.border);
    doc.setLineWidth(1);
    doc.roundedRect(margin, y, contentW, blockH, 4, 4, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...c.title);
    doc.text(title, margin + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...c.title.map(v => Math.min(v + 20, 200)));
    lines.forEach((line, i) => {
      doc.text(line, margin + 10, y + 26 + i * 12);
    });
    y += blockH + 8;
  };

  // ── Helper: table ──
  const table = (headers, rows, colWidths) => {
    const sz = 7.5;
    const rowH = 16;
    const totalW = colWidths.reduce((a, b) => a + b, 0);

    // Header row
    checkPage(rowH + 4);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, totalW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sz);
    doc.setTextColor(...GOLD);
    let xPos = margin;
    headers.forEach((h, i) => {
      doc.text(h, xPos + 4, y + 11);
      xPos += colWidths[i];
    });
    y += rowH;

    // Data rows
    rows.forEach((row, idx) => {
      checkPage(rowH + 4);
      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 250);
        doc.rect(margin, y, totalW, rowH, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(sz);
      doc.setTextColor(...GRAY);
      xPos = margin;
      row.forEach((cell, i) => {
        const cellLines = doc.splitTextToSize(String(cell || ""), colWidths[i] - 8);
        doc.text(cellLines[0] || "", xPos + 4, y + 11);
        xPos += colWidths[i];
      });
      y += rowH;
    });
    y += 6;
  };

  // ── Helper: divider ──
  const divider = (color = [210, 210, 210]) => {
    checkPage(16);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  // ── Helper: page break ──
  const pageBreak = () => {
    doc.addPage();
    pageNum++;
    y = margin;
    drawHeader();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setFillColor(12, 12, 12);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 160, pageW, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...GOLD);
  doc.text("CU Connect", margin, 80);

  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Comprehensive Application Documentation", margin, 110);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(180, 180, 180);
  doc.text("A Sports Organization Management Platform", margin, 130);
  doc.text("Full Technical Deep-Dive | Architecture | Entity Model | Security |", margin, 145);
  doc.text("Issues & Remediation | Successes | Current State | Next Steps", margin, 158);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Document Date: August 2, 2026`, margin, 200);
  doc.text(`Version: 1.0`, margin, 215);
  doc.text(`Classification: Internal — For AI Review & Development Planning`, margin, 230);
  doc.text(`Prepared by: Base44 Development Agent`, margin, 245);

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(margin, 270, pageW - margin, 270);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD);
  doc.text("DOCUMENT PURPOSE", margin, 295);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  const purposeLines = doc.splitTextToSize(
    "This document provides a complete, end-to-end overview of the CU Connect application — from its founding goal through its current implementation state. It is designed to be handed off to an AI agent (Claude) for review, analysis, and recommendation of changes. It covers the product vision, technical architecture, full entity data model, all backend functions, all automations, every frontend page, deep-dives into each key subsystem, the security model, all identified issues and their remediation status, notable successes, and a roadmap of recommended next steps.",
    contentW
  );
  purposeLines.forEach((line, i) => {
    doc.text(line, margin, 315 + i * 13);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageNum++;
  y = margin;
  drawHeader();

  // We'll fill TOC at the end after all sections are registered
  const tocStartPage = pageNum;
  const tocPlaceholders = [];

  const renderTocLater = () => {
    // Save current state
    const savedY = y;
    const savedPage = pageNum;
    // Go back to TOC page
    doc.setPage(tocStartPage);
    y = 60;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text("Table of Contents", margin, y);
    y += 4;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    toc.forEach((item) => {
      checkPage(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...GRAY);
      const dots = ".".repeat(Math.max(3, 70 - item.title.length - 4));
      doc.text(item.title, margin, y);
      doc.setTextColor(...LIGHT_GRAY);
      doc.text(dots, margin + doc.getTextWidth(item.title) + 4, y);
      doc.setTextColor(...NAVY);
      doc.setFont("helvetica", "bold");
      doc.text(String(item.page), pageW - margin, y, { align: "right" });
      y += 16;
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: PROJECT OVERVIEW & GOAL
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("1. Project Overview & Goal");

  h2("Mission Statement");
  p("CU Connect is a comprehensive sports organization management platform designed for a youth athletics program. The platform serves as a single, unified hub connecting athletic directors, coaches, parents, grandparents, relatives, and athletes — replacing fragmented tools (group texts, paper flyers, spreadsheets, standalone apps) with one cohesive system that manages scheduling, team communication, RSVPs, carpool coordination, payments, volunteer coordination, documents, playbooks, film study, statistics, and more.");

  h2("The Problem");
  p("Before CU Connect, the organization relied on a patchwork of disconnected tools:");
  bullet("Group text messages that buried important announcements in unrelated chatter and excluded non-parent guardians like grandparents.");
  bullet("Paper flyers and PDF schedules that were lost, outdated, or inaccessible on mobile devices.");
  bullet("Manual RSVP tracking via reply texts, making attendance unpredictable and event planning difficult.");
  bullet("Spreadsheets for payments and volunteer coordination that only the athletic director could access.");
  bullet("No central record of communications, documents, or compliance — creating liability and operational risk.");
  bullet("No carpool coordination — parents arranged rides ad hoc, often leaving athletes stranded.");
  bullet("No film study or playbook distribution — coaches had no way to share plays or track athlete engagement.");

  h2("The Solution");
  p("CU Connect centralizes every aspect of youth sports organization management into a single mobile-first PWA (Progressive Web App) that publishes to iOS and Android from the same codebase. The platform is role-aware: athletic directors and coaches see management tools; parents, grandparents, and relatives see a family-focused portal; athletes (when promoted) see their assignments, playbooks, and film. Every user type gets the right information at the right time, with push notifications, in-app messaging, and real-time updates.");

  h2("Target Users");
  table(
    ["Role", "Description", "Primary Access"],
    [
      ["Admin", "Platform administrator with full access to all features and data", "Everything"],
      ["Athletic Director", "Manages sports, teams, coaches, finances, and operations", "All staff tools + finance"],
      ["Coach", "Manages their team's schedule, roster, messaging, playbooks, film", "Team-scoped tools"],
      ["Parent", "Primary guardian — manages RSVPs, payments, documents, messaging", "Parent Portal"],
      ["Grandparent", "Extended family member with view access to their grandchild", "Limited Parent Portal"],
      ["Relative", "Other family member with limited view access", "Limited Parent Portal"],
      ["Athlete", "Promoted player with their own account for playbooks, film, stats", "Athlete Portal"],
    ],
    [80, 280, 110]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: TECHNOLOGY STACK & ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("2. Technology Stack & Architecture");

  h2("Platform Foundation");
  p("CU Connect is built on the Base44 Backend-as-a-Service platform, which provides authentication, database, file storage, integrations, hosting, and deployment. The frontend is a React + Tailwind CSS application bundled with Vite, published as a Progressive Web App (PWA) with native iOS and Android builds via Capacitor.");

  h2("Frontend Stack");
  bullet("React 18 — UI framework (hooks, functional components)");
  bullet("Tailwind CSS — utility-first styling with a dark theme design system");
  bullet("Vite — build tool and dev server");
  bullet("React Router DOM — client-side routing (SPA)");
  bullet("TanStack Query (React Query v5) — server state management, caching, optimistic updates");
  bullet("shadcn/ui (Radix UI primitives) — accessible component library");
  bullet("lucide-react — icon system");
  bullet("date-fns — date/time formatting and manipulation");
  bullet("framer-motion — animations and transitions");
  bullet("recharts — data visualization and charts");
  bullet("react-leaflet — interactive maps (location features)");
  bullet("@hello-pangea/dnd — drag-and-drop (depth charts, play reordering)");
  bullet("jsPDF — PDF document generation (reports, rosters, documentation)");
  bullet("react-quill — rich text editing (announcements, legal pages)");
  bullet("react-markdown — markdown rendering");

  h2("Mobile & Native");
  bullet("Capacitor — native runtime wrapping the PWA for iOS and Android app store distribution");
  bullet("@capacitor-firebase/messaging — push notification delivery on native devices");
  bullet("Firebase Cloud Messaging — cross-platform push notification transport");
  bullet("Service Worker (public/sw.js) — PWA offline support, push notification handling, install prompt");
  bullet("Apple Private Relay email support — handles iCloud hide-my-email addresses via linkRelayEmail backend function");

  h2("Backend Stack");
  bullet("Base44 Entities — JSON schema-based data models with built-in CRUD API, filtering, sorting, and realtime subscriptions");
  bullet("Base44 Functions — Deno TypeScript HTTP handlers for external API integrations, cron jobs, and entity triggers");
  bullet("Base44 Automations — scheduled (cron), entity-triggered, and connector webhook automations that run backend functions automatically");
  bullet("Base44 Row-Level Security (RLS) — per-entity access control with user conditions and data matching");
  bullet("Stripe — payment processing via Stripe Checkout and webhooks (Live Mode)");
  bullet("AWS EventBridge — scheduled task execution for cron-based automations");

  h2("Integrations");
  bullet("Core.InvokeLLM — AI/LLM calls (various models: GPT-5, Gemini, Claude) for data extraction, content generation");
  bullet("Core.UploadFile / UploadPrivateFile — file storage for documents, photos, playbooks, film clips");
  bullet("Core.GenerateImage — AI image generation (avatars, etc.)");
  bullet("Core.GenerateVideo — AI video generation");
  bullet("Core.GenerateSpeech — text-to-speech for accessibility");
  bullet("Core.TranscribeAudio — audio transcription (whistle, voice notes)");
  bullet("Core.SendEmail — email notifications to registered app users");
  bullet("Core.ExtractDataFromUploadedFile — structured data extraction from CSV, Excel, PDF, images");
  bullet("Stripe — checkout sessions, payment intents, webhook processing");

  h2("Design System");
  p("The app uses a custom dark theme with a gold accent color scheme. Design tokens are defined in src/index.css and mapped in tailwind.config.js:");
  table(
    ["Token", "Value (HSL)", "Usage"],
    [
      ["--background", "0 0% 7%", "App background (very dark)"],
      ["--foreground", "43 30% 90%", "Primary text (warm white)"],
      ["--card", "0 0% 10%", "Card surfaces"],
      ["--primary", "43 55% 54%", "Gold accent (buttons, highlights)"],
      ["--border", "0 0% 18%", "Borders and dividers"],
      ["--muted-foreground", "0 0% 55%", "Secondary text"],
      ["--destructive", "0 72% 51%", "Error/destructive actions"],
      ["--sidebar-background", "0 0% 5%", "Navigation sidebar"],
    ],
    [130, 180, 160]
  );
  p("The theme uses the Inter font family. The app is mobile-first with safe-area inset support for iOS notch/home indicator, a persistent bottom tab bar, and a scroll container architecture managed by #main-scroll-container.");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: USER ROLES & AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("3. User Roles & Authentication");

  h2("Authentication Model");
  p("Authentication is handled entirely by the Base44 platform — the app does not implement its own auth backend. The platform provides JWT-based sessions, email/password login, email verification, and session management. The app's AuthContext wraps the Base44 auth SDK to provide user state, loading states, and error handling across the component tree.");

  h2("Role System");
  p("Every user has a role field on their User entity that determines their access level. Roles are assigned during onboarding or by an admin/athletic director. The role system drives navigation, page access (via StaffRoute), and Row-Level Security rules on every entity.");
  table(
    ["Role", "Who Gets It", "Key Capabilities"],
    [
      ["admin", "Platform superuser", "Full access to everything, user management, all entities"],
      ["athletic_director", "Organization leader", "Sports, teams, coaches, finance, all staff tools"],
      ["coach", "Team coach", "Team-scoped schedule, roster, messaging, playbooks, film, stats"],
      ["parent", "Primary guardian", "Parent Portal: RSVPs, payments, documents, messaging"],
      ["grandparent", "Extended family", "Limited view access to linked athletes"],
      ["relative", "Other family", "Limited view access to linked athletes"],
      ["athlete", "Promoted player", "Own account: playbooks, film, stats, assignments"],
      ["user", "Default/unknown", "No app access — redirected to PendingAccess"],
      ["pending", "Pre-approval state", "No app access — redirected to PendingAccess"],
    ],
    [100, 130, 340]
  );

  h2("Onboarding Flow");
  p("New users enter the system through several pathways:");
  h3("Pathway 1: Self-Signup (Parent)");
  bullet("Parent visits the app → lands on Welcome page → clicks Sign Up");
  bullet("Completes ParentSignup form (name, email, phone, child names, sport interest)");
  bullet("Creates an AccessRequest record (status: pending) for admin review");
  bullet("Admin reviews in ParentManagement page → approves or rejects");
  bullet("On approval: parent receives invite email, completes registration, gets 'parent' role");
  bullet("Parent links to their children's Player records via PlayerGuardian entities");

  h3("Pathway 2: Admin Invite");
  bullet("Admin or AD invites a user via inviteParent or inviteStaff backend function");
  bullet("Invitee receives email with AcceptInvite link");
  bullet("AcceptInvite page guides them through profile setup");
  bullet("Role is pre-assigned by the inviter (parent, grandparent, coach, etc.)");

  h3("Pathway 3: Registration Application");
  bullet("Parent submits a RegistrationApplication for a specific team");
  bullet("Admin reviews and approves/waitlists/archives");
  bullet("On approval: Player record is created and linked to the parent via PlayerGuardian");

  h2("Session Security");
  p("The app implements an application-level session management layer on top of Base44's JWT authentication:");
  bullet("UserSession entity — tracks active sessions with SHA-256 token hashing (never stores raw tokens)");
  bullet("trackSession — called on every login; creates a new session record (never reactivates revoked ones)");
  bullet("validateSession — gate function called by all sensitive backend operations; rejects revoked sessions");
  bullet("revokeSession — called on logout; marks the session as revoked (revoked_at timestamp)");
  bullet("rotateToken — regenerates the session token for security-sensitive operations");
  bullet("invalidateAllSessions — admin function to revoke all sessions for a user");
  bullet("Session revocation is checked in real-time — a logged-out token is immediately rejected");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 4: ENTITY DATA MODEL
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("4. Entity Data Model");
  p("The application is built on 50+ Base44 entities, each defining a JSON schema for stored data. Every entity has built-in fields: id, created_date, updated_date, created_by_id. Below is a comprehensive reference of all entities, grouped by domain.");

  // ── Core Entities ──
  h2("4.1 Core Entities");

  h3("User");
  p("Built-in entity. Cannot be created/imported — users join via invites or self-signup.");
  bullet("role: admin | athletic_director | coach | parent | athlete | grandparent | relative | user | pending");
  bullet("display_name: Admin-set display name override");
  bullet("setup_complete: True once onboarding is complete");
  bullet("avatar_url: Profile photo URL");
  bullet("phone, notification_prefs (JSON), allow_chat_notifications, allow_schedule_notifications");
  bullet("last_viewed_schedule: ISO timestamp for unread schedule alert calculation");
  bullet("RLS: Built-in platform security (admins manage other users)");

  h3("Team");
  bullet("name (required), sport_id (required), sport_name, age_group (6U through Adult)");
  bullet("head_coach, coach_email, coach_phone, season (fall/winter/spring/summer), year");
  bullet("max_roster, practice_location, practice_schedule, is_active");
  bullet("roster_published: When true, parents can download the roster PDF");
  bullet("avatar_url, avatar_type: custom | default_football | default_baseball | default_cheer");
  bullet("RLS: Read=true (public read), Create/Update/Delete = admin + AD (+ coach for update)");

  h3("Sport");
  bullet("name (required), icon (emoji), season, description, overview, what_to_expect");
  bullet("hero_image_url, age_groups, registration_open, is_active");
  bullet("RLS: Read=true, Create/Update/Delete = admin + AD");

  h3("Season");
  bullet("Tracks seasonal configurations for sports programs (dates, registration windows)");

  h3("Player");
  bullet("first_name (required), last_name (required), team_id (required), team_name, sport_name");
  bullet("jersey_number, position, depth_chart_unit/slot/order (for depth charts)");
  bullet("date_of_birth, photo_url, parent_name, parent_email, parent_phone");
  bullet("emergency_contact, emergency_phone, medical_notes, is_active");
  bullet("athlete_email, is_promoted, promoted_at, promoted_by: Athlete account promotion tracking");
  bullet("RLS: Read=true, Create/Update/Delete = admin + AD + coach");

  h3("CoachProfile");
  bullet("Coach-specific profile data including background check (BG) and NAYS certification tracking");
  bullet("Compliance expiration dates with automated reminders via complianceCron automation");
  bullet("RLS: Staff-scoped access");

  h3("AthleticDirector");
  bullet("AD-specific profile data, permissions, and organizational scope");

  // ── Events & Schedule ──
  h2("4.2 Events & Schedule");

  h3("Event");
  bullet("title (required), type (required): practice | game | tournament | meeting | fundraiser | other");
  bullet("team_id, team_name, sport_name, date (required), start_time, end_time, location, opponent");
  bullet("notes, is_cancelled, result: win | loss | draw");
  bullet("our_score, opponent_score, tournament_round, is_championship_win");
  bullet("uniform_info: JSON object of uniform piece → color (e.g. {\"jersey\":\"White\",\"hat\":\"Navy\"})");
  bullet("RLS: Read = admin + AD + coach + parent + grandparent + relative; Write = admin + AD + coach");
  bullet("Automations: onEventCreated (entity create trigger), onScoreReported (entity update trigger when result set)");

  h3("AttendanceRequest");
  bullet("team_id (required), team_name, event_id, label (required), event_type, event_date, event_time");
  bullet("created_by_name, created_by_email, is_locked, channel_id");
  bullet("RLS: Read=true, Write = admin + AD + coach");
  bullet("Purpose: Staff creates an attendance request linked to an event. Parents respond via AttendanceResponse.");

  h3("AttendanceResponse");
  bullet("attendance_request_id (required), player_id (required), status (required): attending | not_attending | maybe");
  bullet("player_name, team_id, responder_email, override_by");
  bullet("RLS: Create/Update/Delete = responder_email matches user.email (parents own their responses)");

  h3("SnackAssignment");
  bullet("Links a parent/player to a snack responsibility for a specific event");

  h3("FieldStatus");
  bullet("Real-time field condition reporting (open/closed/delayed) with weather integration");

  // ── Messaging ──
  h2("4.3 Messaging System");

  h3("Channel");
  bullet("type (required): team | direct | carpool | announcement");
  bullet("team_id, name, avatar_url, pinned_role, is_broadcast_only");
  bullet("member_emails: JSON array for direct channels");
  bullet("last_message_at, last_message_preview: Denormalized for sidebar display");
  bullet("RLS: Read=true, Create/Update = admin + AD + coach, Delete = admin + AD");

  h3("ChannelMember");
  bullet("channel_id (required), user_email (required), user_id, user_name");
  bullet("unread_count: Per-user unread message counter (default 0)");
  bullet("RLS: Read=true, Create/Update = admin + AD + coach + own email, Delete = admin + AD");
  bullet("Critical: Parents can update their own unread_count (enables self-service unread management)");

  h3("Message");
  bullet("channel_id (required), content_text (required), sender_user_id, sender_name, sender_avatar");
  bullet("parent_message_id: For threaded replies");
  bullet("message_type: text | event | carpool_request (default text)");
  bullet("metadata: JSON object — for event messages contains {title, date, start_time, location, event_id, attendance_request_id}");
  bullet("RLS: Create=true (any authenticated user), Read = staff + parent + grandparent + relative");
  bullet("Update/Delete = sender_user_id matches (users can edit/delete own messages)");
  bullet("Automation: onMessageCreated (entity create trigger — push notifications + unread increment)");

  h3("MessageReaction");
  bullet("message_id, user_id, emoji: Emoji reactions on messages");

  h3("MessageReport");
  bullet("Reports for abusive/inappropriate messages — status: pending | reviewed | actioned | dismissed");
  bullet("RLS: Create=true, Read=true, Update/Delete = admin + AD");

  h3("MessageReadReceipt");
  bullet("Per-message read tracking for read receipts in channels");

  h3("DirectMessage");
  bullet("1:1 direct messaging between users");

  h3("UserChatPreference");
  bullet("Per-user chat preferences (mute states, notification settings per channel)");

  h3("BlockedUser");
  bullet("User block list — blocked users cannot send DMs or see the blocker's messages");

  h3("MessageRoom");
  bullet("Legacy/alternative messaging room concept");

  // ── Registration ──
  h2("4.4 Registration & Onboarding");

  h3("AccessRequest");
  bullet("parent_name (required), parent_email (required), child_names (required), parent_phone");
  bullet("sport_interest, notes, alternate_email (Apple Private Relay support)");
  bullet("status: pending | approved | rejected, reviewed_by, reviewed_at");
  bullet("RLS: Create=true (public self-signup), Read/Update/Delete = admin + AD");

  h3("RegistrationApplication");
  bullet("parent_user_id, parent_name, parent_email, athlete_first_name, athlete_last_name, athlete_dob");
  bullet("target_team_id, target_team_name, sport_name, status: pending | approved | waitlisted | archived");
  bullet("applied_at, waitlisted_at");
  bullet("RLS: Create = parent_user_id matches; Read = own + admin + AD + coach; Update/Delete = admin + AD");

  h3("TeamRegistration");
  bullet("Registration form template linked to a team: title, description, fee_amount, fee_description");
  bullet("Collect flags: collect_dob, collect_jersey, collect_position, collect_medical, collect_emergency");
  bullet("Custom fields: custom_field_1_label, custom_field_2_label");
  bullet("RLS: Read=true, Write = admin + AD");

  h3("RegistrationSubmission");
  bullet("Parent-submitted registration data for a TeamRegistration form");
  bullet("player_first_name, player_last_name, player_dob, jersey_number, position");
  bullet("medical_notes, emergency_contact, emergency_phone, parent_name, parent_email, parent_phone");
  bullet("fee_paid, stripe_session_id, payment_status: pending_payment | paid | free");
  bullet("player_id (set after admin approval), status: pending | approved | rejected");
  bullet("RLS: Create = parent_email matches; Read = own + admin + AD; Update/Delete = admin + AD");

  h3("PendingChild");
  bullet("Children submitted by parents pending admin matching to existing Player records");
  bullet("first_name, last_name, date_of_birth, grade, sport_interest, parent_email, parent_name");
  bullet("status: pending | approved | rejected | matched");
  bullet("matched_player_id, matched_player_name, assigned_team_id, assigned_team_name");
  bullet("guardian_confirmed: Parent confirmed guardian acknowledgment");
  bullet("RLS: Create = parent_email matches; Read = own + admin + AD; Update/Delete = admin + AD");

  h3("LeadershipApplication");
  bullet("Applications for coaching/leadership positions within the organization");

  // ── Payments ──
  h2("4.5 Payments & Finance");

  h3("Payment");
  bullet("player_id (required), player_name, team_name, parent_email, amount (required, in cents)");
  bullet("paid_amount, description (required), fee_type: registration | uniforms | tournament | fundraising | other");
  bullet("line_items: JSON array of [{name, quantity, unit_amount}] in cents");
  bullet("notes, due_date (required), discount_amount, credit_amount, discount_note");
  bullet("sport_id (required), sport_name, accounting_code (e.g. BASE, FOOT, CHEER)");
  bullet("season_id, season_name, stripe_session_id, stripe_payment_intent_id");
  bullet("status: draft | pending | paid | partial | overdue | voided | refunded");
  bullet("sent_at, voided_by/at, refunded_by/at, reminder_sent_at, created_by_email/name");
  bullet("RLS: Read = staff + parent_email matches (parents see only their own invoices); Write = admin + AD + coach");
  bullet("Security: This was a critical fix (F-06) — originally had no read RLS, exposing all families' financial data");

  h3("InvoiceTemplate");
  bullet("Reusable invoice templates: name, description, fee_type, line_items (JSON), notes, discount_note");
  bullet("sport_id, sport_name, is_active, created_by_email/name");
  bullet("RLS: Read=true, Write = admin + AD");

  // ── Parent Portal ──
  h2("4.6 Parent Portal & Family Access");

  h3("PlayerGuardian");
  bullet("player_id (required), player_name, user_email (required), user_id, relationship");
  bullet("invited_by: Email of who created this link (admin or co-parent)");
  bullet("permissions: Array of [view_calendar, view_messages, financial_contributor]");
  bullet("RLS: Create = admin + AD + coach + own email; Read=true; Update/Delete = admin + AD + coach");
  bullet("Critical: This entity is the link between a parent user and their child's Player record. It determines which team channels, events, and RSVPs a parent can access.");
  bullet("Automation: onGuardianCreated (entity create trigger — auto-upgrades user role to 'parent')");

  h3("CalendarToken");
  bullet("Secure tokens for iCal/Google Calendar subscription feeds");
  bullet("SHA-256 hashed, 90-day expiry, auto-revoked on regeneration");
  bullet("RLS: User-scoped — each user manages their own tokens");

  h3("NotificationPreference");
  bullet("Per-user granular notification preferences (per sport, per event type, per channel)");

  h3("PushSubscription");
  bullet("Web Push API subscription endpoints for push notification delivery");
  bullet("Managed by saveSubscription backend function");

  h3("UserSession");
  bullet("Session tracking with SHA-256 token hashing for revocation checking");
  bullet("created_at, revoked_at, user_id, token_hash, user_agent, ip_address");

  // ── Documents ──
  h2("4.7 Documents & Compliance");

  h3("Document");
  bullet("General document storage with categorization and sharing");

  h3("PlayerDocument");
  bullet("player_id (required), player_name, team_name, doc_type: birth_certificate | physical | insurance | consent_form | waiver | other");
  bullet("file_url (required), file_name, uploaded_by, notes");
  bullet("RLS: Create = uploaded_by matches; Read=true; Update = own + staff; Delete = staff");

  h3("SignatureRequest");
  bullet("document_name (required), doc_type: medical_form | liability_waiver | code_of_conduct | consent_form | custom");
  bullet("file_url (required), player_id (required), player_name, team_id, team_name");
  bullet("status: pending | signed | revoked, sent_by, sent_by_name");
  bullet("signed_by_email, signed_by_name, signed_at, signed_file_url");
  bullet("RLS: Read=true, Write = admin + AD");

  h3("LegalPage");
  bullet("Rich-text legal content (Privacy Policy, Terms of Service, etc.) managed via react-quill editor");

  // ── Playbooks ──
  h2("4.8 Playbooks & Strategy");

  h3("Playbook");
  bullet("name (required), team_id (required), team_name, sport_id, sport_name, season, description");
  bullet("status: draft | published, assigned_to: JSON array of player IDs or 'all'");
  bullet("parent_visible, document_url, document_name, created_by_email/name");
  bullet("RLS: Read=true, Write = admin + AD + coach");

  h3("Play");
  bullet("Individual plays within a playbook — diagram, description, category (Offense/Defense/Special Teams)");

  h3("PlaybookAssignment");
  bullet("playbook_id (required), playbook_name, team_id (required), team_name, assigned_to (required)");
  bullet("assigned_to_label: Human-readable label (e.g. 'Entire Team' or 'QB Group')");
  bullet("required_action: review_all | review_sections, required_sections: JSON array");
  bullet("due_date, instructions, status: active | archived, parent_visible");
  bullet("RLS: Read=true, Write = admin + AD + coach");

  h3("PlaybookSubmission");
  bullet("Tracks athlete progress on playbook assignments");
  bullet("assignment_id (required), playbook_id (required), player_id (required), player_name, player_email");
  bullet("status: assigned | in_progress | submitted | approved | returned");
  bullet("time_viewed_seconds, sections_accessed (JSON), plays_reviewed (JSON), athlete_notes");
  bullet("submitted_at, approved_at, approved_by, returned_at, returned_by, coach_feedback, due_date");
  bullet("RLS: Create = player_email matches; Read=true; Update = own + staff; Delete = admin + AD");

  h3("PlayReview");
  bullet("Individual play review records within a playbook submission");

  // ── Film ──
  h2("4.9 Film Study");

  h3("FilmAssignment");
  bullet("Film clip assignments to players or teams for study and review");

  h3("FilmClip");
  bullet("Individual film clips with video URL, title, description, tags, associated play/event");

  h3("FilmView");
  bullet("View tracking for film clips — who watched what, for how long");

  // ── Stats ──
  h2("4.10 Statistics & Performance");

  h3("PlayerStats");
  bullet("Sport-specific statistics for players (baseball stats, football stats, etc.)");
  bullet("Supports CSV/Excel upload and extraction via extractBaseballStats and extractTeamStats functions");

  // ── Music ──
  h2("4.11 Music & Game Day");

  h3("Playlist");
  bullet("name (required), type: pregame | walkup | warmup | postgame | practice");
  bullet("team_id (required), team_name, event_id");
  bullet("songs: JSON array of [{title, artist, player_name, player_id, spotify_url, youtube_url, notes}]");
  bullet("is_active, created_by_name, created_by_email");
  bullet("RLS: Read=true, Write = admin + AD + coach");

  // ── Volunteers ──
  h2("4.12 Volunteer Coordination");

  h3("VolunteerOpportunity");
  bullet("team_id (required), team_name, event_id, event_name");
  bullet("role_id (required), role_name, required_count, date (required), start_time, end_time");
  bullet("notes, signup_deadline, is_locked");
  bullet("RLS: Read=true, Write = admin + AD + coach");

  h3("VolunteerRole");
  bullet("Reusable volunteer role definitions (e.g. 'Chain Gang', 'Concession Stand', 'Scorekeeper')");

  h3("VolunteerAssignment");
  bullet("Links a parent/user to a specific VolunteerOpportunity slot");

  // ── Carpool ──
  h2("4.13 Carpool Coordination");

  h3("CarpoolRequest");
  bullet("team_id (required), team_name, event_id, event_title, event_date (required), event_time");
  bullet("requester_name, requester_email (required), phone_number, neighborhood_zip");
  bullet("carpool_type (required): offering_ride | seeking_ride, seats_available");
  bullet("pickup_location, notes, status: open | filled | cancelled");
  bullet("RLS: Create/Update/Delete = requester_email matches (parents own their own carpool requests)");
  bullet("Automation: cleanupExpiredCarpools (daily scheduled — removes expired requests)");

  h3("CarpoolResponse");
  bullet("Responses/offers to carpool requests from other parents");

  // ── Other ──
  h2("4.14 Other Entities");

  h3("Announcement");
  bullet("Organization-wide or team-specific announcements with rich text");

  h3("Sponsor");
  bullet("Sponsor information for the SponsorTicker component — name, logo_url, website_url");

  h3("PhotoPost");
  bullet("Community photo gallery posts — shared photos from games, practices, events");

  h3("UniformInventory");
  bullet("Uniform stock tracking — sizes, quantities, assignments");

  h3("NotificationQueue");
  bullet("Queue for batched push notifications — user_email, title, body, url, source, dedup_key");
  bullet("status: pending | sent | failed, processed_at, error, read_at");
  bullet("RLS: Read = user_email matches; Write = staff + own read_at updates");
  bullet("Automation: processNotifications (every 5 minutes — batches and sends pending notifications)");

  h3("AppConfig");
  bullet("Application-level configuration settings (feature flags, org info, global defaults)");

  h3("AdminAuditLog / AuditLog");
  bullet("AdminAuditLog: Security-focused audit trail for admin actions (access attempts, security events)");
  bullet("AuditLog: General operational audit trail (payments, schedule changes, role changes, etc.)");
  bullet("Category: payment | schedule | volunteer | document | user | roster | other");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 5: BACKEND FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("5. Backend Functions");
  p("The app has 60+ backend functions (Deno TypeScript HTTP handlers) for external API integrations, cron jobs, entity triggers, and security gates. Below is a comprehensive reference, grouped by domain.");

  // ── Auth & Security ──
  h2("5.1 Authentication & Security");

  table(
    ["Function", "Purpose"],
    [
      ["validateSession", "Gate function — validates the user's session is not revoked. Called by all sensitive operations."],
      ["trackSession", "Called on every login — creates a new UserSession record with SHA-256 token hash. Never reactivates revoked sessions."],
      ["revokeSession", "Called on logout — marks session as revoked (sets revoked_at). Token immediately rejected by validateSession."],
      ["rotateToken", "Regenerates session token for security-sensitive operations."],
      ["invalidateAllSessions", "Admin function — revokes all sessions for a specific user."],
      ["requireAdminAuth", "Helper that verifies the caller's role from the database (not just JWT). Logs all attempts to AdminAuditLog."],
      ["verifyRole", "Verifies a user's role for authorization checks."],
      ["authorizeObjectAccess", "Checks if a user has access to a specific entity record (tenant isolation)."],
      ["secureGetRecord", "Secure record retrieval with team-scoped access checks. Prevents IDOR attacks."],
      ["getSecurityReportUrl", "Generates a signed URL for the security report PDF."],
      ["securityReport", "Generates the comprehensive security audit PDF."],
    ],
    [130, 380]
  );

  // ── User Management ──
  h2("5.2 User Management");

  table(
    ["Function", "Purpose"],
    [
      ["onUserCreated", "Entity trigger on User creation — initializes default settings, role assignment."],
      ["autoUpgradeParentRole", "Automatically upgrades a user's role to 'parent' when they're linked to a Player via PlayerGuardian."],
      ["updateParentName", "Updates a parent's display name across their linked records."],
      ["linkRelayEmail", "Links an Apple Private Relay email to the user's real email for iCloud hide-my-email support."],
      ["blockUser", "Blocks a user — prevents them from sending DMs or seeing the blocker's messages."],
      ["unblockUser", "Removes a user block."],
      ["getBlockedIds", "Returns the list of blocked user IDs for the current user."],
      ["adminDeleteAccount", "Admin function to permanently delete a user account and all associated data."],
      ["deleteAccount", "User-initiated account deletion (GDPR compliance)."],
    ],
    [130, 380]
  );

  // ── Invitations ──
  h2("5.3 Invitations & Onboarding");

  table(
    ["Function", "Purpose"],
    [
      ["inviteParent", "Invites a parent via email with role [parent, grandparent]. Zod strict schema — rejects unknown fields."],
      ["inviteStaff", "Invites a staff member (coach, AD) via email with role assignment."],
      ["bulkInviteUsers", "Bulk invites multiple users. Zod strict schema — prevents mass assignment privilege escalation."],
      ["handleApproval", "Handles the approval flow for access requests and registration applications."],
      ["approveParentRequest", "Approves a parent's access request and creates their account/links."],
    ],
    [130, 380]
  );

  // ── Registration ──
  h2("5.4 Registration");

  table(
    ["Function", "Purpose"],
    [
      ["parentSignup", "Handles parent self-signup — creates AccessRequest, validates data, sends confirmation."],
      ["toggleRegistrationStatus", "Toggles a team registration form's is_open status."],
      ["registrationCheckout", "Creates a Stripe Checkout session for registration fee payment."],
      ["registrationArchivalCron", "Daily cron — archives expired/stale registration applications."],
    ],
    [140, 370]
  );

  // ── Events & Schedule ──
  h2("5.5 Events & Schedule");

  table(
    ["Function", "Purpose"],
    [
      ["onEventCreated", "Entity trigger on Event creation — sends push notifications to all team parents with event details."],
      ["onScoreReported", "Entity trigger on Event update (when result set) — posts score announcement, sends push + email to parents."],
      ["gameReminder", "Cron (every 30 min) — finds games starting in ~8 hours, sends push + email reminders."],
      ["gameDayWeatherAlert", "Daily cron (9am CT) — checks weather for tomorrow's outdoor events, alerts parents if concerning."],
      ["icsCalendarFeed", "Serves an iCal (.ics) calendar feed — requires valid token, 90-day expiry, revocation enforced."],
      ["generateCalendarToken", "Generates a new CalendarToken — revokes all prior tokens first (no accumulation)."],
      ["revokeCalendarToken", "Revokes a specific calendar token."],
      ["getEventsFiltered", "Returns events filtered by team, date range, type — optimized query for large event sets."],
    ],
    [130, 380]
  );

  // ── Messaging ──
  h2("5.6 Messaging");

  table(
    ["Function", "Purpose"],
    [
      ["onMessageCreated", "Entity trigger on Message creation — sends push to channel members, increments unread counts, sends email notifications (HTML-escaped for XSS prevention)."],
      ["getMessagesFiltered", "Returns messages for a channel with pagination and filtering — optimized for large channels."],
    ],
    [130, 380]
  );

  // ── Notifications ──
  h2("5.7 Notifications");

  table(
    ["Function", "Purpose"],
    [
      ["processNotifications", "Cron (every 5 min) — batches pending NotificationQueue tasks, deduplicates per user, sends consolidated push."],
      ["sendPushNotification", "Sends a push notification to a specific user via FCM."],
      ["saveSubscription", "Saves a Web Push API subscription endpoint to PushSubscription entity."],
      ["getPushConfig", "Returns push notification configuration for the current user."],
      ["sendSnackReminder", "Daily cron (2pm CT) — sends 24-hour snack assignment reminders to parents."],
      ["sendDocumentReminder", "Sends document/signature request reminders to parents."],
      ["sendInvoiceReminder", "Sends invoice payment reminder emails to parents."],
    ],
    [130, 380]
  );

  // ── Payments ──
  h2("5.8 Payments & Stripe");

  table(
    ["Function", "Purpose"],
    [
      ["createCheckout", "Creates a Stripe Checkout session for an invoice payment. Validates session, includes app_id in metadata."],
      ["stripeWebhook", "Handles Stripe webhook events (checkout.session.completed, invoice.paid, etc.) — updates Payment status."],
    ],
    [130, 380]
  );
  callout("Stripe Configuration", "Status: Live Mode. The app is accepting real payments. Secrets: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET are configured. Checkout is iframe-blocked (must run from published app, not builder preview). No Stripe products configured yet in the catalog — checkout sessions are created dynamically per invoice.", "warning");

  // ── Data Processing ──
  h2("5.9 Data Processing & Extraction");

  table(
    ["Function", "Purpose"],
    [
      ["extractBaseballStats", "Extracts structured baseball statistics from uploaded CSV/Excel files using LLM."],
      ["extractTeamStats", "Extracts team-level statistics from uploaded files."],
      ["parseRosterFile", "Parses a roster CSV/Excel upload and creates Player records."],
      ["parsePdfSchedule", "Parses a PDF schedule upload and creates Event records using LLM extraction."],
    ],
    [130, 380]
  );

  // ── Other ──
  h2("5.10 Other Functions");

  table(
    ["Function", "Purpose"],
    [
      ["onGuardianCreated", "Entity trigger on PlayerGuardian creation — auto-upgrades linked user's role to 'parent'."],
      ["propagateTeamNameChange", "Entity trigger on Team update — propagates name changes to all denormalized fields across entities."],
      ["cleanupExpiredCarpools", "Daily cron (7am) — removes/archives expired carpool requests."],
      ["sendFilmAssignment", "Sends film clip assignment notifications to players."],
      ["orphanedRecordCleaner", "Cleanup function — removes orphaned records (e.g. messages for deleted channels)."],
      ["notificationFixReport", "Generates a report on notification delivery status and issues."],
    ],
    [140, 370]
  );

  // ── Test Functions ──
  h2("5.11 Test & Verification Functions");
  p("The app includes a suite of test functions used for security verification and regression testing. These are not called in production but exist to validate security properties:");
  table(
    ["Function", "Purpose"],
    [
      ["testAdminGateE2E", "End-to-end test of admin authorization gates."],
      ["testCrossTenantAccess", "Tests cross-tenant data isolation (IDOR prevention)."],
      ["testInvalidationE2E", "Tests session invalidation end-to-end."],
      ["testSessionDeath", "Tests that revoked sessions are immediately rejected."],
      ["testSessionLifecycle", "Tests full session lifecycle (create → validate → revoke → reject)."],
      ["testTenantIsolation", "Verifies tenant isolation across all entities."],
      ["testTokenReuseAfterLogout", "Tests that a logged-out token cannot be reused."],
    ],
    [150, 360]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 6: AUTOMATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("6. Automations");
  p("The app has 12 active automations that run backend functions automatically — on schedules, on entity changes, or on connector webhook events. All are currently active and running successfully.");

  h2("6.1 Scheduled Automations (Cron)");
  table(
    ["Name", "Function", "Schedule", "Description"],
    [
      ["Process Notification Queue", "processNotifications", "Every 5 min", "Batches pending notifications, deduplicates per user, sends consolidated push"],
      ["Game Day 8-Hour Reminder", "gameReminder", "Every 30 min", "Finds games starting in ~8 hours, sends push + email reminders to parents"],
      ["Registration Archival Cron", "registrationArchivalCron", "Daily 8am", "Archives expired/stale registration applications"],
      ["Daily Compliance Expiration Check", "complianceCron", "Daily 1pm", "Checks coach BG check and NAYS expiration, sends push reminders at 2-month and 1-month marks"],
      ["Daily Snack Reminders", "sendSnackReminder", "Daily 2pm", "Sends 24-hour snack assignment reminders to parents"],
      ["Game Day Weather Alerts", "gameDayWeatherAlert", "Daily 9am CT", "Checks weather for tomorrow's outdoor events, alerts parents if conditions are concerning"],
      ["Daily Carpool Cleanup", "cleanupExpiredCarpools", "Daily 7am", "Removes/archives expired carpool requests"],
    ],
    [115, 100, 70, 195]
  );

  h2("6.2 Entity-Triggered Automations");
  table(
    ["Name", "Function", "Entity", "Event", "Description"],
    [
      ["Notify Parents on New Event", "onEventCreated", "Event", "Create", "Push-notifies all parent/guardians on the team with event details + deep link"],
      ["Auto Score Report on Game Result", "onScoreReported", "Event", "Update", "When result is set, posts announcement, sends push + email to parents"],
      ["On Message Created — Push & Unread", "onMessageCreated", "Message", "Create", "Sends push to channel members, increments unread counts"],
      ["Propagate Team Name Change", "propagateTeamNameChange", "Team", "Update", "Propagates name changes to all denormalized fields across entities"],
      ["Auto-set role when guardian link created", "onGuardianCreated", "PlayerGuardian", "Create", "Updates linked user's role to 'parent' if they have an account"],
    ],
    [125, 90, 75, 55, 205]
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 7: FRONTEND PAGES & ROUTES
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("7. Frontend Pages & Routes");
  p("The app has 30+ pages organized into public routes, all-roles routes, and staff-only routes. Routing is handled by AppShell.jsx, which manages authentication state, role-based redirects, and layout wrapping.");

  h2("7.1 Public Routes (No Login Required)");
  table(
    ["Route", "Page", "Purpose"],
    [
      ["/welcome", "Welcome", "Landing page with sign-up / login options"],
      ["/ParentSignup", "ParentSignup", "Parent self-signup form (creates AccessRequest)"],
      ["/Register", "Register", "Registration application form for a specific team"],
      ["/AcceptInvite", "AcceptInvite", "Onboarding flow for invited users"],
      ["/privacy-policy", "PrivacyPolicy", "Public privacy policy page"],
    ],
    [90, 90, 330]
  );

  h2("7.2 All-Roles Routes (Authenticated Users)");
  table(
    ["Route", "Page", "Purpose"],
    [
      ["/Portal", "Dashboard", "Main dashboard (role-aware: staff see admin dashboard, parents see ParentPortal)"],
      ["/ParentPortal", "ParentPortal", "Parent family portal — athletes, RSVPs, payments, documents, messaging"],
      ["/ParentCalendar", "ParentCalendar", "Calendar view of events for the parent's athletes' teams"],
      ["/Messages", "MessagesLayout", "Full messaging interface — channel sidebar + chat canvas + threads"],
      ["/NotificationSettings", "NotificationSettings", "Granular notification preferences"],
      ["/HelpCenter", "HelpCenter", "Help articles and FAQ"],
      ["/LegalPages", "LegalPages", "Legal document viewer"],
      ["/AccountSettings", "AccountSettings", "User profile and account management"],
      ["/Gallery", "Gallery", "Community photo gallery"],
      ["/GameDayPlaylists", "GameDayPlaylists", "Game day music playlists (pregame, walkup, warmup)"],
      ["/Playbooks", "Playbooks", "Playbook viewer (role-aware: coaches manage, athletes/parents view)"],
      ["/sports-directory", "ParentSportsRegister", "Sport directory with registration links for parents"],
    ],
    [100, 105, 305]
  );

  h2("7.3 Staff-Only Routes (Admin, AD, Coach)");
  table(
    ["Route", "Page", "Purpose"],
    [
      ["/Sports", "Sports", "Sport program management (create, edit, configure registration)"],
      ["/Teams", "Teams", "Team management (create, roster, depth chart, compliance)"],
      ["/TeamDetail", "TeamDetail", "Team detail view (roster, depth chart, compliance, registration)"],
      ["/Schedule", "Schedule", "Event scheduling — list view, calendar view, create/edit/delete events"],
      ["/Announcements", "Announcements", "Create and manage organization-wide announcements"],
      ["/Documents", "Documents", "Document management and signature requests"],
      ["/AthleticDirectors", "AthleticDirectors", "AD profile management"],
      ["/Volunteers", "Volunteers", "Volunteer opportunity and assignment management"],
      ["/AuditLog", "AuditLog", "Audit trail viewer (security and operational logs)"],
      ["/SeasonManager", "SeasonManager", "Season configuration and management"],
      ["/DataExport", "DataExport", "Data export tool (CSV, JSON) for admin analysis"],
      ["/PracticePlans", "PracticePlans", "Practice plan creation and management"],
      ["/CoachesTraining", "CoachesTraining", "Coach training and compliance resources"],
      ["/Applications", "Applications", "Review registration and leadership applications"],
    ],
    [90, 95, 325]
  );

  h2("7.4 Internal Review Routes");
  table(
    ["Route", "Page", "Purpose"],
    [
      ["/srd", "SRD", "Software Requirements Document viewer (internal)"],
      ["/SecurityReport", "SecurityReport", "Security audit PDF generator (admin only)"],
      ["/UIUXAuditReport", "UIUXAuditReport", "UI/UX audit PDF generator (admin only)"],
      ["/IssuesFixedReport", "IssuesFixedReport", "Issues fixed remediation PDF (admin only)"],
    ],
    [100, 100, 310]
  );

  h2("7.5 Key Layout Components");
  bullet("AppLayout — Main layout wrapper with TopBar, bottom tab bar, and scroll container. Wraps all authenticated routes.");
  bullet("BottomTabBar — Persistent mobile bottom navigation with role-aware tabs (Home, Messages, Calendar, More)");
  bullet("TopBar — Top navigation bar with app title, notification bell, help icon, and user menu");
  bullet("StaffRoute — Route guard that redirects non-staff users to /Portal");
  bullet("Sidebar — Desktop sidebar navigation for staff pages");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 8: KEY SYSTEMS DEEP-DIVE
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("8. Key Systems Deep-Dive");

  // ── Messaging ──
  h2("8.1 Messaging & Chat System");
  p("The messaging system is the most complex subsystem in the app, providing real-time team communication, direct messaging, carpool coordination, and announcement channels.");

  h3("Channel Types");
  bullet("Team channels — Linked to a Team entity, visible to that team's coaches and parents (via PlayerGuardian links)");
  bullet("Direct channels — 1:1 messaging between two users (member_emails JSON array)");
  bullet("Carpool channels — Carpool coordination discussions");
  bullet("Announcement channels — Broadcast-only news posts (admin/AD/coach can post, parents read)");

  h3("Architecture");
  bullet("ChatSidebar — Left panel with tabbed channel lists (Teams, DMs, Carpool, News), unread badges, channel creation");
  bullet("ChatCanvas — Main chat view with message bubbles, reactions, threads, pull-to-refresh, infinite scroll");
  bullet("Composer — Message input with channel-aware placeholder, photo upload, event card creation");
  bullet("ThreadSidebar — Thread/reply view for messages with parent_message_id");
  bullet("EventCard — Rich event card rendered for message_type='event' messages with RSVP buttons");
  bullet("ScoreCard — Rich score update card for score report messages");

  h3("Real-time & Performance");
  bullet("Realtime subscriptions via base44.entities.Message.subscribe() — replaces polling for new messages");
  bullet("Realtime subscriptions for MessageReaction — replaces polling for reactions");
  bullet("ChannelMember.unread_count — incremented by onMessageCreated automation, reset when user opens channel");
  bullet("Visibility-aware polling — polling pauses when browser tab is hidden (document.visibilitychange)");
  bullet("This was a critical fix (U-03/ISSUE-02) — previously 5 components polled every 5-15s, causing rate limit violations");

  h3("Message Types & Rich Content");
  bullet("text — Standard text message with optional photo attachment");
  bullet("event — Event card with metadata (title, date, location, event_id, attendance_request_id) and RSVP buttons");
  bullet("carpool_request — Carpool request card with ride offering/seeking details");

  h3("Parent Access Control");
  p("Parents only see channels for teams where they have a PlayerGuardian link. The ChatSidebar fetches the parent's PlayerGuardian records, then the linked Player records, extracts team_ids, and filters the channel list. This ensures a parent with a child on Team A cannot see Team B's channel.");

  // ── RSVP & Attendance ──
  h2("8.2 RSVP & Attendance System");
  p("The RSVP system lets parents respond to attendance requests for their athletes' events. It spans the EventCard in chat, the AttendanceCard in the schedule, and the SmartRsvpPanel in the parent portal.");

  h3("Flow");
  bullet("Staff creates an Event in Schedule.jsx and checks 'Notify Team'");
  bullet("An AttendanceRequest record is created and linked to the event");
  bullet("A Message with message_type='event' is posted to the team channel with metadata (event_id, attendance_request_id)");
  bullet("The EventCard component renders in chat with Going / Can't Go / Need Ride buttons");
  bullet("Parent clicks a button → optimistic UI update (badge appears instantly) → AttendanceResponse records created/updated");
  bullet("Staff sees attendance breakdown in the Schedule page and AttendanceDetailModal");

  h3("Recent Fix: RSVP Button Unresponsiveness (Conversation History)");
  callout(
    "Issue: RSVP Buttons Completely Unresponsive",
    "The EventCard RSVP buttons (Going, Can't Go, Need Ride) were completely unresponsive. Root causes: (1) The mutation silently returned when data was missing (no reqId or eligible players), causing the optimistic state to flash and immediately get cleared by onSettled. (2) No toast on error — failures were invisible. (3) onSettled cleared optimistic state too eagerly.\n\nFix Applied: (1) Set optimisticRsvp state immediately in the click handler (before calling mutate) for instant UI feedback. (2) mutationFn throws errors instead of silently returning, so onError fires. (3) Added onError with toast ('Failed to save RSVP'). (4) Removed onSettled — only onSuccess (cache invalidation) and onError (revert + toast) are used. (5) optimisticRsvp is NOT cleared on success — it persists and matches the real data once refetched.",
    "success"
  );

  h3("AttendanceCard Component");
  p("The AttendanceCard in the Schedule page provides a different view: staff see aggregate attendance statistics (X going, Y not going, Z no response), while parents see a collapsible RSVP interface for their linked athletes. It uses TanStack Query optimistic updates via onMutate cache updates for instant feedback.");

  // ── Carpool ──
  h2("8.3 Carpool Coordination");
  p("The carpool system lets parents request or offer rides for events, reducing the logistical burden on families.");

  h3("Flow");
  bullet("Parent opens CarpoolRequestModal (from ChatSidebar or EventCard 'Need Ride' button)");
  bullet("Selects an event, specifies ride type (offering or seeking), seats, pickup location, notes");
  bullet("CarpoolRequest record created → message posted to team channel → push notification sent to team parents");
  bullet("Other parents can respond via CarpoolResponse records");
  bullet("Expired carpool requests are cleaned up daily by cleanupExpiredCarpools automation");

  // ── Schedule ──
  h2("8.4 Schedule & Calendar System");
  p("The Schedule page is the central hub for event management, serving both staff (create/edit/delete) and parents (view only).");

  h3("Features");
  bullet("List view and Calendar view (month/week/day) with event type color coding");
  bullet("Event creation form with type, team, date, time, location, opponent, uniform info, notes");
  bullet("Team notification on event creation (posts message to team channel + creates AttendanceRequest)");
  bullet("PDF schedule import (parsePdfSchedule) and CSV bulk import (BulkEventImporter)");
  bullet("Calendar subscription (icsCalendarFeed) with secure token generation");
  bullet("Per-team calendar export and Google/Apple calendar sync");
  bullet("Uniform assignment per event (UniformSelector/UniformEditor)");
  bullet("Snack assignment integration");
  bullet("Score reporting (triggers onScoreReported automation)");
  bullet("Weather integration (gameDayWeatherAlert automation)");

  // ── Payments ──
  h2("8.5 Payments & Stripe Integration");
  p("The payment system manages invoices, Stripe Checkout payments, and financial reporting.");

  h3("Flow");
  bullet("Admin/AD creates a Payment (invoice) record with line items, amounts, due date, linked to a player");
  bullet("Invoice is sent (status: pending) — appears in parent's ParentPortal payments section");
  bullet("Parent clicks Pay → createCheckout backend function creates a Stripe Checkout session");
  bullet("Stripe Checkout handles payment (card, Apple Pay, Google Pay)");
  bullet("stripeWebhook receives checkout.session.completed → updates Payment status to 'paid'");
  bullet("Invoice reminders sent via sendInvoiceReminder function");

  h3("Invoice Management");
  bullet("InvoiceTemplate — Reusable templates with default line items and fee types");
  bullet("AdminInvoiceManager — Admin interface for creating, editing, voiding, and refunding invoices");
  bullet("Discounts and credits — Supports discount_amount, credit_amount, discount_note");
  bullet("Accounting codes — Per-sport codes (BASE, FOOT, CHEER) for financial reporting");
  bullet("Season linking — Invoices can be linked to a Season for seasonal financial reporting");

  // ── Parent Portal ──
  h2("8.6 Parent Portal");
  p("The Parent Portal is the primary interface for parents, grandparents, and relatives. It provides a family-centric view of everything related to their linked athletes.");

  h3("Sections");
  bullet("Athlete Cards — One card per linked athlete with team, sport, jersey, upcoming events");
  bullet("SmartRsvpPanel — Upcoming events with quick RSVP actions");
  bullet("PlayerPayments — Invoice list with Pay buttons and payment history");
  bullet("PlayerDocuments — Document uploads (birth certificate, physical, insurance) and signature requests");
  bullet("TeamRosterView — View the team roster (when roster_published is true)");
  bullet("CarpoolBoard — Carpool requests and offers for their athletes' teams");
  bullet("RsvpVolunteerTab — RSVP and volunteer sign-up in one tab");
  bullet("FamilyAccessManager — Manage co-guardians and their permissions");
  bullet("OpenRegistrationsPanel — Available registration forms for their athletes");
  bullet("ContactAD — Direct communication with the athletic director");
  bullet("FieldStatusBanner — Real-time field condition alerts");

  h3("Family Access Management");
  p("Parents can invite co-guardians (other parent, grandparent, relative) to access their child's information. The InviteCoGuardian component creates a PlayerGuardian record with configurable permissions: view_calendar, view_messages, financial_contributor. The FamilyAccessManager lets parents edit or revoke these permissions.");

  // ── Push Notifications ──
  h2("8.7 Push Notifications");
  p("The push notification system delivers timely alerts to parents and staff about events, messages, reminders, and more.");

  h3("Architecture");
  bullet("PushSubscription entity — Stores Web Push API subscription endpoints");
  bullet("saveSubscription backend function — Saves subscription on opt-in");
  bullet("sendPushNotification backend function — Sends a push to a specific user via FCM");
  bullet("processNotifications automation — Batches NotificationQueue entries every 5 minutes, deduplicates, sends consolidated push");
  bullet("Service Worker (public/sw.js) — Handles push events, displays notifications, manages PWA install");
  bullet("@capacitor-firebase/messaging — Native push delivery on iOS and Android");

  h3("Notification Sources");
  bullet("onEventCreated — New event posted to team channel");
  bullet("onMessageCreated — New message in a channel the user is a member of");
  bullet("onScoreReported — Game result posted");
  bullet("gameReminder — 8-hour pre-game reminder");
  bullet("gameDayWeatherAlert — Weather alert for tomorrow's events");
  bullet("sendSnackReminder — 24-hour snack assignment reminder");
  bullet("sendDocumentReminder — Document/signature request reminder");
  bullet("sendInvoiceReminder — Invoice payment reminder");

  h3("Notification Preferences");
  p("Users can configure granular notification preferences in the NotificationSettings page. The User entity has allow_chat_notifications and allow_schedule_notifications flags. The NotificationPreference entity supports per-sport, per-event-type, and per-channel preferences.");

  h3("Recent Fix: Persistent Unread Notification Badges (Conversation History)");
  callout(
    "Issue: Notification Badges Not Clearing",
    "Unread notification badges persisted even after the user read messages. Root causes: (1) ChannelMember.unread_count was not being reset properly. (2) NotificationBell popover didn't close when selecting a notification. (3) Cache invalidation wasn't forcing UI updates.\n\nFixes Applied: (1) NotificationBell closes popover immediately on notification select. (2) ChatCanvas clearUnreadMutation uses optimistic onMutate to set unread_count: 0 in the channel-members cache before the API call. (3) EventCard hides RSVP buttons and shows status badge after response using optimistic updates. (4) Notification routing maps team_id to channel_id for accurate badge routing.",
    "success"
  );

  // ── Playbooks ──
  h2("8.8 Playbooks & Film Study");
  p("The playbook system lets coaches distribute play documents, track athlete engagement, and collect feedback. The film study system allows coaches to assign film clips for review and track viewing.");

  h3("Playbook Flow");
  bullet("Coach uploads a playbook document (PDF, image, Word) via UploadPlaybookModal");
  bullet("Playbook record created with team_id, sport_id, assigned_to (player IDs or 'all')");
  bullet("PlaybookAssignment created — defines required action (review_all or review_sections), due date");
  bullet("PlaybookSubmission records created per assigned athlete (status: assigned)");
  bullet("Athletes view playbook, open sections/plays — time_viewed_seconds and sections_accessed tracked");
  bullet("Athlete submits (status: submitted) → coach reviews → approves or returns with feedback");
  bullet("DiagramDrawer — Interactive play diagram creation tool");

  h3("Film Study Flow");
  bullet("Coach uploads film clips via FilmUploadModal → FilmClip records created");
  bullet("Coach assigns clips to players/teams via FilmAssignModal → FilmAssignment records");
  bullet("Athletes view clips in FilmRoom → FilmView records track viewing time");
  bullet("FilmAnalyticsDashboard — Coach view of viewing engagement across the team");

  // ── Stats ──
  h2("8.9 Statistics & Performance");
  p("The stats system supports sport-specific statistics with CSV/Excel upload and extraction.");
  bullet("StatsUploadModal / StatsUploadPicker — Upload stats files");
  bullet("extractBaseballStats — LLM-powered extraction of baseball stats from uploaded files");
  bullet("extractTeamStats — Team-level stats extraction");
  bullet("StatsDashboard — Visualize team and player statistics with charts (recharts)");
  bullet("StatsLeaderboard — Top performers by stat category");
  bullet("BaseballStatsDisplay — Sport-specific baseball stats rendering");
  bullet("EditStatsModal — Manual stat correction");

  // ── Volunteers ──
  h2("8.10 Volunteer Coordination");
  bullet("VolunteerRole — Define reusable roles (Chain Gang, Concession, Scorekeeper, etc.)");
  bullet("VolunteerOpportunity — Create specific volunteer needs linked to events");
  bullet("VolunteerAssignment — Parents sign up for opportunities");
  bullet("ParentVolunteerView — Parent-facing volunteer sign-up interface");
  bullet("VolunteerDetailPanel — Staff view of signups and coverage");

  // ── Documents ──
  h2("8.11 Documents & Signatures");
  bullet("Document — General document storage");
  bullet("PlayerDocument — Player-specific documents (birth certificate, physical, insurance, waivers)");
  bullet("SignatureRequest — Digital signature requests for legal/medical documents");
  bullet("AdminSignDialog — Admin signature verification");
  bullet("ParentSignatureRequests — Parent-facing signature request interface");
  bullet("SendSignatureRequestDialog — Admin tool to send signature requests to parents");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 9: SECURITY MODEL
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("9. Security Model & Findings");

  h2("9.1 Row-Level Security (RLS)");
  p("Every entity has RLS rules that control who can create, read, update, and delete records. RLS uses two mechanisms: user_condition (checks the user's role) and data matching (checks a field on the record against a user attribute like email or ID).");

  h3("Common RLS Patterns");
  bullet("Staff-only write: Create/Update/Delete restricted to admin + athletic_director + coach");
  bullet("Public read: Read=true (all authenticated users can read)");
  bullet("Owner-based: data.parent_email === user.email, data.responder_email === user.email, etc.");
  bullet("Parent-scoped: Parents see only records linked to their email (Payment, AttendanceResponse, CarpoolRequest)");
  bullet("Team-scoped: Parents see only events/channels for teams where they have a PlayerGuardian link");

  h2("9.2 Security Audit Findings (Phase 1 — All Resolved)");
  p("A comprehensive security audit identified 10 findings, all of which have been remediated and verified. The platform was cleared for beta launch on June 19, 2026.");

  const securityFindings = [
    ["F-01", "Cross-Tenant Event/Message Read (IDOR)", "Event and Message had no read-level RLS. Any user could read records by ID across tenants. Fixed: Added RLS + secureGetRecord gate."],
    ["F-02", "Token Replay After Logout", "JWT remained valid after app-level logout. Captured tokens could replay writes. Fixed: UserSession with SHA-256 hashing + validateSession gate."],
    ["F-03", "Mass Assignment — Privilege Escalation", "bulkInviteUsers/inviteParent accepted arbitrary fields. Could supply role:'admin'. Fixed: Zod .strict() schemas."],
    ["F-04", "Stored XSS via Email Notification", "onMessageCreated interpolated raw HTML. Script tags executed in email clients. Fixed: escapeHtml() utility."],
    ["F-05", "Session Revocation Race Condition", "trackSession could reactivate revoked sessions. Fixed: Forces new record creation on every login."],
    ["F-06", "Missing RLS on Payment Entity", "Any parent could list all families' payment records. Fixed: parent_email RLS on read."],
    ["F-07", "Unauthenticated ICS Calendar Feed", "Calendar feed accepted no token parameter. Fixed: Token presence + hash lookup + 90-day expiry."],
    ["F-08", "Calendar Token Accumulation", "New tokens didn't revoke old ones. Fixed: Revoke all existing before creating new."],
    ["F-09", "Admin Endpoint Lacks DB Role Verification", "JWT role claim not re-checked against DB. Fixed: requireAdminAuth() with DB lookup."],
    ["F-10", "Client-Supplied tenant_id in Write Payloads", "Functions accepted team_id from client body. Fixed: Derive team scope from session only."],
  ];

  securityFindings.forEach((f) => {
    h3(`${f[0]}: ${f[1]}`);
    p(f[2], { size: 9 });
  });

  callout("Security Status: CLEARED", "All 10 Phase 1 security findings have been remediated and verified. The platform was cleared for beta launch on June 19, 2026. Phase 2 (P3/P4 findings: rate limiting, CAPTCHA, verbose errors) is deferred.", "success");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 10: UI/UX AUDIT
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("10. UI/UX Audit Findings");
  p("A comprehensive UI/UX audit identified 18 findings across 9 key screens. Severity breakdown: 1 Critical, 3 High, 7 Medium, 7 Low. Total estimated effort: 24-32 hours.");

  h2("10.1 Critical & High Findings");

  const uiFindings = [
    ["U-01", "Critical", "Composer Overlap with Bottom Navigation Bar", "Message input hidden behind bottom nav bar on mobile. Fixed: Added paddingBottom for nav bar height + safe area."],
    ["U-02", "High", "Hidden Channels Button Touch Zone Overlap", "'Manage Hidden Channels' button overlapped bottom nav touch zone. Fixed: Added paddingBottom to scroll container."],
    ["U-03", "High", "Aggressive API Polling — Rate Limit Exhaustion", "5 components polled every 5-15s, causing 40-60 req/min and rate limit errors. Fixed: Replaced polling with realtime subscriptions + visibility-aware polling."],
    ["U-04", "High", "Inefficient Reactions Query — Full Table Scan", "Reactions query fetched ALL org records with empty filter. Fixed: filter by message_id $in msgIds."],
  ];

  uiFindings.forEach((f) => {
    h3(`${f[0]} (${f[1]}): ${f[2]}`);
    p(f[3], { size: 9 });
  });

  h2("10.2 Medium Findings");
  const mediumFindings = [
    ["U-05", "Hardcoded Timezone in Message Timestamps", "Used hardcoded America/Chicago instead of user/org timezone. Fix: Use useOrgTimezone() hook."],
    ["U-06", "Theme Inconsistency — Light vs Dark Mode", "Some messaging components used hardcoded light-mode classes. Fix: Use theme tokens consistently."],
    ["U-07", "Score Bot Messages Lack Visual Hierarchy", "Score updates rendered as plain text. Fix: Created ScoreCard component."],
    ["U-08", "Channel Name Truncation in Chat Header", "Long names truncated with no tooltip. Fix: Add truncate + max-w + title attribute."],
    ["U-09", "Low Contrast on Empty State Text", "'No messages yet' below WCAG AA contrast. Fix: Remove opacity-50, increase text size."],
    ["U-10", "Top Bar Icon Density — Edge Margins", "Icons too close to curved screen edges. Fix: Add safe-area-right padding."],
    ["U-11", "Mute Toggle — Inconsistent Active State", "Amber-600 invisible on dark theme. Fix: Use amber-400 with higher opacity background."],
  ];
  mediumFindings.forEach((f) => {
    h3(`${f[0]}: ${f[1]}`);
    p(f[2], { size: 9 });
  });

  h2("10.3 Low Findings");
  const lowFindings = [
    ["U-12", "Hide/Unhide Channel Button — Desktop Hover Only", "Hidden on mobile (no hover). Fix: Always visible on mobile (lg:opacity-0 lg:group-hover:opacity-100)."],
    ["U-13", "Composer Placeholder Lacks Channel Context", "Generic 'Message…' placeholder. Fix: Dynamic 'Message #ChannelName…'"],
    ["U-14", "Pull-to-Refresh Lacks Haptic Feedback", "No vibration on pull-to-refresh. Fix: navigator.vibrate() on threshold cross."],
    ["U-15", "Sponsor Ticker Consumes Mobile Screen Space", "Ticker on every page. Fix: Add dismiss button or only show on home page."],
    ["U-16", "Avatar Layering — Photo Clipped Behind Header", "Avatar partially clipped. Fix: Add overflow-visible to header."],
    ["U-17", "Inconsistent Empty States Across Channel Types", "Different empty state treatments per tab. Fix: Reusable EmptyChannelState component (done)."],
    ["U-18", "Dashboard Query — No staleTime", "7 queries refetch on every mount. Fix: Add staleTime: 60000."],
  ];
  lowFindings.forEach((f) => {
    h3(`${f[0]}: ${f[1]}`);
    p(f[2], { size: 9 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 11: ISSUES & REMEDIATION HISTORY
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("11. Issues & Remediation History");
  p("This section consolidates all identified issues from the security audit, UI/UX audit, issues fixed report, and conversation history with the development agent.");

  h2("11.1 Security Issues (All Fixed — June 2026)");
  p("All 10 security findings (F-01 through F-10) were identified and remediated between June 5-19, 2026. See Section 9.2 for details. All verified with before/after evidence and automated retests (test functions). Status: ALL PASS.");

  h2("11.2 UI/UX Issues (Audit June 22, 2026)");
  p("18 UI/UX findings identified across 9 screens. The most critical (U-01: composer overlap, U-03: API polling, U-04: reactions query) were remediated immediately. Others are tracked as P1-P3 priorities.");

  h2("11.3 Issues Fixed Report (June 27, 2026)");
  p("Four high-impact issues were remediated in a focused sprint:");
  bullet("ISSUE-01 (High): Composer hidden behind bottom navigation — Fixed with paddingBottom adjustment");
  bullet("ISSUE-02 (Critical): Aggressive API polling causing rate limits — Fixed with realtime subscriptions + visibility-aware polling (80% reduction in API calls)");
  bullet("ISSUE-03 (High): Reactions query fetching all org records — Fixed with filtered $in query");
  bullet("ISSUE-04 (Medium): Hidden channels button touch zone overlap — Fixed with scroll container padding");

  h2("11.4 Conversation History Issues (Ongoing)");
  p("Issues identified and fixed during the development conversation with the Base44 agent:");

  h3("RSVP Button Unresponsiveness (EventCard)");
  p("The RSVP buttons in chat EventCards were completely unresponsive. Root cause: mutation silently returned when data was missing, and onSettled cleared optimistic state too eagerly. Fix: Set optimisticRsvp state immediately in click handler, throw errors in mutationFn (so onError fires), added toast on error, removed onSettled, only clear optimistic state on error (not success).");

  h3("Persistent Unread Notification Badges");
  p("Unread badges persisted after reading messages. Root cause: ChannelMember.unread_count not being reset optimistically, and NotificationBell popover didn't close on notification select. Fix: Optimistic onMutate in clearUnreadMutation sets unread_count: 0 immediately, NotificationBell closes popover on select, EventCard hides buttons after RSVP with optimistic updates.");

  h3("Notification Routing (team_id → channel_id)");
  p("Notifications were not routing correctly because they used team_id instead of channel_id. Fix: Notification logic now maps team_id to the correct channel_id for accurate badge routing. Event metadata (title, date, location) included in notification payloads for complete EventCard rendering.");

  h3("ChannelMember RLS for Self-Update");
  p("Parents couldn't update their own unread_count because the RLS only allowed staff updates. Fix: Updated ChannelMember RLS to allow users to update their own records (data.user_email === user.email).");

  h3("RSVP Actions Using Dummy Reactions");
  p("RSVP actions in EventCards were using MessageReaction records as a placeholder instead of real AttendanceResponse and CarpoolRequest records. Fix: Replaced reaction-based actions with real entity mutations.");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 12: SUCCESSES & WINS
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("12. Successes & Wins");
  p("Despite the challenges, the CU Connect platform has achieved significant milestones. This section documents the key successes.");

  h2("12.1 Security Hardening");
  callout("Security Audit: 10/10 Findings Resolved", "A comprehensive security audit identified 10 vulnerabilities (IDOR, session replay, mass assignment, stored XSS, missing RLS, token bypass, and more). All 10 were remediated, verified with before/after evidence, and cleared for beta launch on June 19, 2026. The platform now has defense-in-depth with session revocation, DB-level role verification, strict input validation, and team-scoped access control.", "success");

  h2("12.2 Performance Optimization");
  callout("API Calls Reduced 80%", "The messaging system was generating 40-60 API requests per minute due to aggressive polling across 5 independent components. By replacing polling with Base44 realtime subscriptions (Message.subscribe, MessageReaction.subscribe) and adding visibility-aware polling pauses, API volume was reduced to under 10 req/min — an 80% reduction that eliminated rate limit errors.", "success");

  h2("12.3 Real-Time Messaging");
  bullet("Realtime subscriptions for messages and reactions provide instant updates without polling");
  bullet("Push notifications delivered via FCM for both web and native (iOS/Android) platforms");
  bullet("Unread count tracking with optimistic UI updates for instant badge clearing");
  bullet("Thread/reply support for organized discussions");

  h2("12.4 Comprehensive Feature Set");
  bullet("50+ entities covering every aspect of youth sports management");
  bullet("60+ backend functions for integrations, automations, and security");
  bullet("12 active automations (7 scheduled, 5 entity-triggered) — all running successfully");
  bullet("30+ frontend pages with role-aware routing and access control");
  bullet("Full Stripe payment integration (Live Mode) with webhook processing");
  bullet("Mobile-first PWA with native iOS/Android builds via Capacitor");
  bullet("Comprehensive parent portal with family access management");
  bullet("RSVP/attendance system with optimistic UI and toast error handling");
  bullet("Carpool coordination with team-wide broadcasting");
  bullet("Playbook distribution with athlete engagement tracking");
  bullet("Film study with viewing analytics");
  bullet("Statistics with CSV/Excel upload and LLM-powered extraction");
  bullet("Volunteer coordination with role-based signups");
  bullet("Document management with digital signature requests");
  bullet("Calendar subscription (iCal) with secure token-based access");
  bullet("Weather alerts for outdoor events");
  bullet("Snack assignment reminders");
  bullet("Coach compliance tracking (background checks, NAYS certification)");

  h2("12.5 User Experience");
  bullet("Dark theme with gold accent — distinctive and professional");
  bullet("Safe-area inset support for iOS notch/home indicator");
  bullet("Pull-to-refresh with visual indicators");
  bullet("Long-press for emoji reactions on messages");
  bullet("Swipe-to-reply gesture");
  bullet("Optimistic UI updates across RSVP, messaging, and notifications");
  bullet("Toast notifications for user feedback");
  bullet("Loading states and empty states throughout");
  bullet("Responsive design (mobile + tablet + desktop)");

  h2("12.6 Architectural Wins");
  bullet("Clean separation: entities (data), functions (logic), pages (UI), components (reusable UI)");
  bullet("TanStack Query for all server state — caching, optimistic updates, background refetching");
  bullet("Denormalized fields (team_name, sport_name, player_name) for query efficiency");
  bullet("JSON metadata fields for flexible message content without schema changes");
  bullet("Shared auth context with role-based routing and access control");
  bullet("Reusable component library (shadcn/ui) with consistent design system");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 13: CURRENT STATE
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("13. Current State");
  p("As of August 2, 2026, the CU Connect platform is a feature-complete, security-hardened application ready for beta launch. Here is the current state of each major system.");

  h2("13.1 System Status Summary");
  table(
    ["System", "Status", "Notes"],
    [
      ["Authentication & Sessions", "Production Ready", "Session revocation, DB-level role verification, all security gates active"],
      ["Messaging & Chat", "Production Ready", "Realtime subscriptions, optimistic updates, all UI/UX fixes applied"],
      ["RSVP & Attendance", "Production Ready", "Optimistic UI with toast errors, real AttendanceResponse mutations"],
      ["Carpool Coordination", "Production Ready", "Request creation, channel broadcasting, daily cleanup"],
      ["Schedule & Calendar", "Production Ready", "List + calendar views, PDF/CSV import, iCal subscription, weather alerts"],
      ["Payments & Stripe", "Production Ready (Live Mode)", "Checkout sessions, webhook processing, invoice management. No products in catalog yet."],
      ["Parent Portal", "Production Ready", "Full family access management, athlete cards, RSVP, payments, documents"],
      ["Push Notifications", "Production Ready", "FCM web + native, batched delivery, granular preferences"],
      ["Playbooks", "Production Ready", "Document upload, assignment, submission tracking, athlete engagement"],
      ["Film Study", "Production Ready", "Clip upload, assignment, viewing analytics"],
      ["Statistics", "Production Ready", "CSV/Excel upload, LLM extraction, dashboards, leaderboards"],
      ["Volunteers", "Production Ready", "Role-based opportunities, signups, coverage tracking"],
      ["Documents & Signatures", "Production Ready", "Document storage, signature requests, compliance tracking"],
      ["Security", "Cleared for Beta", "All 10 Phase 1 findings resolved. Phase 2 deferred."],
      ["UI/UX", "Mostly Fixed", "Critical + High issues fixed. Medium + Low issues tracked."],
    ],
    [120, 100, 290]
  );

  h2("13.2 Active Automations (All Running)");
  p("All 12 automations are active and running successfully. The last run status for each is 'success' with 0 consecutive failures. Scheduled automations run via AWS EventBridge.");

  h2("13.3 Data Scale");
  bullet("50+ entity types in the data model");
  bullet("60+ backend functions deployed");
  bullet("12 automations (7 scheduled + 5 entity-triggered)");
  bullet("30+ frontend pages");
  bullet("100+ React components");
  bullet("5 Stripe secrets configured (live + test keys, webhook secret)");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 14: KNOWN GAPS & NEXT STEPS
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("14. Known Gaps & Recommended Next Steps");
  p("This section outlines known gaps, deferred work, and recommended next steps for the AI reviewer (Claude) to consider.");

  h2("14.1 Deferred Security Work (Phase 2)");
  bullet("Rate limiting on public endpoints (AccessRequest creation, ParentSignup)");
  bullet("CAPTCHA on public forms to prevent bot submissions");
  bullet("Verbose error message cleanup (avoid leaking internal details)");
  bullet("CDN configuration and DDoS mitigation");
  bullet("WAF (Web Application Firewall) rules");
  bullet("NPM dependency vulnerability scanning");
  bullet("Penetration testing of Stripe webhook endpoints beyond signature validation");
  bullet("Mobile binary analysis (iOS/Android compiled artifacts)");

  h2("14.2 Remaining UI/UX Issues");
  p("From the 18 findings in the UI/UX audit, the following are not yet fully resolved:");
  bullet("U-05: Hardcoded timezone in message timestamps — should use useOrgTimezone() hook");
  bullet("U-06: Theme inconsistency in some messaging components — audit for hardcoded color classes");
  bullet("U-07: ScoreCard component — may need further refinement");
  bullet("U-08: Channel name truncation — add max-w + title attribute");
  bullet("U-09: Empty state contrast — remove opacity-50 from muted text");
  bullet("U-10: Top bar icon edge margins — verify safe-area-right is applied");
  bullet("U-11: Mute toggle visibility — increase amber opacity");
  bullet("U-12: Hide/unhide buttons on mobile — verify always-visible on touch devices");
  bullet("U-13: Dynamic composer placeholder with channel name");
  bullet("U-14: Haptic feedback for pull-to-refresh");
  bullet("U-15: Sponsor ticker dismiss/collapse mechanism");
  bullet("U-16: Avatar clipping in chat header");
  bullet("U-18: Dashboard staleTime optimization");

  h2("14.3 Feature Gaps");
  bullet("No Stripe products configured in the catalog — checkout sessions are created dynamically per invoice");
  bullet("Athlete portal (for promoted athletes) — the User role 'athlete' exists but the athlete-facing portal may need further development");
  bullet("No in-app AI agent — the platform supports agents but none are configured");
  bullet("No OAuth connectors authorized — the platform supports Google Calendar, Slack, etc. but none are connected");
  bullet("Photo gallery (PhotoPost entity exists) — may need UI development");
  bullet("Uniform inventory management — entity exists, UI may need development");

  h2("14.4 Recommended Improvements");
  h3("Short-Term (1-2 Sprints)");
  bullet("Resolve remaining Medium/Low UI/UX findings (U-05 through U-18)");
  bullet("Add staleTime to Dashboard queries (U-18) to reduce unnecessary refetching");
  bullet("Implement dynamic composer placeholder (U-13) for better channel context");
  bullet("Add sponsor ticker dismiss button (U-15)");
  bullet("Verify all messaging components use theme tokens (U-06)");

  h3("Medium-Term (2-4 Sprints)");
  bullet("Phase 2 security hardening (rate limiting, CAPTCHA, error cleanup)");
  bullet("Develop athlete portal for promoted athlete accounts");
  bullet("Build out photo gallery UI (PhotoPost entity)");
  bullet("Implement uniform inventory management UI");
  bullet("Add in-app AI agent for parent support (FAQ, scheduling help)");
  bullet("Connect Google Calendar OAuth connector for native calendar sync");

  h3("Long-Term");
  bullet("Comprehensive end-to-end testing suite");
  bullet("Performance monitoring and alerting");
  bullet("Multi-organization support (if expanding beyond CU)");
  bullet("Advanced analytics dashboard for athletic directors");
  bullet("Automated CI/CD pipeline with security scanning");

  h2("14.5 Technical Debt");
  bullet("Test functions (testSessionLifecycle, testCrossTenantAccess, etc.) should be moved to a separate test environment or removed from production");
  bullet("notificationFixReport function — should be evaluated for removal or integration into monitoring");
  bullet("orphanedRecordCleaner — should be scheduled as an automation rather than manually invoked");
  bullet("MessageRoom entity — appears to be legacy, should be evaluated for removal");
  bullet("DirectMessage entity — overlaps with Channel type 'direct', should be consolidated");

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 15: APPENDIX
  // ═══════════════════════════════════════════════════════════════════════════
  pageBreak();

  h1("15. Appendix: Quick Reference");

  h2("15.1 All Entity Names (Alphabetical)");
  const allEntities = [
    "AccessRequest", "AdminAuditLog", "Announcement", "AppConfig", "AthleticDirector",
    "AuditLog", "BlockedUser", "CalendarToken", "CarpoolRequest", "CarpoolResponse",
    "Channel", "ChannelMember", "CoachProfile", "DirectMessage", "Document",
    "Event", "FieldStatus", "FilmAssignment", "FilmClip", "FilmView",
    "InvoiceTemplate", "LeadershipApplication", "LegalPage", "Message", "MessageReaction",
    "MessageReadReceipt", "MessageReport", "MessageRoom", "NotificationPreference", "NotificationQueue",
    "Payment", "PendingChild", "PhotoPost", "Play", "Playbook",
    "PlaybookAssignment", "PlaybookSubmission", "Player", "PlayerDocument", "PlayerGuardian",
    "PlayerStats", "Playlist", "PlayReview", "RegistrationApplication", "RegistrationSubmission",
    "Season", "SignatureRequest", "SnackAssignment", "Sport", "Sponsor",
    "Team", "TeamRegistration", "UniformInventory", "User", "UserChatPreference",
    "UserSession", "VolunteerAssignment", "VolunteerOpportunity", "VolunteerRole"
  ];
  p(allEntities.join(", "), { size: 9 });

  h2("15.2 All Backend Functions (Alphabetical)");
  const allFunctions = [
    "adminDeleteAccount", "approveParentRequest", "authorizeObjectAccess", "autoUpgradeParentRole",
    "blockUser", "bulkInviteUsers", "cleanupExpiredCarpools", "complianceCron", "createCheckout",
    "deleteAccount", "extractBaseballStats", "extractTeamStats", "gameDayWeatherAlert", "gameReminder",
    "generateCalendarToken", "getBlockedIds", "getEventsFiltered", "getMessagesFiltered", "getPushConfig",
    "getSecurityReportUrl", "handleApproval", "icsCalendarFeed", "invalidateAllSessions", "inviteParent",
    "inviteStaff", "linkRelayEmail", "notificationFixReport", "onEventCreated", "onGuardianCreated",
    "onMessageCreated", "onScoreReported", "onUserCreated", "orphanedRecordCleaner", "parentSignup",
    "parsePdfSchedule", "parseRosterFile", "processNotifications", "propagateTeamNameChange",
    "registrationArchivalCron", "registrationCheckout", "requireAdminAuth", "revokeCalendarToken",
    "revokeSession", "rotateToken", "saveSubscription", "secureGetRecord", "securityReport",
    "sendDocumentReminder", "sendFilmAssignment", "sendInvoiceReminder", "sendPushNotification",
    "sendSnackReminder", "stripeWebhook", "testAdminGateE2E", "testCrossTenantAccess",
    "testInvalidationE2E", "testSessionDeath", "testSessionLifecycle", "testTenantIsolation",
    "testTokenReuseAfterLogout", "toggleRegistrationStatus", "trackSession", "unblockUser",
    "updateParentName", "validateSession", "verifyRole"
  ];
  p(allFunctions.join(", "), { size: 9 });

  h2("15.3 All Pages (Alphabetical)");
  const allPages = [
    "AccountSettings", "Announcements", "Applications", "AthleticDirectors", "AuditLog",
    "CoachesTraining", "Dashboard", "DataExport", "Documents", "GameDayPlaylists",
    "Gallery", "HelpCenter", "IssuesFixedReport", "LegalPages", "MessagesLayout",
    "NotificationSettings", "ParentCalendar", "ParentPortal", "ParentSignup", "ParentSportsRegister",
    "PendingAccess", "Playbooks", "PracticePlans", "PrivacyPolicy", "Register",
    "SRD", "Schedule", "SeasonManager", "SecurityReport", "Sports",
    "Teams", "TeamDetail", "UIUXAuditReport", "Volunteers", "Welcome", "AcceptInvite"
  ];
  p(allPages.join(", "), { size: 9 });

  h2("15.4 Environment Secrets");
  bullet("STRIPE_SECRET_KEY — Stripe API secret key (live mode)");
  bullet("STRIPE_PUBLISHABLE_KEY — Stripe publishable key (frontend)");
  bullet("STRIPE_TEST_SECRET_KEY — Stripe test mode secret key");
  bullet("STRIPE_TEST_PUBLISHABLE_KEY — Stripe test mode publishable key");
  bullet("STRIPE_WEBHOOK_SECRET — Stripe webhook signature verification secret");

  h2("15.5 File Structure Overview");
  codeBlock(`src/
  App.jsx              — Root component (Router, Auth, QueryClient)
  pages.config.js      — Auto-generated page config (mainPage setting)
  index.css            — Design tokens + global styles
  components/
    AppShell.jsx       — Main routing shell (auth, redirects, layout)
    layout/            — AppLayout, TopBar, BottomTabBar, Sidebar
    messages/          — ChatSidebar, ChatCanvas, Composer, ThreadSidebar
    messages/cards/    — EventCard, ScoreCard
    parentportal/      — ParentPortal components
    schedule/          — Calendar views, event forms, importers
    admin/             — Admin panels
    reports/           — PDF report builders
    ui/                — shadcn/ui component library
  pages/               — All page components
  lib/                 — AuthContext, query-client, utils
  hooks/               — Custom hooks (useOrgTimezone, usePushNotifications, etc.)
  api/
    base44Client.js    — Pre-initialized Base44 SDK client
base44/
  entities/            — JSON schema entity definitions
  functions/           — Backend function entry points (entry.ts)
  agents/              — AI agent configurations
  shared/              — Shared backend modules`);

  h2("15.6 Document End");
  divider([200, 168, 75]);
  p("This document was generated on August 2, 2026, from the CU Connect platform codebase, existing audit reports (Security, UI/UX, Issues Fixed), and development conversation history. It is intended for AI review and development planning. Classification: Internal.", { color: LIGHT_GRAY, size: 8.5 });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER TABLE OF CONTENTS (on the placeholder page)
  // ═══════════════════════════════════════════════════════════════════════════
  renderTocLater();

  return doc;
}