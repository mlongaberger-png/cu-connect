import React, { useState } from "react";
import { formatDate, formatTime12h } from "@/utils/dateTime";
import { X, MapPin, Clock, Trophy, FileText, Download, Calendar, Pencil, Check, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateICSContent, downloadICS } from "@/utils/calendarExport";

const EVENT_TYPES = ["practice", "game", "tournament", "meeting", "fundraiser", "other"];

const typeColors = {
  practice: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  game: "bg-green-500/20 text-green-400 border-green-500/30",
  tournament: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  meeting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  fundraiser: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  other: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

export default function EventDetailPanel({ event, onClose, onUpdate, onDelete, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...event });
  const [saving, setSaving] = useState(false);

  if (!event) return null;

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
    const start = event.date?.replace(/-/g, "") + (event.start_time ? `T${event.start_time.replace(":", "")}00` : "");
    const end = event.date?.replace(/-/g, "") + (event.end_time ? `T${event.end_time.replace(":", "")}00` : (event.start_time ? `T${event.start_time.replace(":", "")}00` : ""));
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&location=${encodeURIComponent(event.location || "")}&details=${encodeURIComponent(event.notes || "")}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={editing ? undefined : onClose}>
      <div
        className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {editing ? (
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-7 text-xs bg-surface border-border w-36"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize text-xs">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border capitalize ${typeColors[event.type] || ""}`}>{event.type}</span>
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

        {/* Title */}
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
            {(form.type === "game" || form.type === "tournament") && (
              <div>
                <Label className="text-xs">Opponent</Label>
                <Input value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} className="bg-surface border-border mt-0.5" />
              </div>
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
          <>
            <div>
              <h2 className="text-xl font-bold text-foreground">{event.title}</h2>
              {event.opponent && <p className="text-sm text-muted-foreground mt-0.5">vs {event.opponent}</p>}
            </div>
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
                  <span>{formatTime12h(event.start_time)}{event.end_time ? ` – ${formatTime12h(event.end_time)}` : ""}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{event.location}</span>
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
          <div className="pt-2 border-t border-border space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Add to Calendar</p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleExportICS}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download (.ics)
              </Button>
              <Button size="sm" variant="outline" className="border-border text-sm" onClick={handleAddToGoogleCalendar}>
                <Calendar className="w-3.5 h-3.5 mr-1" /> Google Calendar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}