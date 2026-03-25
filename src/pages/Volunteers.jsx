import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, ClipboardList, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import VolunteerRolesPanel from "@/components/volunteers/VolunteerRolesPanel";
import VolunteerOpportunitiesPanel from "@/components/volunteers/VolunteerOpportunitiesPanel";
import VolunteerAssignmentsPanel from "@/components/volunteers/VolunteerAssignmentsPanel";

const TABS = [
  { id: "opportunities", label: "Opportunities", icon: ClipboardList },
  { id: "assignments", label: "Assignments", icon: Users },
  { id: "roles", label: "Roles", icon: Shield },
];

export default function Volunteers() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isCoach = role === "coach";
  const [activeTab, setActiveTab] = useState("opportunities");
  const [filterTeam, setFilterTeam] = useState("all");
  const queryClient = useQueryClient();

  const refreshing = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ["volunteer-opportunities"] });
    await queryClient.invalidateQueries({ queryKey: ["volunteer-assignments"] });
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  // Coaches only see their own teams
  const myTeams = isCoach
    ? teams.filter(t => t.coach_email?.toLowerCase() === user?.email?.toLowerCase())
    : teams;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {refreshing && <div className="flex justify-center"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Volunteers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage volunteer opportunities and assignments</p>
        </div>
        {myTeams.length > 1 && (
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44 bg-surface border-border text-sm">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {myTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
        {TABS.filter(t => t.id !== "roles" || isAdmin).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "opportunities" && (
        <VolunteerOpportunitiesPanel
          teams={myTeams}
          filterTeam={filterTeam}
          user={user}
          isAdmin={isAdmin}
          isCoach={isCoach}
        />
      )}
      {activeTab === "assignments" && (
        <VolunteerAssignmentsPanel
          teams={myTeams}
          filterTeam={filterTeam}
          user={user}
          isAdmin={isAdmin}
          isCoach={isCoach}
        />
      )}
      {activeTab === "roles" && isAdmin && (
        <VolunteerRolesPanel user={user} />
      )}
    </div>
  );
}