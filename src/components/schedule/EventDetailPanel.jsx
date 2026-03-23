import React, { useState } from "react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { X, MapPin, Clock, Trophy, FileText, Download, Calendar, Pencil, Check, ClipboardList, CheckCircle2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateICSContent, downloadICS } from "@/utils/calendarExport";
import { useOrgTimezone } from "@/lib/useOrgTimezone";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

const getGoogleMapsUrl = (location) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
const getAppleMapsUrl = (location) => `https://maps.apple.com/?q=${encodeURIComponent(location)}`;

const EVENT_TYPES = ["practice", "game", "tournament", "meeting", "fundraiser", "other"];
const TOURNAMENT_ROUNDS = ["Pool Play", "Round of 16", "Quarterfinals", "Semifinals", "Finals", "Championship"];

const typeColors = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  tournament: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundraiser: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const resultConfig = {
  win:  { label: "Win",  color: "bg-green-500/20 text-green-400 border-green-500/30" },
  loss: { label: "Loss", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  draw: { label: "Draw", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
};

export default function EventDetailPanel({ event, onClose, onUpdate, onDelete, canEdit }) {
  const { abbr } = useOrgTimezone();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...event });
  const [saving, setSaving] = useState(false);
  const [creatingRsvp, setCreatingRsvp] = useState(false);
  const [rsvpCreated, setRsvpCreated] = useState(false);

  if (!event) return null;

  const isCompetition = form.type === "game" || form.type === "tournament";

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(event.id, form);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...event });
    setEditing(false);
  };

  const handleExportICS = () => {
    const ics = generateICSContent([event]);
    downloadICS(ics, `${event.title.replace(/\s+/g, "_")}.ics`);
  };

  const handleAddToGoogleCalendar = () => {
    const d = event.date?.replace(/-/g, "") || "";
    let start, end;
    if (event.start_time) {
      start = `${d}T${event.start_time.replace(":", "")}00`;
      if (event.end_time) {
        end = `${d}T${event.end_time.replace(":", "")}00`;
      } else {
        // default to 1 hour later
        const [h, m] = event.start_time.split(":").map(Number);
        const endH = String((h + 1) % 24).padStart(2, "0");
        end = `${d}T${endH}${String(m).padStart(2, "0")}00`;
      }
    } else {
      // all-day event
      start = d;
      end = d;
    }
    const details = [event.notes, event.opponent ? `vs ${event.opponent}` : ""].filter(Boolean).join("\n");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&location=${encodeURIComponent(event.location || "")}&details=${encodeURIComponent(details)}`;
    window.open(url, "_blank");
  };

  const hasScore = event.our_score != null && event.our_score !== "";
  const isViewCompetition = (event.type === "game" || event.type === "tournament");

  const handleCreateRsvp = async () => {
    setCreatingRsvp(true);
    const label = `${event.title}${event.start_time ? ` – ${formatTime12h(event.start_time)}` : ""}`;
    await base44.entities.AttendanceRequest.create({
      team_id: event.team_id,
      team_name: event.team_name,
      event_id: event.id,
      label,
      event_type: (event.type === "game" || event.type === "tournament" || event.type === "meeting") ? event.type : "other",
      event_date: event.date,
      event_time: event.start_time || "",
      created_by_name: user?.full_name || "Staff",
      created_by_email: user?.email || "",
      channel_id: event.team_id,
    });
    queryClient.invalidateQueries({ queryKey: ["attendance-requests"] });
    setCreatingRsvp(false);
    setRsvpCreated(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={editing ? undefined : onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, tournament_round: v !== "tournament" ? "" : f.tournament_round }))}>
                <SelectTrigger className="h-7 text-xs bg-surface border-border w-36"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize text-xs">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${typeColors[event.type] || ""}`}>{event.type}</span>
                {event.tournament_round && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">{event.tournament_round}</span>
                )}
                {event.result && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold border capitalize ${resultConfig[event.result]?.color || ""}`}>
                    {resultConfig[event.result]?.label}
                    {hasScore ? ` ${event.our_score}–${event.opponent_score ?? "?"}` : ""}
                  </span>
                )}
                {event.is_championship_win && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold flex items-center gap-1">
                    🏆 Championship
                  </span>
                )}
                {event.is_cancelled && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Cancelled</span>}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            <button onClick={editing ? handleCancel : onClose} className="p-1 rounded-lg hover:bg-surface text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-surface border-border mt-0.5" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="bg-surface border-border mt-0.5 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="bg-surface border-border mt-0.5 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">End</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="bg-surface border-border mt-0.5 h-8 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="bg-surface border-border mt-0.5" />
            </div>

            {isCompetition && (
              <>
                <div>
                  <Label className="text-xs">Opponent</Label>
                  <Input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="bg-surface border-border mt-0.5" />
                </div>

                {/* Tournament Round Dropdown */}
                {form.type === "tournament" && (
                  <div>
                    <Label className="text-xs">Tournament Round</Label>
                    <Select value={form.tournament_round || ""} onValueChange={v => setForm(f => ({ ...f, tournament_round: v }))}>
                      <SelectTrigger className="bg-surface border-border mt-0.5">
                        <SelectValue placeholder="Select round…" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        {TOURNAMENT_ROUNDS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Result */}
                <div>
                  <Label className="text-xs">Result</Label>
                  <div className="flex gap-2 mt-1">
                    {["win", "loss", "draw"].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, result: f.result === r ? "" : r, is_championship_win: r !== "win" ? false : f.is_championship_win }))}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all capitalize ${form.result === r ? resultConfig[r].color : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {r === "win" ? "✓ Win" : r === "loss" ? "✗ Loss" : "~ Draw"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Score */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Our Score</Label>
                    <Input value={form.our_score || ""} onChange={e => setForm(f => ({ ...f, our_score: e.target.value }))} placeholder="e.g. 3" className="bg-surface border-border mt-0.5" />
                  </div>
                  <div>
                    <Label className="text-xs">Opponent Score</Label>
                    <Input value={form.opponent_score || ""} onChange={e => setForm(f => ({ ...f, opponent_score: e.target.value }))} placeholder="e.g. 1" className="bg-surface border-border mt-0.5" />
                  </div>
                </div>

                {/* Championship win toggle (only when result is win) */}
                {form.result === "win" && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_championship_win: !f.is_championship_win }))}
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-semibold transition-all ${form.is_championship_win ? "bg-primary/20 border-primary/40 text-primary" : "bg-surface border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    🏆 {form.is_championship_win ? "Championship Win ✓" : "Mark as Championship Win"}
                  </button>
                )}
              </>
            )}

            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="bg-surface border-border mt-0.5" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cancelled" checked={!!form.is_cancelled} onChange={e => setForm(f => ({ ...f, is_cancelled: e.target.checked }))} />
              <label htmlFor="cancelled" className="text-sm text-muted-foreground">Mark as Cancelled</label>
            </div>
          </div>
        ) : (
          /* View Mode */
          <>
            {/* Championship hero */}
            {event.is_championship_win && (
              <div className="bg-gradient-to-r from-primary/20 via-yellow-500/10 to-primary/20 border border-primary/30 rounded-xl p-4 text-center">
                <div className="text-3xl mb-1">🏆</div>
                <p className="text-sm font-bold text-primary">Championship Victory!</p>
                {hasScore && <p className="text-xs text-muted-foreground mt-0.5">Final Score: {event.our_score} – {event.opponent_score}</p>}
              </div>
            )}

            <div>
              <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
              {event.opponent && <p className="text-sm text-muted-foreground mt-0.5">vs {event.opponent}</p>}
            </div>

            {/* Score display for non-championship games */}
            {isViewCompetition && hasScore && !event.is_championship_win && (
              <div className={`flex items-center justify-center gap-4 p-4 rounded-xl border ${resultConfig[event.result]?.color || "border-border"}`}>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{event.our_score}</p>
                  <p className="text-xs text-muted-foreground">{event.team_name || "Us"}</p>
                </div>
                <span className="text-xl text-muted-foreground font-bold">–</span>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{event.opponent_score ?? "?"}</p>
                  <p className="text-xs text-muted-foreground">{event.opponent || "Opponent"}</p>
                </div>
              </div>
            )}

            <div className="space-y-2 text-sm">
              {event.date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{formatDate(event.date, "EEEE, MMMM d, yyyy")}</span>
                </div>
              )}
              {event.start_time && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{formatTime12h(event.start_time)}{event.end_time ? ` – ${formatTime12h(event.end_time)}` : ""}{abbr ? ` ${abbr}` : ""}</span>
                </div>
              )}
              {event.location && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex gap-3 pl-6">
                    <a href={getGoogleMapsUrl(event.location)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                      <Navigation className="w-3 h-3" /> Google Maps
                    </a>
                    <a href={getAppleMapsUrl(event.location)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:underline">
                      <Navigation className="w-3 h-3" /> Apple Maps
                    </a>
                  </div>
                </div>
              )}
              {event.team_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span>{event.team_name}{event.sport_name ? ` · ${event.sport_name}` : ""}</span>
                </div>
              )}
              {event.notes && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary mt-0.5" />
                  <span>{event.notes}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        {editing ? (
          <div className="pt-2 border-t border-border flex gap-2 justify-between">
            <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this event?")) { onDelete(event.id); onClose(); } }} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              Delete
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleCancel} className="border-border">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground gap-1">
                <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-2 border-t border-border space-y-3">
            {/* RSVP creation (staff only, team events only) */}
            {canEdit && event.team_id && (
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Parent RSVP</p>
                {rsvpCreated ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> RSVP request sent to parents
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/30 text-primary hover:bg-primary/10 text-sm gap-1.5"
                    onClick={handleCreateRsvp}
                    disabled={creatingRsvp}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    {creatingRsvp ? "Creating..." : "Request RSVP from Parents"}
                  </Button>
                )}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Add to Calendar</p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleExportICS}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download (.ics)
                </Button>
                <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleAddToGoogleCalendar}>
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Google Calendar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}