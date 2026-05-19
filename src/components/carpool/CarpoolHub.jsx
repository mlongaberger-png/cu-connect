import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Car, Calendar, MapPin, Users, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";

export default function CarpoolHub({ currentUser, myTeamIds, myTeams, events }) {
  const queryClient = useQueryClient();
  const userEmail = currentUser?.email || "";
  const userName = currentUser?.full_name || userEmail;

  const [showFindRide, setShowFindRide] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [respondingTo, setRespondingTo] = useState(null);
  const [responseMsg, setResponseMsg] = useState("");
  const [offerForm, setOfferForm] = useState({ event_id: "", seats_available: "2", pickup_location: "", notes: "" });

  const today = new Date().toISOString().split("T")[0];
  const upcomingEvents = (events || []).filter(e => e.date >= today && myTeamIds?.includes(e.team_id));

  const { data: requests = [] } = useQuery({
    queryKey: ["carpool-requests", myTeamIds?.join(",")],
    queryFn: () => base44.entities.CarpoolRequest.list("-created_date"),
    enabled: !!myTeamIds?.length,
  });

  const { data: responses = [] } = useQuery({
    queryKey: ["carpool-responses"],
    queryFn: () => base44.entities.CarpoolResponse.list("-created_date"),
  });

  const createResponse = useMutation({
    mutationFn: (data) => base44.entities.CarpoolResponse.create(data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["carpool-responses"] });
      const req = requests.find(r => r.id === vars.carpool_request_id);
      if (req) {
        base44.functions.invoke("sendPushNotification", {
          title: `🚗 Carpool Response`,
          body: `${userName} responded to your carpool request`,
          url: "/ParentPortal",
          team_id: req.team_id || null,
        });
      }
      setRespondingTo(null);
      setResponseMsg("");
    },
  });

  const createOffer = useMutation({
    mutationFn: (data) => base44.entities.CarpoolRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carpool-requests"] });
      setShowOfferForm(false);
      setOfferForm({ event_id: "", seats_available: "2", pickup_location: "", notes: "" });
    },
  });

  const teamRequests = requests.filter(r => myTeamIds?.includes(r.team_id) && r.status === "open");
  const myRides = requests.filter(r => r.requester_email === userEmail);

  const getResponses = (reqId) => responses.filter(r => r.carpool_request_id === reqId);
  const alreadyResponded = (reqId) => responses.some(r => r.carpool_request_id === reqId && r.responder_email === userEmail);

  // Enrich with event data
  const enriched = (list) => list.map(req => ({
    ...req,
    _event: req.event_id ? (events || []).find(e => e.id === req.event_id) : null,
  }));

  const handleOfferSubmit = (e) => {
    e.preventDefault();
    const ev = upcomingEvents.find(e => e.id === offerForm.event_id);
    const team = myTeams?.find(t => t.id === ev?.team_id);
    createOffer.mutate({
      team_id: ev?.team_id || myTeamIds?.[0] || "",
      team_name: team?.name || "",
      event_id: offerForm.event_id,
      event_title: ev?.title || "",
      event_date: ev?.date || today,
      event_time: ev?.start_time || "",
      requester_name: userName,
      requester_email: userEmail,
      seats_available: parseInt(offerForm.seats_available) || 2,
      pickup_location: offerForm.pickup_location,
      notes: offerForm.notes,
      status: "open",
      carpool_type: "offering_ride",
    });
  };

  const handleOfferToDrive = (req) => {
    const msg = `I can drive you to ${req.event_title || "the event"}! Let me know if you still need a ride.`;
    setResponseMsg(msg);
    setRespondingTo(req.id);
  };

  const RequestCard = ({ req, showActions = true }) => {
    const isOffer = req.seats_available > 0;
    const isMyPost = req.requester_email === userEmail;
    const resps = getResponses(req.id);
    const responded = alreadyResponded(req.id);
    const ev = req._event;
    const initials = (req.requester_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    return (
      <Card className={`p-4 border-l-4 ${isOffer ? "border-l-green-500" : "border-l-orange-500"} bg-card border-border space-y-3`}>
        {/* Top: Avatar + Name + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{req.requester_name || req.requester_email}</p>
              {req.team_name && <p className="text-xs text-muted-foreground">{req.team_name}</p>}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOffer ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
            {isOffer ? `🚗 Offering ${req.seats_available} seat${req.seats_available !== 1 ? "s" : ""}` : "🙋 Needs a Ride"}
          </span>
        </div>

        {/* Middle: Event context */}
        {(req.event_title || ev) && (
          <div className="bg-surface rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-sm font-bold text-foreground">
              {ev?.title || req.event_title}
              {(ev?.opponent || "") && ` vs ${ev.opponent}`}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {(req.event_date || ev?.date) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date((req.event_date || ev?.date) + "T00:00:00"), "EEEE, MMM d")}
                  {(req.event_time || ev?.start_time) && ` · ${req.event_time || ev?.start_time}`}
                </span>
              )}
              {(ev?.location || req.pickup_location) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {ev?.location || req.pickup_location}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Bottom: Badges */}
        <div className="flex flex-wrap gap-2 items-center">
          {req.neighborhood_zip && (
            <Badge variant="outline" className="text-xs border-border">{req.neighborhood_zip}</Badge>
          )}
          {!isOffer && (
            <Badge className="text-xs bg-orange-500/20 text-orange-300 border-0">
              Needs {req.seats_needed || "a"} Seat{(req.seats_needed || 1) !== 1 ? "s" : ""}
            </Badge>
          )}
          {req.pickup_location && isOffer && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />{req.pickup_location}
            </span>
          )}
          {req.notes && <p className="text-xs text-muted-foreground w-full italic">{req.notes}</p>}
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

        {/* Actions */}
        {showActions && !isMyPost && (
          responded ? (
            <p className="text-xs text-green-400 flex items-center gap-1">✓ You responded to this post</p>
          ) : respondingTo === req.id ? (
            <div className="space-y-2">
              <Input
                value={responseMsg}
                onChange={e => setResponseMsg(e.target.value)}
                placeholder="Your message..."
                className="bg-surface border-border text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setRespondingTo(null); setResponseMsg(""); }} className="gap-1 border-border">
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => createResponse.mutate({ carpool_request_id: req.id, team_id: req.team_id, responder_name: userName, responder_email: userEmail, message: responseMsg, status: "offered" })}
                  disabled={createResponse.isPending}
                  className="flex-1"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1" />
                  {createResponse.isPending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          ) : (
            !isOffer && (
              <Button size="sm" onClick={() => handleOfferToDrive(req)} className="w-full bg-primary text-primary-foreground gap-1.5">
                <Car className="w-3.5 h-3.5" /> Offer to Drive
              </Button>
            )
          )
        )}
        {showActions && isMyPost && <p className="text-xs text-muted-foreground">Your post</p>}
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" /> Carpool Hub
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Coordinate rides with team families</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowFindRide(true)} className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-1.5">
            🙋 Find a Ride
          </Button>
          <Button size="sm" onClick={() => setShowOfferForm(v => !v)} className="gap-1.5 bg-primary text-primary-foreground">
            🚗 Offer a Ride
          </Button>
        </div>
      </div>

      {/* Offer Ride Form */}
      {showOfferForm && (
        <Card className="p-4 border-border bg-card space-y-4">
          <h4 className="font-semibold text-sm text-foreground">Offer a Ride</h4>
          <form onSubmit={handleOfferSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Event</label>
              <select
                value={offerForm.event_id}
                onChange={e => setOfferForm(f => ({ ...f, event_id: e.target.value }))}
                className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-2 text-foreground"
              >
                <option value="">— Select an event —</option>
                {upcomingEvents.map(e => (
                  <option key={e.id} value={e.id}>
                    {format(new Date(e.date + "T00:00:00"), "MMM d")} — {e.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Seats Available</label>
                <Input type="number" min="1" max="8" value={offerForm.seats_available} onChange={e => setOfferForm(f => ({ ...f, seats_available: e.target.value }))} className="bg-surface border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Pickup Location</label>
                <Input value={offerForm.pickup_location} onChange={e => setOfferForm(f => ({ ...f, pickup_location: e.target.value }))} placeholder="e.g. Walmart on Main" className="bg-surface border-border" />
              </div>
            </div>
            <Input value={offerForm.notes} onChange={e => setOfferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="bg-surface border-border" />
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowOfferForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" disabled={createOffer.isPending} className="bg-primary text-primary-foreground">
                {createOffer.isPending ? "Posting…" : "Post Offer"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="team">
        <TabsList className="w-full bg-surface">
          <TabsTrigger value="team" className="flex-1">Team Requests</TabsTrigger>
          <TabsTrigger value="mine" className="flex-1">My Rides</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-3 space-y-3">
          {teamRequests.length === 0 ? (
            <div className="text-center py-10 bg-card border border-dashed border-border rounded-2xl">
              <Car className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open carpool posts yet</p>
              <p className="text-xs text-muted-foreground mt-1">Be the first to find or offer a ride!</p>
            </div>
          ) : enriched(teamRequests).map(req => <RequestCard key={req.id} req={req} showActions />)}
        </TabsContent>

        <TabsContent value="mine" className="mt-3 space-y-3">
          {myRides.length === 0 ? (
            <div className="text-center py-10 bg-card border border-dashed border-border rounded-2xl">
              <Car className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">You haven't posted any rides yet</p>
            </div>
          ) : enriched(myRides).map(req => <RequestCard key={req.id} req={req} showActions={false} />)}
        </TabsContent>
      </Tabs>

      {/* Find a Ride Modal */}
      <CarpoolRequestModal
        open={showFindRide}
        onOpenChange={setShowFindRide}
        currentUser={currentUser}
        myTeamIds={myTeamIds}
        myTeams={myTeams}
      />
    </div>
  );
}