import React from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, FileText, DollarSign, Users, TrendingUp } from "lucide-react";

export default function FamilyDashboardStats({
  upcomingEvents = [],
  myKids = [],
  unpaidCount = 0,
  pendingDocs = 0,
  rsvpRequests = [],
  rsvpResponses = [],
  volunteerAssignments = [],
  onStatClick,
}) {
  // RSVP completion rate
  const totalRsvpNeeded = rsvpRequests.filter(r => !r.is_locked).length * myKids.length;
  const completedRsvps = rsvpResponses.length;
  const rsvpRate = totalRsvpNeeded > 0 ? Math.round((completedRsvps / totalRsvpNeeded) * 100) : 100;

  // Next event
  const nextEvent = upcomingEvents[0];
  const daysUntilNext = nextEvent
    ? Math.ceil((new Date(nextEvent.date + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  // Volunteer signups
  const myVolunteerCount = volunteerAssignments.length;

  const stats = [
    {
      icon: Calendar,
      label: "Upcoming Events",
      value: upcomingEvents.length,
      sub: nextEvent
        ? daysUntilNext === 0 ? "Next: Today!" : daysUntilNext === 1 ? "Next: Tomorrow" : `Next in ${daysUntilNext}d`
        : "No events scheduled",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      tab: "schedule",
    },
    {
      icon: CheckCircle2,
      label: "RSVP Status",
      value: `${rsvpRate}%`,
      sub: rsvpRequests.length > 0 ? `${completedRsvps}/${totalRsvpNeeded} responded` : "No open RSVPs",
      color: rsvpRate === 100 ? "text-green-400" : rsvpRate >= 50 ? "text-yellow-400" : "text-red-400",
      bg: rsvpRate === 100 ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20",
      tab: "schedule",
    },
    {
      icon: DollarSign,
      label: "Payments Due",
      value: unpaidCount,
      sub: unpaidCount === 0 ? "All paid up!" : `${unpaidCount} invoice${unpaidCount !== 1 ? "s" : ""} outstanding`,
      color: unpaidCount === 0 ? "text-green-400" : "text-red-400",
      bg: unpaidCount === 0 ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20",
      tab: "payments",
    },
    {
      icon: FileText,
      label: "Documents",
      value: pendingDocs,
      sub: pendingDocs === 0 ? "All signed & uploaded" : `${pendingDocs} pending signature${pendingDocs !== 1 ? "s" : ""}`,
      color: pendingDocs === 0 ? "text-green-400" : "text-orange-400",
      bg: pendingDocs === 0 ? "bg-green-500/10 border-green-500/20" : "bg-orange-500/10 border-orange-500/20",
      tab: "documents",
    },
    {
      icon: Users,
      label: "Volunteer Slots",
      value: myVolunteerCount,
      sub: myVolunteerCount === 0 ? "No upcoming slots" : `${myVolunteerCount} signed up`,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      tab: "volunteers",
    },
    {
      icon: TrendingUp,
      label: "Athletes",
      value: myKids.length,
      sub: myKids.map(k => k.first_name).join(", ") || "—",
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      tab: "athlete-cards",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        const isClickable = !!onStatClick && !!stat.tab;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={isClickable ? () => onStatClick(stat.tab) : undefined}
            className={`rounded-2xl border p-4 flex flex-col gap-2 ${stat.bg} ${isClickable ? "cursor-pointer hover:brightness-125 transition-all active:scale-95" : ""}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-black/20`}>
              <Icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs font-semibold text-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{stat.sub}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}