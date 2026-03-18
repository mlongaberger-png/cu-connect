import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Megaphone, Trophy, UserCircle, FileText, CreditCard } from "lucide-react";
import { format } from "date-fns";
import PlayerDocuments from "@/components/parentportal/PlayerDocuments";
import PlayerPayments from "@/components/parentportal/PlayerPayments";

const TABS = [
  { id: "overview", label: "Overview", icon: Trophy },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
];

export default function ParentPortal() {
  const [userEmail, setUserEmail] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Check for payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setActiveTab("payments");
    }
  }, []);

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
  }, []);

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

  const myKids = userEmail ? players.filter(p => p.parent_email === userEmail) : [];
  const myTeamIds = [...new Set(myKids.map(k => k.team_id))];
  const myTeams = teams.filter(t => myTeamIds.includes(t.id));
  const myEvents = events.filter(e => myTeamIds.includes(e.team_id) && e.date && new Date(e.date) >= new Date(new Date().toDateString())).sort((a, b) => new Date(a.date) - new Date(b.date));
  const myAnnouncements = announcements.filter(a =>
    a.target === "org" || myTeamIds.includes(a.target_id) || myTeams.some(t => t.sport_id === a.target_id)
  );

  const typeColors = {
    practice: "bg-blue-500/20 text-blue-400",
    game: "bg-green-500/20 text-green-400",
    tournament: "bg-purple-500/20 text-purple-400",
    meeting: "bg-orange-500/20 text-orange-400",
    fundraiser: "bg-yellow-500/20 text-yellow-400",
    other: "bg-cyan-500/20 text-cyan-400",
  };

  if (myKids.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <UserCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Parent Portal</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            No players are linked to your account ({userEmail || "loading..."}).
            Ask your organization admin to add your email as a parent contact for your child.
          </p>
        </div>
      </div>
    );
  }

  return (
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
            {myEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {myEvents.slice(0, 8).map(event => (
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
          <p className="text-sm text-muted-foreground">Pay registration fees, uniforms, and other charges for your players.</p>
          {myKids.map(kid => <PlayerPayments key={kid.id} player={kid} />)}
        </div>
      )}
    </div>
  );
}