import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Megaphone, Trophy, UserCircle, FileText, CreditCard, Download, DollarSign, LogOut, MessageSquare, Users } from "lucide-react";
import { formatDate, formatTime12h, parseLocalDate } from "@/utils/dateTime";
import { format } from "date-fns";
import PlayerDocuments from "@/components/parentportal/PlayerDocuments";
import ParentSignatureRequests from "@/components/documents/ParentSignatureRequests";
import { PlayerPaymentCard } from "@/components/parentportal/PlayerPayments";
import LinkPlayerByEmail from "@/components/parentportal/LinkPlayerByEmail";
import AddChildForm from "@/components/parentportal/AddChildForm";
import CalendarView from "@/components/schedule/CalendarView";
import EventDetailPanel from "@/components/schedule/EventDetailPanel";
import CalendarExportPanel from "@/components/schedule/CalendarExportPanel";
import { useLocation, Link } from "react-router-dom";
import InviteCoGuardian from "@/components/parentportal/InviteCoGuardian";
import ContactAD from "@/components/parentportal/ContactAD";
import { useAuth } from "@/lib/AuthContext";
import PushNotificationBanner from "@/components/notifications/PushNotificationBanner";
import PerformanceHero from "@/components/dashboard/PerformanceHero";
import RosterPDFButton from "@/components/roster/RosterPDFButton";
import FamilyDashboardStats from "@/components/parentportal/FamilyDashboardStats";
import TeamRosterView from "@/components/parentportal/TeamRosterView";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import AthleteCard from "@/components/parentportal/AthleteCard";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import DeleteAccountModal from "@/components/parentportal/DeleteAccountModal";
import PromoteAthleteModal from "@/components/parentportal/PromoteAthleteModal";
import FamilyAccessManager from "@/components/parentportal/FamilyAccessManager";
import RsvpVolunteerTab from "@/components/parentportal/RsvpVolunteerTab";
import AthleteProfileModal from "@/components/parentportal/AthleteProfileModal";
import OpenRegistrationsPanel from "@/components/parentportal/OpenRegistrationsPanel";
import SmartRsvpPanel from "@/components/parentportal/SmartRsvpPanel";

const ALL_TABS = [
  { id: "overview", label: "Overview", icon: Trophy },
  { id: "athlete-cards", label: "Athlete Cards", icon: UserCircle },
  { id: "schedule", label: "Schedule", icon: Calendar, permission: "view_calendar" },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard, permission: "financial_contributor" },
  { id: "messages", label: "Messages", icon: MessageSquare, permission: "view_messages" },
  { id: "rsvp-volunteers", label: "RSVP, Snacks & Carpool", icon: Users },
];

// Tabs always visible to restricted family members regardless of granted permissions --
// these three have no dedicated permission checkbox in the invite flow (only
// Schedule/Payments/Messages do, via view_calendar/financial_contributor/
// view_messages), so there'd be no way for a restricted guardian to ever regain them
// otherwise. Matthew's call (Aug 9, 2026): Documents, Athlete Cards, and RSVP/Snacks/
// Carpool should stay visible to every family member regardless of granted
// permissions -- only Payments (and Schedule/Messages, unchanged) are meant to be
// gated by what was actually granted at invite time.
const GRANDPARENT_ALWAYS_VISIBLE = ["overview", "documents", "athlete-cards", "rsvp-volunteers"];

