import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, Users, ChevronDown, ChevronUp, Phone, MapPin, Plus, X } from "lucide-react";

function ZipGroup({ zip, drivers, seekers }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
        <MapPin className="w-3 h-3" /> ZIP {zip}
      </p>
      {drivers.map(d => (
        <div key={d.id} className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg px-2.5 py-1.5">
          <Car className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-green-300 truncate">{d.requester_name}</p>
            {d.pickup_location && <p className="text-[10px] text-muted-foreground truncate">{d.pickup_location}</p>}
          </div>
          <span className="text-[10px] font-bold text-green-400 whitespace-nowrap">{d.seats_available} seat{d.seats_available !== 1 ? "s" : ""}</span>
          {d.phone_number && (
            <a href={`tel:${d.phone_number}`} className="text-green-400 hover:text-green-300 transition-colors">
              <Phone className="w-3 h-3" />
            </a>
          )}
        </div>
      ))}
      {seekers.map(s => (
        <div key={s.id} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5">
          <Users className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-300 truncate">{s.requester_name}</p>
            {s.notes && <p className="text-[10px] text-muted-foreground truncate">{s.notes}</p>}
          </div>
          {s.phone_number && (
            <a href={`tel:${s.phone_number}`} className="text-blue-400 hover:text-blue-300 transition-colors">
              <Phone className="w-3 h-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

const EMPTY_FORM = { carpool_type: "", seats_available: 1, phone_number: "", neighborhood_zip: "", pickup_location: "", notes: "" };

export default function CarpoolHub({ eventId, eventTitle, eventDate, eventTime, teamId, teamName, currentUser }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: entries = [] } = useQuery({
    queryKey: ["carpool-hub", eventId],
    queryFn: () => base44.entities.CarpoolRequest.filter({ event_id: eventId, status: "open" }),
    enabled: open && !!eventId,
  });

  const myEntry = entries.find(e => e.requester_email === currentUser?.email);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CarpoolRequest.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carpool-hub", eventId] });
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CarpoolRequest.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["carpool-hub", eventId] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      event_id: eventId,
      event_title: eventTitle,
      event_date: eventDate,
      event_time: eventTime,
      team_id: teamId,
      team_name: teamName,
      requester_name: currentUser?.full_name || currentUser?.email || "",
      requester_email: currentUser?.email || "",
      ...form,
      seats_available: form.carpool_type === "seeking_ride" ? 0 : Number(form.seats_available),
    });
  };

  // Group entries by ZIP
  const drivers = entries.filter(e => e.carpool_type === "offering_ride");
  const seekers = entries.filter(e => e.carpool_type === "seeking_ride");
  const allZips = [...new Set([...drivers.map(d => d.neighborhood_zip || "?"), ...seekers.map(s => s.neighborhood_zip || "?")])].sort();

  return (
    <div className="border-t border-primary/20 mt-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Car className="w-3.5 h-3.5" />
          Team Carpool Hub
          {entries.length > 0 && (
            <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px]">{entries.length}</span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          {/* My entry */}
          {myEntry ? (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              <span className="text-xs text-primary font-medium">
                {myEntry.carpool_type === "offering_ride" ? `You're offering ${myEntry.seats_available} seat(s)` : "You're seeking a ride"}
              </span>
              <button
                onClick={() => deleteMutation.mutate(myEntry.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : !showForm ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setForm({ ...EMPTY_FORM, carpool_type: "offering_ride" }); setShowForm(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-colors"
              >
                <Car className="w-3.5 h-3.5" /> Offer a Ride
              </button>
              <button
                onClick={() => { setForm({ ...EMPTY_FORM, carpool_type: "seeking_ride" }); setShowForm(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors"
              >
                <Users className="w-3.5 h-3.5" /> Need a Ride
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2 bg-surface rounded-xl p-3 border border-border">
              <p className="text-xs font-semibold text-foreground">
                {form.carpool_type === "offering_ride" ? "🚗 Offer a Ride" : "🙋 Request a Ride"}
              </p>
              <input
                placeholder="Your phone (optional)"
                value={form.phone_number}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              <input
                placeholder="Neighborhood ZIP code"
                value={form.neighborhood_zip}
                onChange={e => setForm(f => ({ ...f, neighborhood_zip: e.target.value }))}
                maxLength={5}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
              {form.carpool_type === "offering_ride" && (
                <>
                  <input
                    placeholder="Pickup location (e.g. Kroger on Main St)"
                    value={form.pickup_location}
                    onChange={e => setForm(f => ({ ...f, pickup_location: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">Seats available:</label>
                    <input
                      type="number" min={1} max={8}
                      value={form.seats_available}
                      onChange={e => setForm(f => ({ ...f, seats_available: e.target.value }))}
                      className="w-16 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}
              {form.carpool_type === "seeking_ride" && (
                <input
                  placeholder="Any notes (optional)"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {createMutation.isPending ? "Saving..." : "Submit"}
                </button>
              </div>
            </form>
          )}

          {/* Listings grouped by ZIP */}
          {allZips.length > 0 ? (
            <div className="space-y-3 pt-1">
              {allZips.map(zip => (
                <ZipGroup
                  key={zip}
                  zip={zip}
                  drivers={drivers.filter(d => (d.neighborhood_zip || "?") === zip)}
                  seekers={seekers.filter(s => (s.neighborhood_zip || "?") === zip)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground text-center py-2">No carpool entries yet. Be the first!</p>
          )}
        </div>
      )}
    </div>
  );
}