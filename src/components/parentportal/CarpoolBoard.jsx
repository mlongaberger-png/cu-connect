import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, Plus, MessageSquare, X, Users, MapPin, Calendar, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

export default function CarpoolBoard({ myKids, userEmail, userName, myTeamIds, myTeams, events }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [form, setForm] = useState({
    seats_available: "",
    pickup_location: "",
    notes: "",
    event_id: "",
    team_id: myTeamIds[0] || "",
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["carpool-requests", myTeamIds.join(",")],
    queryFn: () => base44.entities.CarpoolRequest.list("-created_date"),
    enabled: myTeamIds.length > 0,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["carpool-responses"],
    queryFn: () => base44.entities.CarpoolResponse.list("-created_date"),
  });

  const createRequest = useMutation({
    mutationFn: (data) => base44.entities.CarpoolRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carpool-requests"] });
      // Send push notification to team
      const team = myTeams.find(t => t.id === form.team_id);
      base44.functions.invoke("sendPushNotification", {
        title: `🚗 Carpool ${parseInt(form.seats_available) === 0 ? "Request" : "Offer"} — ${team?.name || "Your Team"}`,
        body: `${userName || userEmail} ${parseInt(form.seats_available) === 0 ? "needs a ride" : `is offering ${form.seats_available} seat(s)`}${form.pickup_location ? ` from ${form.pickup_location}` : ""}`,
        url: "/ParentPortal",
        team_id: form.team_id || null,
      });
      setShowForm(false);
      setForm({ seats_available: "", pickup_location: "", notes: "", event_id: "", team_id: myTeamIds[0] || "" });
    },
  });

  const createResponse = useMutation({
    mutationFn: (data) => base44.entities.CarpoolResponse.create(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["carpool-responses"] });
      // Notify the original requester
      const req = requests.find(r => r.id === vars.carpool_request_id);
      if (req) {
        base44.functions.invoke("sendPushNotification", {
          title: `🚗 Carpool Response`,
          body: `${userName || userEmail} responded to your carpool request`,
          url: "/ParentPortal",
          team_id: req.team_id || null,
        });
      }
      setRespondingTo(null);
      setResponseMsg("");
    },
  });

  const myTeamRequests = requests.filter(r => myTeamIds.includes(r.team_id) && r.status === "open");
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).slice(0, 20);

  const getResponsesFor = (reqId) => responses.filter(r => r.carpool_request_id === reqId);
  const myResponse = (reqId) => responses.find(r => r.carpool_request_id === reqId && r.responder_email === userEmail);

  const handleSubmit = () => {
    const selectedEvent = upcomingEvents.find(e => e.id === form.event_id);
    const team = myTeams.find(t => t.id === form.team_id);
    createRequest.mutate({
      team_id: form.team_id,
      team_name: team?.name || "",
      event_id: form.event_id || "",
      event_title: selectedEvent?.title || "",
      event_date: selectedEvent?.date || new Date().toISOString().split("T")[0],
      event_time: selectedEvent?.start_time || "",
      requester_name: userName || userEmail,
      requester_email: userEmail,
      seats_available: parseInt(form.seats_available) || 0,
      pickup_location: form.pickup_location,
      notes: form.notes,
      status: "open",
    });
  };

  const handleRespond = (req) => {
    createResponse.mutate({
      carpool_request_id: req.id,
      team_id: req.team_id,
      responder_name: userName || userEmail,
      responder_email: userEmail,
      message: responseMsg,
      status: "offered",
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" /> Carpool Board
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Coordinate rides with other team families</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          {showForm ? "Cancel" : "Post"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h4 className="font-semibold text-foreground text-sm">Post a Carpool</h4>

          {myTeamIds.length > 1 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Team</label>
              <select
                value={form.team_id}
                onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))}
                className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
              >
                {myTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Event (optional)</label>
            <select
              value={form.event_id}
              onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
              className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
            >
              <option value="">— General / Not event-specific —</option>
              {upcomingEvents.filter(e => myTeamIds.includes(e.team_id)).map(e => (
                <option key={e.id} value={e.id}>{e.title} – {e.date}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Seats Available</label>
            <div className="flex gap-2">
              <button
                onClick={() => setForm(f => ({ ...f, seats_available: "0" }))}
                className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${form.seats_available === "0" ? "bg-primary/20 border-primary/40 text-primary" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
              >
                🙋 I Need a Ride
              </button>
              {["1", "2", "3", "4"].map(n => (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, seats_available: n }))}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${form.seats_available === n ? "bg-primary/20 border-primary/40 text-primary" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {form.seats_available !== "0" && form.seats_available !== "" && (
              <p className="text-xs text-muted-foreground mt-1">Seats you're offering</p>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pickup Location</label>
            <Input
              value={form.pickup_location}
              onChange={e => setForm(f => ({ ...f, pickup_location: e.target.value }))}
              placeholder="e.g. Walmart on Main St, or your neighborhood"
              className="bg-surface border-border"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any details parents should know"
              className="bg-surface border-border"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={form.seats_available === "" || createRequest.isPending}
            className="w-full"
          >
            {createRequest.isPending ? "Posting..." : "Post Carpool"}
          </Button>
        </div>
      )}

      {myTeamRequests.length === 0 ? (
        <div className="text-center py-10 bg-card border border-border rounded-2xl">
          <Car className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No open carpool posts yet</p>
          <p className="text-xs text-muted-foreground mt-1">Be the first to offer or request a ride!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myTeamRequests.map(req => {
            const resps = getResponsesFor(req.id);
            const alreadyResponded = !!myResponse(req.id);
            const isMyRequest = req.requester_email === userEmail;
            const isOffer = req.seats_available > 0;

            return (
              <div key={req.id} className={`bg-card border rounded-2xl p-4 space-y-3 ${isOffer ? "border-green-500/20" : "border-yellow-500/20"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOffer ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                      {isOffer ? `🚗 Offering ${req.seats_available} seat${req.seats_available !== 1 ? "s" : ""}` : "🙋 Needs a Ride"}
                    </span>
                    {req.team_name && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{req.team_name}</span>}
                  </div>
                  {isMyRequest && <span className="text-xs text-muted-foreground">Your post</span>}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{req.requester_name || req.requester_email}</p>
                  {req.event_title && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" /> {req.event_title}
                      {req.event_date && ` – ${format(new Date(req.event_date + "T00:00:00"), "MMM d")}`}
                      {req.event_time && <><Clock className="w-3 h-3 ml-1" /> {req.event_time}</>}
                    </div>
                  )}
                  {req.pickup_location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" /> {req.pickup_location}
                    </div>
                  )}
                  {req.notes && <p className="text-xs text-muted-foreground italic">{req.notes}</p>}
                </div>

                {/* Responses */}
                {resps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{resps.length} response{resps.length !== 1 ? "s" : ""}</p>
                    {resps.map(r => (
                      <div key={r.id} className="flex items-start gap-2 bg-surface rounded-xl px-3 py-2">
                        <Users className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{r.responder_name || r.responder_email}</p>
                          {r.message && <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Respond button (not for own posts) */}
                {!isMyRequest && !alreadyResponded && (
                  respondingTo === req.id ? (
                    <div className="space-y-2">
                      <Input
                        value={responseMsg}
                        onChange={e => setResponseMsg(e.target.value)}
                        placeholder="Send a message with your response..."
                        className="bg-surface border-border text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setRespondingTo(null); setResponseMsg(""); }} className="gap-1">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleRespond(req)} disabled={createResponse.isPending} className="flex-1 gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {createResponse.isPending ? "Sending..." : isOffer ? "Request a Seat" : "Offer a Ride"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setRespondingTo(req.id)} className="w-full gap-1.5 border-primary/30 text-primary hover:bg-primary/10">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {isOffer ? "Request a Seat" : "Offer a Ride"}
                    </Button>
                  )
                )}

                {!isMyRequest && alreadyResponded && (
                  <p className="text-xs text-green-400 flex items-center gap-1">✓ You responded to this post</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}