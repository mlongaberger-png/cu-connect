import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { CalendarDays, MapPin, Check, Loader2 } from "lucide-react";

const ACTIONS = [
  { key: "going", emoji: "👍", label: "Going", rsvpStatus: "attending", activeCls: "bg-green-500/20 text-green-400 border-green-500/40" },
  { key: "not_going", emoji: "🤒", label: "Can't Go", rsvpStatus: "not_attending", activeCls: "bg-red-500/20 text-red-400 border-red-500/40" },
  { key: "need_ride", emoji: "🚗", label: "Need Ride", rsvpStatus: null, activeCls: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
];

export default function EventCard({ msg }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const meta = (() => {
    try { return JSON.parse(msg.metadata || "{}"); } catch { return {}; }
  })();

  const reqId = meta.attendance_request_id;
  const eventId = meta.event_id;

  // Reuse the cached channel query from ChatCanvas to get team_id
  const { data: channel } = useQuery({
    queryKey: ["channel", msg.channel_id],
    queryFn: () => base44.entities.Channel.filter({ id: msg.channel_id }).then(r => r[0]),
    enabled: !!msg.channel_id,
    staleTime: 60000,
  });
  const teamId = channel?.team_id;

  // Fetch the parent's guardian links to discover eligible players
  const { data: myGuardians = [] } = useQuery({
    queryKey: ["my-guardians", user?.email],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user.email }),
    enabled: !!user?.email,
    staleTime: 30000,
  });
  const guardianPlayerIds = myGuardians.map(g => g.player_id).filter(Boolean);

  const { data: myPlayers = [] } = useQuery({
    queryKey: ["my-players", guardianPlayerIds.join(",")],
    queryFn: () => base44.entities.Player.list(),
    enabled: guardianPlayerIds.length > 0,
    staleTime: 30000,
  });

  const eligiblePlayers = teamId
    ? myPlayers.filter(p => guardianPlayerIds.includes(p.id) && p.team_id === teamId)
    : [];

  // Existing RSVP responses for this attendance request
  const { data: myResponses = [] } = useQuery({
    queryKey: ["my-rsvp", reqId, user?.email],
    queryFn: () => base44.entities.AttendanceResponse.filter({
      attendance_request_id: reqId,
      responder_email: user.email,
    }),
    enabled: !!reqId && !!user?.email,
    staleTime: 15000,
  });

  // Existing carpool request for this event
  const { data: myCarpool = [] } = useQuery({
    queryKey: ["my-carpool", eventId, user?.email],
    queryFn: () => base44.entities.CarpoolRequest.filter({
      event_id: eventId,
      requester_email: user.email,
    }),
    enabled: !!eventId && !!user?.email,
    staleTime: 15000,
  });

  const hasGoing = myResponses.some(r => r.status === "attending");
  const hasNotGoing = myResponses.some(r => r.status === "not_attending");
  const hasCarpool = myCarpool.length > 0;

  const rsvpMutation = useMutation({
    mutationFn: async (status) => {
      if (!reqId || eligiblePlayers.length === 0) return;
      await Promise.all(eligiblePlayers.map(player => {
        const existing = myResponses.find(r => r.player_id === player.id);
        if (existing) {
          return base44.entities.AttendanceResponse.update(existing.id, { status });
        }
        return base44.entities.AttendanceResponse.create({
          attendance_request_id: reqId,
          player_id: player.id,
          player_name: `${player.first_name} ${player.last_name}`,
          team_id: teamId,
          responder_email: user.email,
          status,
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-rsvp", reqId] });
      queryClient.invalidateQueries({ queryKey: ["attendance-responses", reqId] });
    },
  });

  const carpoolMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.CarpoolRequest.create({
        team_id: teamId || "",
        requester_email: user.email,
        requester_name: user?.full_name || "",
        event_id: eventId || "",
        event_title: meta.title || "",
        event_date: meta.date || "",
        event_time: meta.start_time || "",
        carpool_type: "seeking_ride",
        seats_available: 0,
        status: "open",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-carpool", eventId] });
    },
  });

  const handleClick = (action) => {
    if (!user?.email) return;
    if (action.rsvpStatus) {
      rsvpMutation.mutate(action.rsvpStatus);
    } else {
      carpoolMutation.mutate();
    }
  };

  const isActive = (key) => {
    if (key === "going") return hasGoing;
    if (key === "not_going") return hasNotGoing;
    if (key === "need_ride") return hasCarpool;
    return false;
  };

  const isPending = (action) => {
    if (action.rsvpStatus) {
      return rsvpMutation.isPending && rsvpMutation.variables === action.rsvpStatus;
    }
    return carpoolMutation.isPending;
  };

  return (
    <Card className="w-full max-w-sm bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 space-y-2">
        <p className="font-bold text-foreground text-sm">{meta.title || "Event"}</p>
        {meta.date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" /> {meta.date}{meta.start_time ? ` at ${meta.start_time}` : ""}
          </div>
        )}
        {meta.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" /> {meta.location}
          </div>
        )}
      </div>
      <div className="border-t border-border flex justify-between p-2">
        {ACTIONS.map((action) => {
          const active = isActive(action.key);
          const pending = isPending(action);
          return (
            <button
              key={action.key}
              onClick={() => handleClick(action)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-colors text-xs
                ${active ? action.activeCls : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface"}`}
            >
              {pending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : active ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <span>{action.emoji}</span>
              )}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}