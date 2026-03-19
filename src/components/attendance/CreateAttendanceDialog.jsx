import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { format } from "date-fns";

export default function CreateAttendanceDialog({ open, onOpenChange, channelId, teamId, teamName, user }) {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState("none");
  const [eventType, setEventType] = useState("practice");
  const [label, setLabel] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");

  // Load upcoming events for this team
  const { data: events = [] } = useQuery({
    queryKey: ["events", teamId],
    queryFn: () => base44.entities.Event.filter({ team_id: teamId }, "date", 20),
    enabled: !!teamId,
  });

  const upcomingEvents = events.filter(e => !e.is_cancelled && e.date >= new Date().toISOString().split("T")[0]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AttendanceRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-requests", channelId] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setEventId("none");
    setEventType("practice");
    setLabel("");
    setEventDate("");
    setEventTime("");
  };

  const handleEventSelect = (id) => {
    setEventId(id);
    if (id === "none") return;
    const ev = events.find(e => e.id === id);
    if (!ev) return;
    setEventType(ev.type || "practice");
    setEventDate(ev.date || "");
    setEventTime(ev.start_time || "");
    const dateStr = ev.date ? format(new Date(ev.date), "EEE MMM d") : "";
    const timeStr = ev.start_time || "";
    setLabel(`${(ev.type || "practice").charAt(0).toUpperCase() + (ev.type || "practice").slice(1)}${dateStr ? ` – ${dateStr}` : ""}${timeStr ? ` ${timeStr}` : ""}`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalLabel = label.trim() || `${eventType.charAt(0).toUpperCase() + eventType.slice(1)}${eventDate ? ` – ${format(new Date(eventDate), "EEE MMM d")}` : ""}${eventTime ? ` ${eventTime}` : ""}`;
    createMutation.mutate({
      team_id: teamId,
      team_name: teamName,
      event_id: eventId === "none" ? "" : eventId,
      label: finalLabel,
      event_type: eventType,
      event_date: eventDate,
      event_time: eventTime,
      created_by_name: user?.full_name || "Staff",
      created_by_email: user?.email || "",
      channel_id: channelId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Create Attendance Request
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {upcomingEvents.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to Scheduled Event (optional)</Label>
              <Select value={eventId} onValueChange={handleEventSelect}>
                <SelectTrigger className="bg-surface border-border">
                  <SelectValue placeholder="Select event or create custom" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="none">Custom (no event)</SelectItem>
                  {upcomingEvents.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title} – {e.date ? format(new Date(e.date), "MMM d") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Event Type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="practice">Practice</SelectItem>
                <SelectItem value="game">Game</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="bg-surface border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="bg-surface border-border" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Label (shown in chat)</Label>
            <Input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={`e.g. Practice – Tuesday 6:00 PM`}
              className="bg-surface border-border"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending} className="gap-2">
              <ClipboardList className="w-4 h-4" />
              {createMutation.isPending ? "Posting..." : "Post Attendance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}