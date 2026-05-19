import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export default function CarpoolRequestModal({ open, onOpenChange, currentUser, myTeamIds, myTeams }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    event_id: "",
    seats_needed: "1",
    neighborhood_zip: "",
    notes: "",
  });

  const today = new Date().toISOString().split("T")[0];

  const { data: events = [] } = useQuery({
    queryKey: ["upcoming-events-carpool", myTeamIds?.join(",")],
    queryFn: async () => {
      const all = await base44.entities.Event.list("-date", 100);
      return all.filter(e => e.date >= today && myTeamIds?.includes(e.team_id));
    },
    enabled: open && !!myTeamIds?.length,
  });

  const selectedEvent = events.find(e => e.id === form.event_id);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Create the carpool request record
      const request = await base44.entities.CarpoolRequest.create(data);

      // 2. Find the carpool channel for this team and post a message
      const allChannels = await base44.entities.Channel.filter({ type: "carpool" });
      const carpoolChannel = allChannels.find(ch => ch.team_id === data.team_id) || allChannels[0];

      if (carpoolChannel) {
        const eventLabel = data.event_title ? `${data.event_title} on ${data.event_date}` : data.event_date;
        const messageText = `🙋 **${data.requester_name}** needs a ride to **${eventLabel}**${data.neighborhood_zip ? ` (near ${data.neighborhood_zip})` : ""}${data.notes ? `\n📝 ${data.notes}` : ""}`;
        await base44.entities.Message.create({
          channel_id: carpoolChannel.id,
          sender_user_id: data.requester_email,
          sender_name: data.requester_name,
          content_text: messageText,
          message_type: "carpool_request",
          metadata: JSON.stringify({ carpool_request_id: request.id }),
        });
        await base44.entities.Channel.update(carpoolChannel.id, { last_message_at: new Date().toISOString() });
      }

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carpool-requests"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      // Push notification
      const team = myTeams?.find(t => t.id === selectedEvent?.team_id);
      if (team) {
        base44.functions.invoke("sendPushNotification", {
          title: `🙋 Ride Needed — ${team.name}`,
          body: `${currentUser?.full_name || currentUser?.email} needs a ride to ${selectedEvent?.title || "an event"}`,
          url: "/Messages",
          team_id: team.id,
        });
      }
      setForm({ event_id: "", seats_needed: "1", neighborhood_zip: "", notes: "" });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.event_id) return;
    createMutation.mutate({
      team_id: selectedEvent?.team_id || myTeamIds?.[0] || "",
      team_name: myTeams?.find(t => t.id === selectedEvent?.team_id)?.name || "",
      event_id: form.event_id,
      event_title: selectedEvent?.title || "",
      event_date: selectedEvent?.date || today,
      event_time: selectedEvent?.start_time || "",
      requester_name: currentUser?.full_name || currentUser?.email || "",
      requester_email: currentUser?.email || "",
      neighborhood_zip: form.neighborhood_zip,
      seats_available: 0, // 0 = seeking a ride
      notes: form.notes,
      status: "open",
      carpool_type: "seeking_ride",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🙋 Find a Ride</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* Step 1: Event */}
          <div className="space-y-1.5">
            <Label>Which event do you need a ride to?</Label>
            <Select value={form.event_id} onValueChange={val => setForm(f => ({ ...f, event_id: val }))}>
              <SelectTrigger className="bg-surface border-border">
                <SelectValue placeholder="Select an event…" />
              </SelectTrigger>
              <SelectContent>
                {events.length === 0 ? (
                  <SelectItem value="none" disabled>No upcoming events found</SelectItem>
                ) : events.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {format(new Date(e.date + "T00:00:00"), "MMM d")} — {e.title}
                    {e.opponent ? ` vs ${e.opponent}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Seats Needed</Label>
              <Input
                type="number"
                min="1"
                max="6"
                value={form.seats_needed}
                onChange={e => setForm(f => ({ ...f, seats_needed: e.target.value }))}
                className="bg-surface border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pickup Zip Code</Label>
              <Input
                type="text"
                value={form.neighborhood_zip}
                onChange={e => setForm(f => ({ ...f, neighborhood_zip: e.target.value }))}
                placeholder="e.g. 73012"
                className="bg-surface border-border"
              />
            </div>
          </div>

          {/* Step 3: Notes */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="E.g., I have a booster seat, can meet at the school..."
              className="bg-surface border-border resize-none h-20"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!form.event_id || createMutation.isPending}
              className="bg-primary text-primary-foreground"
            >
              {createMutation.isPending ? "Posting…" : "Broadcast Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}