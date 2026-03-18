import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Megaphone, Trophy, UserCircle, FileText, CreditCard, Download, DollarSign, LogOut } from "lucide-react";
import { format } from "date-fns";
import PlayerDocuments from "@/components/parentportal/PlayerDocuments";
import { PlayerPaymentCard } from "@/components/parentportal/PlayerPayments";
import LinkPlayerByEmail from "@/components/parentportal/LinkPlayerByEmail";
import CalendarView from "@/components/schedule/CalendarView";
import EventDetailPanel from "@/components/schedule/EventDetailPanel";
import CalendarExportPanel from "@/components/schedule/CalendarExportPanel";
import { useLocation } from "react-router-dom";

const TABS = [
  { id: "overview", label: "Overview", icon: Trophy },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
];

export default function ParentPortal() {
  const location = useLocation();
  const isStandalone = location.pathname === "/Portal"; // true when accessed without admin sidebar
  const [userEmail, setUserEmail] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [playerLinked, setPlayerLinked] = useState(false);
  const [calendarView, setCalendarView] = useState("month");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [filterTeam, setFilterTeam] = useState("all");
  const [loadingPayFor, setLoadingPayFor] = useState(null);
  const [loadingPayAll, setLoadingPayAll] = useState(false);

  // Check for payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setActiveTab("payments");
    }
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setUserEmail(u?.email); }).catch(() => {});
  }, [playerLinked]);

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-all", userEmail],
    queryFn: () => base44.entities.Payment.list(),
    enabled: !!userEmail,
  });

  const myKids = userEmail ? players.filter(p => p.parent_email === userEmail) : [];
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const myEvents = events.filter(e => myTeamIds.includes(e.team_id) && e.date).sort((a, b) => new Date(a.date) - new Date(b.date));
  const myUpcomingEvents = myEvents.filter(e => new Date(e.date) >= new Date(new Date().toDateString()));
  const myAnnouncements = announcements.filter(a =>
    a.target === "org" || myTeamIds.includes(a.target_id) || myTeams.some(t => t.sport_id === a.target_id)
  );

  const myKidIds = new Set(myKids.map(k => k.id));
  const myUnpaidInvoices = allPayments.filter(p => myKidIds.has(p.player_id) && p.status !== "paid");
  const totalAllOwed = myUnpaidInvoices.reduce((sum, p) => sum + (p.amount || 0), 0);

  const handlePayPlayer = async (player, unpaidInvoices) => {
    const isIframe = window.self !== window.top;
    if (isIframe) { alert("Payments can only be processed from the published app."); return; }
    setLoadingPayFor(player.id);
    const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const descriptions = unpaidInvoices.map(i => i.description).join(", ");
    const res = await base44.functions.invoke("createCheckout", {
      amount: totalAmount,
      description: `${descriptions} – ${player.first_name} ${player.last_name} (${player.team_name})`,
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      team_name: player.team_name,
    });
    setLoadingPayFor(null);
    if (res.data?.url) window.location.href = res.data.url;
  };

  const handlePayAll = async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) { alert("Payments can only be processed from the published app."); return; }
    setLoadingPayAll(true);
    const descriptions = myKids.map(k => {
      const kidInvoices = myUnpaidInvoices.filter(p => p.player_id === k.id);
      if (!kidInvoices.length) return null;
      return `${k.first_name} ${k.last_name}: ${kidInvoices.map(i => i.description).join(", ")}`;
    }).filter(Boolean).join(" | ");
    const firstUnpaidKid = myKids.find(k => myUnpaidInvoices.some(p => p.player_id === k.id));
    const res = await base44.functions.invoke("createCheckout", {
      amount: totalAllOwed,
      description: descriptions || "All outstanding balances",
      player_id: firstUnpaidKid?.id || "",
      player_name: "Multiple Players",
      team_name: myKids.map(k => k.team_name).filter(Boolean).join(", "),
    });
    setLoadingPayAll(false);
    if (res.data?.url) window.location.href = res.data.url;
  };

  const typeColors = {
    practice: "bg-blue-500/20 text-blue-400",
    game: "bg-green-500/20 text-green-400",
    tournament: "bg-purple-500/20 text-purple-400",
    meeting: "bg-orange-500/20 text-orange-400",
    fundraiser: "bg-yellow-500/20 text-yellow-400",
    other: "bg-cyan-500/20 text-cyan-400",
  };

  if (myKids.length === 0) {
    const isLoggedIn = !!userEmail;
    return (
      <div className={isStandalone ? "min-h-screen bg-background" : ""}>
      {isStandalone && (
        <header className="sticky top-0 z-30 bg-sidebar border-b border-sidebar-border px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold text-primary">Cornerstone United</span>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Parent Portal</p>
            </div>
          </div>
          {user && (
            <button onClick={() => base44.auth.logout(window.location.href)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </header>
      )}
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
          ) : (
            <>
              <p className="text-muted-foreground max-w-sm mx-auto">
                No players are linked to <span className="text-primary">{userEmail}</span> yet.
              </p>
              <LinkPlayerByEmail
                currentUserEmail={userEmail}
                onLinked={() => setPlayerLinked(p => !p)}
              />
              <p className="text-xs text-muted-foreground mt-4">
                If you can't find your player, contact your organization admin to verify your email on file.
              </p>
            </>
          )}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className={isStandalone ? "min-h-screen bg-background" : ""}>
      {/* Standalone top bar for /Portal route */}
      {isStandalone && (
        <header className="sticky top-0 z-30 bg-sidebar border-b border-sidebar-border px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold text-primary">Cornerstone United</span>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Parent Portal</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:block">{user.full_name || user.email}</span>
              <button
                onClick={() => base44.auth.logout(window.location.href)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          )}
        </header>
      )}

      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parent Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Manage your kids' teams, documents, and payments.</p>
        </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* My Kids */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myKids.map(kid => {
              const team = teams.find(t => t.id === kid.team_id);
              return (
                <div key={kid.id} className="bg-card rounded-2xl border border-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{kid.first_name[0]}{kid.last_name[0]}</span>
                    </div>
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
                </div>
              );
            })}
          </div>

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
                      <span className="text-xs text-muted-foreground">{format(new Date(event.date), "MMM")}</span>
                      <span className="text-xl font-bold text-foreground">{format(new Date(event.date), "dd")}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[event.type] || ""}`}>{event.type}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{event.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        {event.start_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {event.start_time}</span>}
                        {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>}
                        <span className="text-primary">{event.team_name}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            setCalendarView={setCalendarView}
            onEventClick={setSelectedEvent}
          />

          {selectedEvent && <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
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
          <p className="text-sm text-muted-foreground">Upload required documents for each player (birth certificates, physicals, insurance cards, etc.)</p>
          {myKids.map(kid => <PlayerDocuments key={kid.id} player={kid} />)}
        </div>
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
    </div>
  );
}