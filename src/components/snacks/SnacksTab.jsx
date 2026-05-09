import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cookie, CheckCircle2, Clock, Calendar, MapPin, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { formatTime12h } from "@/utils/dateTime";

const SLOT_COLORS = {
  "Drinks":         "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Snacks":         "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Post-game Food": "bg-green-500/20 text-green-400 border-green-500/30",
  "Other":          "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function SlotCard({ slot, userEmail, userName, myPlayerIds, onSignUp, onDrop, loading }) {
  const isAssigned = !!slot.assigned_email;
  const isMine = slot.assigned_email === userEmail;
  const label = slot.slot_label || slot.slot_type;
  const colorClass = SLOT_COLORS[slot.slot_type] || SLOT_COLORS["Other"];

  return (
    <div className={`rounded-2xl border p-4 transition-all ${isMine ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${colorClass}`}>{label}</span>
            {isMine && <span className="text-xs text-primary font-semibold">✓ You're signed up!</span>}
          </div>
          {isAssigned ? (
            <p className="text-sm font-medium text-foreground">{isMine ? "You" : slot.assigned_name || slot.assigned_email}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Open — no one signed up yet</p>
          )}
          {slot.notes && <p className="text-xs text-muted-foreground mt-1">{slot.notes}</p>}
        </div>

        <div className="flex-shrink-0">
          {isMine ? (
            <button
              onClick={() => onDrop(slot)}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Drop
            </button>
          ) : !isAssigned ? (
            <button
              onClick={() => onSignUp(slot)}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Sign Up
            </button>
          ) : (
            <span className="text-xs text-muted-foreground px-2 py-1.5 rounded-xl bg-surface">Taken</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SnacksTab({ myTeamIds, userEmail, userName, myKids, events }) {
  const queryClient = useQueryClient();
  const [loadingSlot, setLoadingSlot] = useState(null);

  const { data: allSlots = [] } = useQuery({
    queryKey: ["snack-assignments", myTeamIds.join(",")],
    queryFn: () => base44.entities.SnackAssignment.list("-event_date"),
    enabled: myTeamIds.length > 0,
  });

  const mySlots = allSlots.filter(s => myTeamIds.includes(s.team_id));

  // Group slots by event
  const grouped = mySlots.reduce((acc, slot) => {
    const key = slot.event_id;
    if (!acc[key]) acc[key] = { event_id: slot.event_id, event_title: slot.event_title, event_date: slot.event_date, event_time: slot.event_time, team_name: slot.team_name, slots: [] };
    acc[key].slots.push(slot);
    return acc;
  }, {});

  // Sort events: upcoming first, then past
  const today = new Date(new Date().toDateString());
  const sortedGroups = Object.values(grouped).sort((a, b) => {
    const da = new Date(a.event_date);
    const db = new Date(b.event_date);
    const aUpcoming = da >= today;
    const bUpcoming = db >= today;
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;
    return aUpcoming ? da - db : db - da;
  });

  const upcomingGroups = sortedGroups.filter(g => new Date(g.event_date) >= today);
  const pastGroups = sortedGroups.filter(g => new Date(g.event_date) < today);

  const handleSignUp = async (slot) => {
    setLoadingSlot(slot.id);
    await base44.entities.SnackAssignment.update(slot.id, {
      assigned_email: userEmail,
      assigned_name: userName || userEmail,
    });
    // Send confirmation push notification to the user
    base44.functions.invoke("sendSnackReminder", {
      type: "confirmation",
      snack_slot_id: slot.id,
    }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["snack-assignments"] });
    setLoadingSlot(null);
  };

  const handleDrop = async (slot) => {
    setLoadingSlot(slot.id);
    await base44.entities.SnackAssignment.update(slot.id, {
      assigned_email: "",
      assigned_name: "",
    });
    queryClient.invalidateQueries({ queryKey: ["snack-assignments"] });
    setLoadingSlot(null);
  };

  const mySignedUpCount = mySlots.filter(s => s.assigned_email === userEmail).length;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Cookie className="w-4 h-4 text-primary" /> Snack Assignments
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">Sign up to bring snacks or drinks to your team's events.</p>
      </div>

      {mySignedUpCount > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm font-medium text-foreground">
            You're signed up for {mySignedUpCount} snack slot{mySignedUpCount !== 1 ? "s" : ""}. Thank you! 🎉
          </p>
        </div>
      )}

      {sortedGroups.length === 0 && (
        <div className="text-center py-12 bg-card border border-border rounded-2xl">
          <Cookie className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">No snack slots yet</p>
          <p className="text-xs text-muted-foreground mt-1">Your coaches will set up snack responsibilities for upcoming events.</p>
        </div>
      )}

      {upcomingGroups.length > 0 && (
        <div className="space-y-4">
          {upcomingGroups.map(group => (
            <EventSnackGroup
              key={group.event_id}
              group={group}
              userEmail={userEmail}
              userName={userName}
              loadingSlot={loadingSlot}
              onSignUp={handleSignUp}
              onDrop={handleDrop}
            />
          ))}
        </div>
      )}

      {pastGroups.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground uppercase tracking-wider font-medium cursor-pointer select-none flex items-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5" /> Past Events ({pastGroups.length})
          </summary>
          <div className="space-y-4 opacity-60">
            {pastGroups.map(group => (
              <EventSnackGroup
                key={group.event_id}
                group={group}
                userEmail={userEmail}
                userName={userName}
                loadingSlot={loadingSlot}
                onSignUp={() => {}}
                onDrop={() => {}}
                readOnly
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function EventSnackGroup({ group, userEmail, userName, loadingSlot, onSignUp, onDrop, readOnly }) {
  const isPast = new Date(group.event_date) < new Date(new Date().toDateString());
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Event header */}
      <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center min-w-[36px] bg-primary/10 rounded-xl px-2 py-1.5">
            <span className="text-[9px] text-primary uppercase font-bold leading-none">
              {format(new Date(group.event_date), "MMM")}
            </span>
            <span className="text-base font-black text-foreground leading-none">
              {format(new Date(group.event_date), "d")}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{group.event_title || "Event"}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {group.event_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime12h(group.event_time)}</span>}
              <span>{group.team_name}</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {group.slots.filter(s => !s.assigned_email).length} open slot{group.slots.filter(s => !s.assigned_email).length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Slots */}
      <div className="p-3 space-y-2">
        {group.slots.map(slot => (
          <SlotCard
            key={slot.id}
            slot={slot}
            userEmail={userEmail}
            userName={userName}
            loading={loadingSlot === slot.id}
            onSignUp={readOnly ? () => {} : onSignUp}
            onDrop={readOnly ? () => {} : onDrop}
          />
        ))}
      </div>
    </div>
  );
}