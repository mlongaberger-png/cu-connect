import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Users, Calendar, UserCircle, TrendingUp, Shield } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import UpcomingEvents from "@/components/dashboard/UpcomingEvents";
import RecentAnnouncements from "@/components/dashboard/RecentAnnouncements";

export default function Dashboard() {
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date"),
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
  });

  const upcomingEvents = events.filter(e => {
    if (!e.date) return false;
    return new Date(e.date) >= new Date(new Date().toDateString());
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-surface to-card border border-border p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Organization Hub</h1>
          </div>
          <p className="text-muted-foreground max-w-xl">
            Manage your entire sports organization from one place. Track teams, schedules, players, and communications.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-primary">
              <TrendingUp className="w-4 h-4" />
              <span>{teams.filter(t => t.is_active !== false).length} active teams</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-muted-foreground" />
            <span className="text-sm text-muted-foreground">{sports.length} sports</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sports" value={sports.filter(s => s.is_active !== false).length} icon={Trophy} />
        <StatCard label="Teams" value={teams.filter(t => t.is_active !== false).length} icon={Users} />
        <StatCard label="Athletes" value={players.filter(p => p.is_active !== false).length} icon={UserCircle} />
        <StatCard label="Events" value={upcomingEvents.length} icon={Calendar} />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingEvents events={upcomingEvents} />
        <RecentAnnouncements announcements={announcements} />
      </div>
    </div>
  );
}