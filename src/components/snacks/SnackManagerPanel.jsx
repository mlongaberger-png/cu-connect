import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cookie, Plus, Trash2, User, ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { formatTime12h } from "@/utils/dateTime";

const SLOT_TYPES = ["Drinks", "Snacks", "Post-game Food", "Other"];

const SLOT_COLORS = {
  "Drinks":         "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Snacks":         "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "Post-game Food": "bg-green-500/20 text-green-400 border-green-500/30",
  "Other":          "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function SnackManagerPanel({ teams, events, currentUser }) {
  const queryClient = useQueryClient();
  const [filterTeam, setFilterTeam] = useState("all");
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [addingTo, setAddingTo] = useState(null); // event_id being added to
  const [newSlotType, setNewSlotType] = useState("Snacks");
  const [newSlotLabel, setNewSlotLabel] = useState("");
  const [newSlotNotes, setNewSlotNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const allTeamIds = teams.map(t => t.id);

  const { data: allSlots = [] } = useQuery({
    queryKey: ["snack-assignments-admin", allTeamIds.join(",")],
    queryFn: () => base44.entities.SnackAssignment.list("-event_date"),
    enabled: allTeamIds.length > 0,
  });

  // Get guardians/parents for assignment
  const { data: allGuardians = [] } = useQuery({
    queryKey: ["guardians-for-snacks"],
    queryFn: () => base44.entities.PlayerGuardian.list(),
  });
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  // Upcoming events that belong to our teams
  const today = new Date(new Date().toDateString());
  const myTeamIds = filterTeam === "all" ? allTeamIds : [filterTeam];
  const relevantEvents = events
    .filter(e => myTeamIds.includes(e.team_id) && new Date(e.date) >= today && !e.is_cancelled)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const getSlotsForEvent = (eventId) => allSlots.filter(s => s.event_id === eventId);

  // Build parent options for a given team
  const getParentOptionsForTeam = (teamId) => {
    const teamPlayers = allPlayers.filter(p => p.team_id === teamId);
    const playerIds = new Set(teamPlayers.map(p => p.id));
    const seen = new Set();
    const options = [];
    // From guardian links
    allGuardians.filter(g => playerIds.has(g.player_id)).forEach(g => {
      if (!seen.has(g.user_email)) {
        seen.add(g.user_email);
        options.push({ email: g.user_email, name: g.user_email });
      }
    });
    // From player parent_email
    teamPlayers.filter(p => p.parent_email && !seen.has(p.parent_email)).forEach(p => {
      seen.add(p.parent_email);
      options.push({ email: p.parent_email, name: p.parent_name || p.parent_email });
    });
    return options;
  };

  const handleAddSlot = async (event) => {
    setSaving(true);
    await base44.entities.SnackAssignment.create({
      event_id: event.id,
      event_title: event.title,
      event_date: event.date,
      event_time: event.start_time || "",
      team_id: event.team_id,
      team_name: event.team_name || teams.find(t => t.id === event.team_id)?.name || "",
      slot_type: newSlotType,
      slot_label: newSlotLabel.trim() || "",
      notes: newSlotNotes.trim(),
      created_by_email: currentUser?.email || "",
      created_by_name: currentUser?.full_name || "",
    });
    queryClient.invalidateQueries({ queryKey: ["snack-assignments-admin"] });
    queryClient.invalidateQueries({ queryKey: ["snack-assignments"] });
    setNewSlotType("Snacks");
    setNewSlotLabel("");
    setNewSlotNotes("");
    setAddingTo(null);
    setSaving(false);
  };

  const handleAssign = async (slot, email, name) => {
    await base44.entities.SnackAssignment.update(slot.id, {
      assigned_email: email,
      assigned_name: name,
    });
    if (email) {
      base44.functions.invoke("sendSnackReminder", {
        type: "confirmation",
        snack_slot_id: slot.id,
      }).catch(() => {});
    }
    queryClient.invalidateQueries({ queryKey: ["snack-assignments-admin"] });
    queryClient.invalidateQueries({ queryKey: ["snack-assignments"] });
  };

  const handleDelete = async (slotId) => {
    if (!confirm("Remove this snack slot?")) return;
    await base44.entities.SnackAssignment.delete(slotId);
    queryClient.invalidateQueries({ queryKey: ["snack-assignments-admin"] });
    queryClient.invalidateQueries({ queryKey: ["snack-assignments"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Cookie className="w-4 h-4 text-primary" /> Snack Manager
          </h3>
          <p className="text-sm text-muted-foreground">Create snack slots and assign parents to upcoming events.</p>
        </div>
        {teams.length > 1 && (
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44 bg-surface border-border text-sm h-8">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {relevantEvents.length === 0 && (
        <div className="text-center py-10 bg-card border border-border rounded-2xl">
          <Cookie className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No upcoming events found.</p>
        </div>
      )}

      <div className="space-y-3">
        {relevantEvents.map(event => {
          const slots = getSlotsForEvent(event.id);
          const isOpen = expandedEvent === event.id;
          const parentOptions = getParentOptionsForTeam(event.team_id);

          return (
            <div key={event.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Event header */}
              <button
                className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-surface transition-colors text-left"
                onClick={() => setExpandedEvent(isOpen ? null : event.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center min-w-[36px] bg-primary/10 rounded-xl px-2 py-1.5 flex-shrink-0">
                    <span className="text-[9px] text-primary uppercase font-bold leading-none">
                      {format(new Date(event.date), "MMM")}
                    </span>
                    <span className="text-base font-black text-foreground leading-none">
                      {format(new Date(event.date), "d")}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.start_time ? formatTime12h(event.start_time) : ""}{" · "}
                      {event.team_name || teams.find(t => t.id === event.team_id)?.name || ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground bg-surface rounded-full px-2 py-0.5 border border-border">
                    {slots.length} slot{slots.length !== 1 ? "s" : ""}
                  </span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {/* Existing slots */}
                  {slots.map(slot => (
                    <SlotRow
                      key={slot.id}
                      slot={slot}
                      parentOptions={parentOptions}
                      onAssign={handleAssign}
                      onDelete={handleDelete}
                    />
                  ))}

                  {/* Add slot form */}
                  {addingTo === event.id ? (
                    <div className="bg-surface rounded-xl border border-border p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">New Snack Slot</p>
                      <div className="flex gap-2 flex-wrap">
                        <Select value={newSlotType} onValueChange={setNewSlotType}>
                          <SelectTrigger className="bg-card border-border h-8 text-sm w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border">
                            {SLOT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Custom label (optional)"
                          value={newSlotLabel}
                          onChange={e => setNewSlotLabel(e.target.value)}
                          className="bg-card border-border h-8 text-sm flex-1"
                        />
                      </div>
                      <Input
                        placeholder="Notes (optional)"
                        value={newSlotNotes}
                        onChange={e => setNewSlotNotes(e.target.value)}
                        className="bg-card border-border h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddSlot(event)} disabled={saving} className="bg-primary text-primary-foreground gap-1">
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {saving ? "Saving..." : "Add Slot"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingTo(null)} className="border-border">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(event.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" /> Add Snack Slot
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlotRow({ slot, parentOptions, onAssign, onDelete }) {
  const [assignEmail, setAssignEmail] = useState(slot.assigned_email || "");
  const [saving, setSaving] = useState(false);
  const label = slot.slot_label || slot.slot_type;
  const colorClass = SLOT_COLORS[slot.slot_type] || SLOT_COLORS["Other"];

  const handleAssignChange = async (email) => {
    setAssignEmail(email);
    setSaving(true);
    const name = email ? (parentOptions.find(p => p.email === email)?.name || email) : "";
    await onAssign(slot, email === "__clear__" ? "" : email, name);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-3 bg-background rounded-xl border border-border px-3 py-2.5 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${colorClass}`}>{label}</span>
      <div className="flex-1 min-w-[160px]">
        <Select
          value={slot.assigned_email || "__clear__"}
          onValueChange={handleAssignChange}
          disabled={saving}
        >
          <SelectTrigger className="bg-surface border-border h-8 text-xs">
            <SelectValue placeholder="Unassigned">
              {saving ? "Saving..." : slot.assigned_email ? (
                <span className="flex items-center gap-1.5">
                  <User className="w-3 h-3" /> {slot.assigned_name || slot.assigned_email}
                </span>
              ) : "Unassigned — open slot"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="__clear__">Unassigned — open slot</SelectItem>
            {parentOptions.map(p => (
              <SelectItem key={p.email} value={p.email}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {slot.notes && <p className="text-xs text-muted-foreground truncate max-w-[140px]">{slot.notes}</p>}
      <button
        onClick={() => onDelete(slot.id)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}