export default function ParentPortal() {
  const location = useLocation();
  const isStandalone = location.pathname === "/ParentPortal";
  const { user, isLoadingAuth, refreshUser } = useAuth();
  const userEmail = user?.email;
  const isGrandparent = user?.role === "grandparent";

  const [activeTab, setActiveTab] = useState("overview");
  const [playerLinked, setPlayerLinked] = useState(false);
  // LinkPlayerByEmail was imported here but never actually rendered anywhere
  // in the app -- confirmed via a full-codebase search, it's the only file
  // that imports it besides its own definition. That made the QA plan's
  // "Link Player by Email" test case (search by the email a child was
  // registered under, as opposed to AddChildForm's name/DOB search) entirely
  // unreachable. Wiring it in here as an alternate path alongside AddChildForm
  // in the zero-kids empty state, where it clearly was always meant to go.
  const [showEmailSearch, setShowEmailSearch] = useState(false);

  const PREF_KEY = `cu_cal_view_${userEmail || "default"}`;
  const savedCalView = (() => { try { return localStorage.getItem(PREF_KEY); } catch { return null; } })();
  const [calendarView, setCalendarView] = useState(savedCalView || "month");

  const handleCalendarViewChange = (view) => {
    setCalendarView(view);
    try { localStorage.setItem(PREF_KEY, view); } catch {};
  };
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [filterTeam, setFilterTeam] = useState("all");
  const [loadingPayFor, setLoadingPayFor] = useState(null);
  const [loadingPayAll, setLoadingPayAll] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [promotingPlayer, setPromotingPlayer] = useState(null);
  const [selectedAthlete, setSelectedAthlete] = useState(null);

  // Refresh user on mount so name changes made by admin are reflected immediately
  useEffect(() => {
    if (refreshUser) refreshUser();
  }, []);

  // Check for payment return, game reminder confirm, or event deep-link
  const [highlightAttendanceId, setHighlightAttendanceId] = useState(null);
  const [deepLinkedEventId, setDeepLinkedEventId] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setActiveTab("payments");
    }
    const confirmId = params.get("confirm");
    if (confirmId) {
      setHighlightAttendanceId(confirmId);
      setActiveTab("rsvp-volunteers");
    }
    const eventId = params.get("eventId");
    if (eventId) {
      setDeepLinkedEventId(eventId);
      setActiveTab("schedule");
    }
    // Generic deep-link support for any tab id -- this page never actually read a
    // `tab` query param before, so ParentHome.jsx's "Balance due" alert, "Payments"
    // Finance card, and "documents need your signature" alert (all of which link to
    // /ParentPortal?tab=payments or ?tab=documents) silently landed on Overview
    // instead of the intended tab. Validated against the known tab ids so a garbage/
    // typo'd value can't set activeTab to something with no matching render block.
    const tabParam = params.get("tab");
    if (tabParam && ALL_TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const { data: myGuardianLinks = [] } = useQuery({
    queryKey: ["my-guardian-links", userEmail, playerLinked],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: userEmail }),
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
    staleTime: 60_000,
  });

  // getMyPlayers unions Player.parent_email matches with PlayerGuardian links
  // server-side (asServiceRole), since RLS can't join Player -> PlayerGuardian.
  // (Kept separate from `players` above, which is still used for team-roster
  // display elsewhere on this page.)
  const { data: myLinkedPlayers = [] } = useQuery({
    queryKey: ["my-players-portal", userEmail, playerLinked],
    queryFn: async () => {
      const res = await base44.functions.invoke("getMyPlayers", {});
      return res.data?.players || [];
    },
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  // Aggregate permissions from all guardian links (for restricted family members)
  const myPermissions = new Set(
    myGuardianLinks.flatMap(g => g.permissions || [])
  );

  // FIX (Aug 9, 2026): isRestrictedFamily used to be `user.role === "grandparent"`
  // only. But no code path (onUserCreated / autoUpgradeParentRole) ever assigns that
  // role from the parent-initiated "Invite Family Member" co-guardian flow -- every
  // co-guardian invited that way, regardless of real-world relationship or the
  // view_calendar/view_messages/financial_contributor checkboxes selected at invite
  // time, ends up with role "parent" like anyone else. That made the permission
  // system restrict nothing in practice for its actual primary use case: any invited
  // co-guardian saw every tab. The real signal for "this caller should be permission-
  // gated" is whether they're ONLY a secondary guardian -- i.e. not the primary
  // Player.parent_email match on ANY of their linked players -- not their role string.
  // Kept `isGrandparent` as an additional OR so the (separate, admin-initiated,
  // still-functional) staff "Invite Parent/Grandparent" path's role assignment keeps
  // working exactly as before.
  const isPrimaryForAnyKid = myLinkedPlayers.some(p => p.parent_email === userEmail);
  const isRestrictedFamily = isGrandparent || (myLinkedPlayers.length > 0 && !isPrimaryForAnyKid);

  // Derive visible tabs based on permissions
  const TABS = ALL_TABS.filter(tab => {
    if (!isRestrictedFamily) return true; // full parents/staff see everything
    if (GRANDPARENT_ALWAYS_VISIBLE.includes(tab.id)) return true;
    if (!tab.permission) return false; // tabs with no permission key are hidden for restricted users
    return myPermissions.has(tab.permission);
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
    staleTime: 60_000,
  });
  // getEventsFiltered scopes events server-side (asServiceRole) to this
  // parent's children's teams, same pattern as getMyPlayers/getPhotosFiltered,
  // since RLS on Event can only role-gate (no relational join to team).
  const { data: events = [] } = useQuery({
    queryKey: ["events-parent-portal", userEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke("getEventsFiltered", {});
      return res.data?.events || [];
    },
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  // Auto-open event detail panel when deep-linked via ?eventId=
  useEffect(() => {
    if (!deepLinkedEventId || !events.length) return;
    const target = events.find(e => e.id === deepLinkedEventId);
    if (target) {
      setSelectedEvent(target);
      setDeepLinkedEventId(null);
    }
  }, [deepLinkedEventId, events]);
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
    staleTime: 60_000,
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
    staleTime: 300_000,
  });

  // getMyPaymentsFiltered scopes invoices server-side (asServiceRole) to whatever this
  // caller is actually authorized to see -- direct parent_email match, a guardian with
  // financial_contributor permission, or the promoted/unpaused athlete themselves --
  // since Payment's RLS read rule can't join to PlayerGuardian (same platform
  // limitation as getMyPlayers/getEventsFiltered). A raw Payment.list() call here
  // silently returned zero invoices for any "financial contributor" guardian whose
  // access depends on the PlayerGuardian link rather than a direct email match --
  // same queryKey shape as PlayerPaymentCard's own fetch so the two share one cache.
  const { data: allPayments = [] } = useQuery({
    queryKey: ["my-payments-filtered"],
    queryFn: async () => {
      const res = await base44.functions.invoke("getMyPaymentsFiltered", {});
      return res.data?.payments || [];
    },
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  // My linked players — resolved server-side via getMyPlayers (see above)
  // since RLS can't join Player -> PlayerGuardian to support co-parents.
  const myKids = userEmail ? myLinkedPlayers : [];
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const myEvents = events.filter(e => myTeamIds.includes(e.team_id) && e.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  // Aug 11, 2026 (Phase 13 QA): e.date is YYYY-MM-DD; new Date(e.date) parses as UTC
  // midnight, which sits BEFORE local "today" in any timezone behind UTC -- was
  // silently dropping today's events from "upcoming" late in the day. Use
  // parseLocalDate so the comparison is local-midnight vs local-midnight.
  const myUpcomingEvents = myEvents.filter(e => parseLocalDate(e.date) >= parseLocalDate(format(new Date(), "yyyy-MM-dd")));
  const myAnnouncements = announcements.filter(a =>
    a.target === "org" || myTeamIds.includes(a.target_id) || myTeams.some(t => t.sport_id === a.target_id)
  );

  const myKidIds = new Set(myKids.map(k => k.id));
  const myUnpaidInvoices = allPayments.filter(p =>
    myKidIds.has(p.player_id) && !["paid","draft","voided","refunded"].includes(p.status)
  );
  const totalAllOwed = myUnpaidInvoices.reduce((sum, p) => sum + (p.amount || 0), 0);

  // RSVP requests for family's teams
  const { data: allAttendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests-parent", myTeamIds.join(",")],
    queryFn: () => base44.entities.AttendanceRequest.list("-created_date"),
    enabled: myTeamIds.length > 0,
    staleTime: 60_000,
  });
  const myAttendanceRequests = allAttendanceRequests.filter(r => myTeamIds.includes(r.team_id));

  // RSVP responses already submitted by this user
  const { data: myRsvpResponses = [] } = useQuery({
    queryKey: ["my-rsvp-responses", userEmail],
    queryFn: () => base44.entities.AttendanceResponse.filter({ responder_email: userEmail }),
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  // Pending signature requests
  const { data: mySignatureRequests = [] } = useQuery({
    queryKey: ["my-sig-requests", userEmail],
    queryFn: async () => {
      if (!myKidIds.size) return [];
      const all = await base44.entities.SignatureRequest.list("-created_date");
      return all.filter(s => myKidIds.has(s.player_id) && s.status === "pending");
    },
    enabled: myKidIds.size > 0,
    staleTime: 60_000,
  });

  // Volunteer assignments
  const { data: myVolunteerAssignments = [] } = useQuery({
    queryKey: ["my-vol-assignments", userEmail],
    queryFn: () => base44.entities.VolunteerAssignment.filter({ volunteer_email: userEmail }),
    enabled: !!userEmail,
    staleTime: 60_000,
  });

  const { data: myAccessRequests = [] } = useQuery({
    queryKey: ["my-access-requests", userEmail],
    queryFn: () => base44.entities.AccessRequest.filter({ parent_email: userEmail }),
    enabled: !!userEmail && myKids.length === 0,
    staleTime: 60_000,
  });
  const pendingRequest = myAccessRequests.find(r => r.status === "pending");
  const approvedRequest = myAccessRequests.find(r => r.status === "approved");

  // Team applications (the canonical "add my athlete" flow) — checked separately
  // from the older AccessRequest system above, so a parent who already applied
  // via /Register isn't shown the raw "add a child" form again.
  const { data: myApplications = [] } = useQuery({
    queryKey: ["my-registration-applications", userEmail],
    queryFn: () => base44.entities.RegistrationApplication.filter({ parent_email: userEmail }),
    enabled: !!userEmail && myKids.length === 0,
    staleTime: 60_000,
  });
  const pendingApplications = myApplications.filter(a => a.status === "pending" || a.status === "waitlisted");

  const handlePayPlayer = async (player, unpaidInvoices) => {
    const isIframe = window.self !== window.top;
    if (isIframe) { alert("Payments can only be processed from the published app."); return; }
    setLoadingPayFor(player.id);
    const res = await base44.functions.invoke("createCheckout", {
      invoice_ids: unpaidInvoices.map(i => i.id),
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      team_name: player.team_name,
    });
    setLoadingPayFor(null);
    if (res.data?.url) window.location.href = res.data.url;
    else alert("Unable to start checkout. Please try again or contact support.");
  };

  const handlePayAll = async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) { alert("Payments can only be processed from the published app."); return; }
    if (myUnpaidInvoices.length === 0) return;
    setLoadingPayAll(true);
    const firstUnpaidKid = myKids.find(k => myUnpaidInvoices.some(p => p.player_id === k.id));
    const res = await base44.functions.invoke("createCheckout", {
      invoice_ids: myUnpaidInvoices.map(i => i.id),
      player_id: firstUnpaidKid?.id || "",
      player_name: "Multiple Players",
      team_name: myKids.map(k => k.team_name).filter(Boolean).join(", "),
    });
    setLoadingPayAll(false);
    if (res.data?.url) window.location.href = res.data.url;
    else alert("Unable to start checkout. Please try again or contact support.");
  };

  // Eligibility: 13+ by date_of_birth ONLY. No team-name bypass — this app has
  // real teams as young as 8u, so a misnamed team (e.g. containing "varsity")
  // must never grant promotion eligibility to a younger athlete.
  //
  // This is purely a client-side "should I show the button" hint — the real
  // enforcement happens server-side in the promoteAthlete function, which
  // hard-rejects under-13 with no exceptions. calcAge() below must stay in
  // exact sync with the server's age calculation so this hint is never more
  // lenient (or stricter) than what the server will actually allow.
  //
  // If date_of_birth is missing entirely, do NOT show the button — there is
  // nothing to fall back on.
  const calcAge = (dobStr) => {
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  };

  const isEligibleForPromotion = (kid) => {
    if (!kid.date_of_birth) return false;
    const age = calcAge(kid.date_of_birth);
    return age !== null && age >= 13;
  };

  const typeColors = {
    practice: "bg-blue-500/20 text-blue-400",
    game: "bg-green-500/20 text-green-400",
    tournament: "bg-purple-500/20 text-purple-400",
    meeting: "bg-orange-500/20 text-orange-400",
    fundraiser: "bg-yellow-500/20 text-yellow-400",
    other: "bg-cyan-500/20 text-cyan-400",
  };

  // Loading spinner
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const standaloneHeader = (
    <header className="sticky top-0 z-30 bg-sidebar border-b border-sidebar-border px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img
          src="https://media.base44.com/images/public/69bae2515552e76ca1fbd6a0/61ac4d66c_file_0000000089d071f8be26c9f306ac7ce1.png"
          alt="CU"
          className="w-9 h-9 object-contain"
        />
        <div>
          <span className="text-sm font-bold text-primary">Cornerstone United</span>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Parent Portal</p>
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">{user.display_name || user.full_name || user.email}</span>
          <button onClick={() => base44.auth.logout(window.location.href)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      )}
    </header>
  );

  if (myKids.length === 0) {
    const isLoggedIn = !!user;
    return (
      <div className={isStandalone ? "min-h-screen bg-background overflow-x-hidden" : "overflow-x-hidden"}>
        <DeleteAccountModal open={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />
        {isStandalone && standaloneHeader}
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="text-center py-10 bg-card rounded-2xl border border-border px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-9 h-9 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Parent Portal</h2>

          {!isLoggedIn ? (
            <>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Sign in or create a free account to access your child's schedule, documents, and payments.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => base44.auth.redirectToLogin(window.location.href)}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => base44.auth.redirectToLogin(window.location.href)}
                  className="px-6 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-surface transition-colors"
                >
                  Create Account
                </button>
              </div>
            </>
          ) : pendingApplications.length > 0 ? (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  {pendingApplications.length > 1 ? "Your applications are under review" : "Your application is under review"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pendingApplications.map(a => `${a.athlete_first_name} ${a.athlete_last_name}`).join(", ")}
                  {" — "}a coach or admin needs to approve {pendingApplications.length > 1 ? "these" : "this"} before it shows up here. You'll get a notification once approved.
                </p>
              </div>
            </div>
          ) : pendingRequest ? (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto">
                <span className="text-2xl">⏳</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">You're almost there!</h3>
                <p className="text-sm text-muted-foreground">
                  Thanks for signing up! Your account is being reviewed and connected to your child's team. You'll receive an email once access is ready.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Questions? Contact your organization admin.
              </p>
            </div>
          ) : approvedRequest ? (
            <div className="space-y-4 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Your account is ready!</h3>
                <p className="text-sm text-muted-foreground">
                  Welcome to Cornerstone! We're finishing connecting you to your child's team. Try refreshing the page, or contact your admin if this persists.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                We're finishing your setup. If your admin has sent you an invite, check your email. Otherwise, add your child below — if they're already in the system we'll link you automatically, otherwise we'll submit their info for review.
              </p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowEmailSearch(false)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${!showEmailSearch ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-border"}`}
                >
                  Add Your Child
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailSearch(true)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${showEmailSearch ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-border"}`}
                >
                  I Know the Registration Email
                </button>
              </div>
              {showEmailSearch ? (
                <LinkPlayerByEmail
                  currentUserEmail={userEmail}
                  parentName={user?.full_name || user?.display_name || ""}
                  onLinked={() => setPlayerLinked(p => !p)}
                />
              ) : (
                <AddChildForm
                  parentEmail={userEmail}
                  parentName={user?.full_name || user?.display_name || ""}
                  onChildAdded={() => setPlayerLinked(p => !p)}
                />
              )}
            </>
          )}
        </div>
        {isStandalone && user && (
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowDeleteAccount(true)}
              className="text-xs text-red-500/70 hover:text-red-400 transition-colors underline underline-offset-2"
            >
              Delete My Account
            </button>
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className={isStandalone ? "min-h-screen bg-background overflow-x-hidden" : "overflow-x-hidden"}>
    {isStandalone && standaloneHeader}
    {selectedAthlete && (
      <AthleteProfileModal
        player={selectedAthlete}
        team={teams.find(t => t.id === selectedAthlete.team_id)}
        sport={sports.find(s => s.id === teams.find(t => t.id === selectedAthlete.team_id)?.sport_id)}
        events={myEvents}
        onClose={() => setSelectedAthlete(null)}
      />
    )}
    {promotingPlayer && (
      <PromoteAthleteModal
        player={promotingPlayer}
        currentUserEmail={userEmail}
        onClose={() => setPromotingPlayer(null)}
        onPromoted={() => { setPromotingPlayer(null); setPlayerLinked(p => !p); }}
      />
    )}
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parent Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Manage your athletes' teams, documents, and payments.</p>
        </div>

        <PushNotificationBanner />

      {/* Tabs — horizontal scroll on mobile, no wrapping */}
      <div className="bg-surface rounded-xl p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">

          {/* Restricted access notice for family members */}
          {isRestrictedFamily && (
            <div className="flex items-start gap-3 bg-primary/10 border border-primary/20 rounded-2xl p-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Family Member Access</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You have access to: {myPermissions.size === 0 ? "Overview only" : [...myPermissions].map(p => ({
                    view_calendar: "Calendar",
                    view_messages: "Messages",
                    financial_contributor: "Payments",
                  }[p] || p)).join(", ")}.
                  Contact the primary parent to update your permissions.
                </p>
              </div>
            </div>
          )}

          {/* Family Analytics Stats */}
          <FamilyDashboardStats
            upcomingEvents={myUpcomingEvents}
            myKids={myKids}
            unpaidCount={myUnpaidInvoices.length}
            pendingDocs={mySignatureRequests.length}
            rsvpRequests={myAttendanceRequests}
            rsvpResponses={myRsvpResponses}
            volunteerAssignments={myVolunteerAssignments}
            onStatClick={(tab) => setActiveTab(tab)}
          />

          {/* Smart RSVP Panel — 7-day action-driven view */}
          <SmartRsvpPanel
            myAttendanceRequests={myAttendanceRequests}
            myUpcomingEvents={myUpcomingEvents}
            user={user}
            myKids={myKids}
            userEmail={userEmail}
          />

          {/* My Kids */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myKids.map(kid => {
              const team = teams.find(t => t.id === kid.team_id);
              const kidTeamPlayers = players.filter(p => p.team_id === kid.team_id && p.is_active !== false);
              return (
                <div key={kid.id} className="bg-card rounded-2xl border border-border p-5 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setSelectedAthlete(kid)}>
                  <div className="flex items-center gap-3 mb-3">
                    <PlayerAvatar player={kid} size="lg" />
                    <div>
                      <h3 className="font-semibold text-foreground">{kid.first_name} {kid.last_name}</h3>
                      {kid.jersey_number && <p className="text-xs text-primary">#{kid.jersey_number}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trophy className="w-4 h-4" />
                    <span>{team?.name || "Unknown Team"}</span>
                  </div>
                  {kid.position && <p className="text-xs text-muted-foreground mt-1">Position: {kid.position}</p>}
                  {team?.roster_published && (
                    <div className="mt-3">
                      <RosterPDFButton team={team} players={kidTeamPlayers} label="Team Roster PDF" />
                    </div>
                  )}
                  {!kid.is_promoted ? (
                    isEligibleForPromotion(kid) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPromotingPlayer(kid); }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
                      >
                        🎓 Promote to Athlete Account
                      </button>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground text-center">
                        Athlete accounts available at age 13 and up.
                      </p>
                    )
                  ) : (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-green-400">
                      <span>✓</span> Athlete account active ({kid.athlete_email})
                    </div>
                  )}
                  {!isRestrictedFamily && <InviteCoGuardian player={kid} currentUserEmail={userEmail} />}
                </div>
              );
            })}
          </div>

          {/* Family Access Manager — full parents only */}
          {!isRestrictedFamily && myKids.length > 0 && (
            <FamilyAccessManager players={myKids} currentUserEmail={userEmail} />
          )}

          {/* Open Registrations */}
          <OpenRegistrationsPanel myKids={myKids} userEmail={userEmail} />

          {/* Upcoming Events */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> Upcoming Events
            </h3>
            {myUpcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {myUpcomingEvents.slice(0, 8).map(event => (
                  <div key={event.id} className="flex items-start gap-4 p-3 rounded-xl bg-surface">
                    <div className="flex flex-col items-center min-w-[48px]">
                      <span className="text-xs text-muted-foreground">{formatDate(event.date, "MMM")}</span>
                      <span className="text-xl font-bold text-foreground">{formatDate(event.date, "dd")}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[event.type] || ""}`}>{event.type}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime12h(event.start_time)}</span>}
                        {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
                        <span className="text-primary">{event.team_name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Family Performance Hero */}
          <PerformanceHero events={myEvents} teams={myTeams} sports={sports.filter(s => myTeams.some(t => t.sport_id === s.id))} players={myKids} />

          {/* Team Rosters (if published) */}
          {myTeams.some(t => t.roster_published) && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Team Roster{myTeams.filter(t => t.roster_published).length > 1 ? "s" : ""}
              </h3>
              {myTeams.filter(t => t.roster_published).map(team => (
                <TeamRosterView
                  key={team.id}
                  team={team}
                  players={players.filter(p => p.team_id === team.id && p.is_active !== false)}
                />
              ))}
            </div>
          )}

          {/* Announcements */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-primary" /> Announcements
            </h3>
            {myAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No announcements</p>
            ) : (
              <div className="space-y-3">
                {myAnnouncements.slice(0, 5).map(ann => (
                  <div key={ann.id} className="p-4 rounded-xl bg-surface border border-border">
                    <h4 className="text-sm font-semibold text-foreground">{ann.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.content}</p>
                    <span className="text-xs text-muted-foreground mt-2 block">
                      {ann.created_date ? format(new Date(ann.created_date), "MMM d, yyyy") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Athlete Cards Tab */}
      {activeTab === "athlete-cards" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-foreground">Athlete Cards</h3>
            <p className="text-sm text-muted-foreground mt-1">Official digital athlete cards for your players.</p>
          </div>
          <p className="text-sm text-muted-foreground -mt-4">Tap a card to view athlete stats and upcoming events.</p>
          <div className="flex flex-wrap gap-8 justify-start">
            {myKids.map(kid => {
              const team = teams.find(t => t.id === kid.team_id);
              const sport = sports.find(s => s.id === team?.sport_id);
              return (
                <AthleteCard key={kid.id} player={kid} team={team} sport={sport} canEdit={true} onClick={() => setSelectedAthlete(kid)} />
              );
            })}
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Your Team Schedule</h3>
              <p className="text-sm text-muted-foreground">Showing only events for your child's team(s)</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {myTeamIds.length > 1 && (
                <select
                  value={filterTeam}
                  onChange={e => setFilterTeam(e.target.value)}
                  className="text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground"
                >
                  <option value="all">All My Teams</option>
                  {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
          </div>

          <CalendarView
            events={(filterTeam === "all" ? myEvents : myEvents.filter(e => e.team_id === filterTeam))}
            calendarView={calendarView}
            setCalendarView={handleCalendarViewChange}
            onEventClick={setSelectedEvent}
          />

          {selectedEvent && <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} canEdit={false} />}
          {showExport && (
            <CalendarExportPanel
              events={filterTeam === "all" ? myEvents : myEvents.filter(e => e.team_id === filterTeam)}
              teams={myTeams}
              myTeamIds={myTeamIds}
              onClose={() => setShowExport(false)}
            />
          )}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <ParentSignatureRequests myKids={myKids} userEmail={userEmail} userName={user?.display_name || user?.full_name} />
          <p className="text-sm text-muted-foreground">Upload required documents for each player (birth certificates, physicals, insurance cards, etc.)</p>
          {myKids.map(kid => <PlayerDocuments key={kid.id} player={kid} />)}
        </div>
      )}

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <ContactAD sportIds={myTeams.map(t => t.sport_id).filter(Boolean)} />
      )}

      {/* RSVP / Volunteers / Carpool Tab */}
      {activeTab === "rsvp-volunteers" && (
        <RsvpVolunteerTab
          myAttendanceRequests={myAttendanceRequests}
          user={user}
          myKids={myKids}
          userEmail={userEmail}
          userName={user?.display_name || user?.full_name}
          myTeamIds={myTeamIds}
          myTeams={myTeams}
          events={myEvents}
          highlightAttendanceId={highlightAttendanceId}
        />
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Summary Bar */}
          {totalAllOwed > 0 && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-2xl p-4 flex-wrap gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding Balance</p>
                <p className="text-2xl font-bold text-primary">${(totalAllOwed / 100).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Across all {myKids.length} player{myKids.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={handlePayAll}
                disabled={loadingPayAll}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <DollarSign className="w-4 h-4" />
                {loadingPayAll ? "Redirecting..." : "Pay All Balances"}
              </button>
            </div>
          )}

          {totalAllOwed === 0 && allPayments.length > 0 && (
            <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">You're all caught up!</p>
                <p className="text-xs text-muted-foreground">No outstanding balances.</p>
              </div>
            </div>
          )}

          {/* Per-player cards */}
          {myKids.map(kid => (
            <PlayerPaymentCard
              key={kid.id}
              player={kid}
              onPay={handlePayPlayer}
              loadingFor={loadingPayFor}
            />
          ))}
        </div>
      )}
      </div>

      {/* Footer */}
      {isStandalone && (
        <footer className="mt-8 pb-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
            <Link to="/LegalPages" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/LegalPages" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <span>·</span>
            <Link to="/LegalPages" className="hover:text-foreground transition-colors">Payment Terms</Link>
            <span>·</span>
            <Link to="/HelpCenter" className="hover:text-foreground transition-colors">Help Center</Link>
          </div>
          <button
            onClick={() => setShowDeleteAccount(true)}
            className="text-xs text-red-500/70 hover:text-red-400 transition-colors underline underline-offset-2"
          >
            Delete My Account
          </button>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Cornerstone United Athletics</p>
        </footer>
      )}
      <DeleteAccountModal open={showDeleteAccount} onClose={() => setShowDeleteAccount(false)} />
    </div>
  );
}