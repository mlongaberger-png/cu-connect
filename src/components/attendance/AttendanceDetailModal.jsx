import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, HelpCircle, Lock } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  attending: { icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/20", label: "Attending" },
  not_attending: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/20", label: "Not Attending" },
  maybe: { icon: HelpCircle, color: "text-yellow-400", bg: "bg-yellow-500/20", label: "Maybe" },
};

export default function AttendanceDetailModal({ request, onClose, isStaff, players }) {
  const queryClient = useQueryClient();

  const { data: responses = [] } = useQuery({
    queryKey: ["attendance-responses", request.id],
    queryFn: () => base44.entities.AttendanceResponse.filter({ attendance_request_id: request.id }),
    enabled: !!request.id,
    refetchInterval: 10000,
  });

  const overrideMutation = useMutation({
    mutationFn: ({ responseId, status }) =>
      base44.entities.AttendanceResponse.update(responseId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-responses", request.id] }),
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      base44.entities.AttendanceRequest.update(request.id, { is_locked: !request.is_locked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-requests", request.channel_id] }),
  });

  // Build roster with response status
  const teamPlayers = players.filter(p => p.team_id === request.team_id && p.is_active !== false);
  const responseMap = {};
  responses.forEach(r => { responseMap[r.player_id] = r; });

  const attending = responses.filter(r => r.status === "attending");
  const notAttending = responses.filter(r => r.status === "not_attending");
  const maybe = responses.filter(r => r.status === "maybe");
  const noResponse = teamPlayers.filter(p => !responseMap[p.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">{request.label}</span>
            {isStaff && (
              <button
                onClick={() => lockMutation.mutate()}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${request.is_locked ? "border-yellow-500/50 text-yellow-400 bg-yellow-500/10" : "border-border text-muted-foreground hover:border-primary/50"}`}
              >
                <Lock className="w-3 h-3" />
                {request.is_locked ? "Locked" : "Lock"}
              </button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-3 py-2">
          {[
            { key: "attending", count: attending.length },
            { key: "not_attending", count: notAttending.length },
            { key: "maybe", count: maybe.length },
          ].map(({ key, count }) => {
            const cfg = STATUS_CONFIG[key];
            const Icon = cfg.icon;
            return (
              <div key={key} className={`flex flex-col items-center gap-1 rounded-xl p-3 ${cfg.bg}`}>
                <Icon className={`w-5 h-5 ${cfg.color}`} />
                <span className={`text-xl font-bold ${cfg.color}`}>{count}</span>
                <span className="text-xs text-muted-foreground">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {isStaff && (
          <div className="space-y-3">
            {/* Attending */}
            {attending.length > 0 && (
              <Section label="✅ Attending" players={attending} responseMap={responseMap} overrideMutation={overrideMutation} isStaff={isStaff} />
            )}
            {/* Not Attending */}
            {notAttending.length > 0 && (
              <Section label="❌ Not Attending" players={notAttending} responseMap={responseMap} overrideMutation={overrideMutation} isStaff={isStaff} />
            )}
            {/* Maybe */}
            {maybe.length > 0 && (
              <Section label="❓ Maybe" players={maybe} responseMap={responseMap} overrideMutation={overrideMutation} isStaff={isStaff} />
            )}
            {/* No Response */}
            {noResponse.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">No Response ({noResponse.length})</p>
                <div className="space-y-1.5">
                  {noResponse.map(p => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                      <span className="text-sm text-muted-foreground">{p.first_name} {p.last_name}</span>
                      <span className="text-xs text-muted-foreground italic">No response</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, players: responsesInSection, overrideMutation, isStaff }) {
  const statuses = ["attending", "not_attending", "maybe"];
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="space-y-1.5">
        {responsesInSection.map(r => (
          <div key={r.id} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
            <div>
              <span className="text-sm text-foreground">{r.player_name}</span>
              {r.updated_date && (
                <p className="text-xs text-muted-foreground">{format(new Date(r.updated_date), "MMM d, h:mm a")}</p>
              )}
              {r.override_by && <p className="text-xs text-yellow-400">Overridden by staff</p>}
            </div>
            {isStaff && (
              <select
                value={r.status}
                onChange={e => overrideMutation.mutate({ responseId: r.id, status: e.target.value })}
                className="text-xs bg-card border border-border rounded-md px-2 py-1 text-foreground"
              >
                {statuses.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}