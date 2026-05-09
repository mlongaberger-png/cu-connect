import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, HelpCircle, Users, Lock, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import AttendanceDetailModal from "./AttendanceDetailModal";

const EVENT_TYPE_COLORS = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const RSVP_OPTIONS = [
  { status: "attending",     Icon: CheckCircle2, label: "Going",     cls: "bg-green-500/20 border-green-500/50 text-green-400" },
  { status: "not_attending", Icon: XCircle,      label: "Not Going", cls: "bg-red-500/20 border-red-500/50 text-red-400" },
  { status: "maybe",         Icon: HelpCircle,   label: "Maybe",     cls: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" },
];

function PlayerRsvpRow({ player, responseMap, upsertMutation, showName }) {
  const current = responseMap[player.id];
  const [changing, setChanging] = useState(false);
  const selected = RSVP_OPTIONS.find(o => o.status === current?.status);

  if (selected && !changing) {
    return (
      <div className="flex items-center gap-2">
        {showName && <span className="text-xs text-muted-foreground">{player.first_name}</span>}
        <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${selected.cls}`}>
          <selected.Icon className="w-3 h-3" /> {selected.label}
        </span>
        <button
          onClick={() => setChanging(true)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {showName && <p className="text-xs font-semibold text-foreground">{player.first_name} {player.last_name}</p>}
      <div className="flex gap-1.5">
        {RSVP_OPTIONS.map(({ status, Icon, label, cls }) => (
          <button
            key={status}
            disabled={upsertMutation.isPending}
            onClick={() => { upsertMutation.mutate({ player, status }); setChanging(false); }}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all
              ${current?.status === status ? cls : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AttendanceCard({ request, isStaff, currentUser, myPlayers, allPlayers }) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);

  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses", request.id],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: request.id }),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    staleTime: 25000,
  });

  const responseMap = {};
  responses.forEach(r => { responseMap[r.player_id] = r; });

  const upsertMutation = useMutation({
    mutationFn: async ({ player, status }) => {
      const existing = responses.find(r => r.player_id === player.id);
      if (existing) return base44.entities.AttendanceResponse.update(existing.id, { status });
      return base44.entities.AttendanceResponse.create({
        attendance_request_id: request.id,
        player_id: player.id,
        player_name: `${player.first_name} ${player.last_name}`,
        team_id: request.team_id,
        responder_email: currentUser?.email || "",
        status,
      });
    },
    onMutate: async ({ player, status }) => {
      await queryClient.cancelQueries({ queryKey: ["attendance-responses", request.id] });
      const previous = queryClient.getQueryData(["attendance-responses", request.id]);
      queryClient.setQueryData(["attendance-responses", request.id], (old = []) => {
        const exists = old.find(r => r.player_id === player.id);
        if (exists) return old.map(r => r.player_id === player.id ? { ...r, status } : r);
        return [...old, { id: `opt-${player.id}`, attendance_request_id: request.id, player_id: player.id, player_name: `${player.first_name} ${player.last_name}`, team_id: request.team_id, responder_email: currentUser?.email || "", status }];
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(["attendance-responses", request.id], ctx.previous); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["attendance-responses", request.id] }),
  });

  const eligiblePlayers = myPlayers.filter(p => p.team_id === request.team_id);
  const typeColorClass = EVENT_TYPE_COLORS[request.event_type] || EVENT_TYPE_COLORS.other;

  // ── Staff view ─────────────────────────────────────────────────────────────
  if (isStaff) {
    const attending = responses.filter(r => r.status === "attending").length;
    const notAttending = responses.filter(r => r.status === "not_attending").length;
    const maybe = responses.filter(r => r.status === "maybe").length;
    return (
      <>
        <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
          <div className="px-4 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${typeColorClass}`}>{request.event_type}</span>
              {request.is_locked && <Lock className="w-3.5 h-3.5 text-yellow-400" />}
              <span className="text-sm font-semibold text-foreground truncate">{request.label}</span>
            </div>
            {request.event_date && <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(request.event_date), "MMM d")}</span>}
          </div>
          <div className="px-4 py-3 flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-sm"><CheckCircle2 className="w-4 h-4 text-green-400" /><span className="font-semibold text-green-400">{attending}</span><span className="text-muted-foreground text-xs">Going</span></div>
            <div className="flex items-center gap-1.5 text-sm"><XCircle className="w-4 h-4 text-red-400" /><span className="font-semibold text-red-400">{notAttending}</span><span className="text-muted-foreground text-xs">Not Going</span></div>
            <div className="flex items-center gap-1.5 text-sm"><HelpCircle className="w-4 h-4 text-yellow-400" /><span className="font-semibold text-yellow-400">{maybe}</span><span className="text-muted-foreground text-xs">Maybe</span></div>
            <button onClick={() => setShowDetail(true)} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Users className="w-3.5 h-3.5" /> Roster
            </button>
          </div>
        </div>
        {showDetail && <AttendanceDetailModal request={request} onClose={() => setShowDetail(false)} isStaff={true} players={allPlayers} />}
      </>
    );
  }

  // ── Parent / compact inline view ───────────────────────────────────────────
  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate flex-1">{request.label}</span>
          {request.event_date && <span className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(request.event_date), "MMM d")}</span>}
          {request.is_locked && <Lock className="w-3 h-3 text-yellow-400" />}
        </div>
        {request.is_locked ? (
          <p className="text-xs text-yellow-400 flex items-center gap-1"><Lock className="w-3 h-3" /> RSVP closed</p>
        ) : eligiblePlayers.length > 0 ? (
          <div className="space-y-2">
            {eligiblePlayers.map(player => (
              <PlayerRsvpRow
                key={player.id}
                player={player}
                responseMap={responseMap}
                upsertMutation={upsertMutation}
                showName={eligiblePlayers.length > 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No linked players for this team.</p>
        )}
      </div>
      {showDetail && <AttendanceDetailModal request={request} onClose={() => setShowDetail(false)} isStaff={false} players={allPlayers} />}
    </>
  );
}