import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, HelpCircle, Users, Lock, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import AttendanceDetailModal from "./AttendanceDetailModal";

const EVENT_TYPE_COLORS = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function AttendanceCard({ request, isStaff, currentUser, myPlayers, allPlayers }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const [respondingFor, setRespondingFor] = useState(null); // player id being responded for

  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses", request.id],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: request.id }),
    refetchInterval: 8000,
  });

  const attending = responses.filter(r => r.status === "attending").length;
  const notAttending = responses.filter(r => r.status === "not_attending").length;
  const maybe = responses.filter(r => r.status === "maybe").length;

  // Build map of player -> response for this user's kids
  const responseMap = {};
  responses.forEach(r => { responseMap[r.player_id] = r; });

  const upsertMutation = useMutation({
    mutationFn: async ({ player, status }) => {
      const existing = responses.find(r => r.player_id === player.id);
      if (existing) {
        return base44.entities.AttendanceResponse.update(existing.id, { status });
      } else {
        return base44.entities.AttendanceResponse.create({
          attendance_request_id: request.id,
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          team_id: request.team_id,
          responder_email: currentUser?.email || "",
          status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-responses", request.id] });
      setRespondingFor(null);
    },
  });

  const typeColorClass = EVENT_TYPE_COLORS[request.event_type] || EVENT_TYPE_COLORS.other;

  // Players from parent's kids that belong to this team
  const eligiblePlayers = myPlayers.filter(p => p.team_id === request.team_id);

  return (
    <>
      <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${typeColorClass}`}>
              {request.event_type}
            </span>
            {request.is_locked && <Lock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
            <span className="text-sm font-semibold text-foreground truncate">{request.label}</span>
          </div>
          {request.event_date && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {format(new Date(request.event_date), "MMM d")}
            </span>
          )}
        </div>

        {/* Live counts */}
        <div className="px-4 py-3 flex items-center gap-5">
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="font-semibold text-green-400">{attending}</span>
            <span className="text-muted-foreground text-xs">Going</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="font-semibold text-red-400">{notAttending}</span>
            <span className="text-muted-foreground text-xs">Not Going</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <HelpCircle className="w-4 h-4 text-yellow-400" />
            <span className="font-semibold text-yellow-400">{maybe}</span>
            <span className="text-muted-foreground text-xs">Maybe</span>
          </div>
          {isStaff && (
            <button
              onClick={() => setShowDetail(true)}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> Roster
            </button>
          )}
        </div>

        {/* Parent RSVP section */}
        {!isStaff && eligiblePlayers.length > 0 && !request.is_locked && (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Your RSVP</p>
            {eligiblePlayers.map(player => {
              const current = responseMap[player.id];
              return (
                <div key={player.id} className="space-y-2">
                  {eligiblePlayers.length > 1 && (
                    <p className="text-xs font-semibold text-foreground">{player.first_name} {player.last_name}</p>
                  )}
                  <div className="flex gap-2">
                    {[
                      { status: "attending", icon: CheckCircle2, label: "Going", color: "green" },
                      { status: "not_attending", icon: XCircle, label: "Not Going", color: "red" },
                      { status: "maybe", icon: HelpCircle, label: "Maybe", color: "yellow" },
                    ].map(({ status, icon: Icon, label, color }) => {
                      const isSelected = current?.status === status;
                      return (
                        <button
                          key={status}
                          disabled={upsertMutation.isPending}
                          onClick={() => upsertMutation.mutate({ player, status })}
                          className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all
                            ${isSelected
                              ? `bg-${color}-500/20 border-${color}-500/50 text-${color}-400`
                              : "bg-surface border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                            }`}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {request.is_locked && !isStaff && (
          <div className="px-4 pb-3 pt-2 border-t border-border">
            <p className="text-xs text-yellow-400 flex items-center gap-1.5"><Lock className="w-3 h-3" /> RSVP is closed</p>
          </div>
        )}
      </div>

      {showDetail && (
        <AttendanceDetailModal
          request={request}
          onClose={() => setShowDetail(false)}
          isStaff={isStaff}
          players={allPlayers}
        />
      )}
    </>
  );
}