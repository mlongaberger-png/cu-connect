import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, MapPin, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  open:    { label: "Open",    icon: CheckCircle2,   cls: "text-green-400 bg-green-500/10 border-green-500/30" },
  delayed: { label: "Delayed", icon: AlertTriangle,  cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  closed:  { label: "Closed",  icon: XCircle,        cls: "text-red-400 bg-red-500/10 border-red-500/30" },
};

const BLANK = { location_name: "", status: "open", alert_message: "", is_active: true };

export default function FieldStatusManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["field-statuses"],
    queryFn: () => base44.entities.FieldStatus.list("-updated_at"),
  });

  const saveMutation = useMutation({
    mutationFn: (data) =>
      editing
        ? base44.entities.FieldStatus.update(editing.id, data)
        : base44.entities.FieldStatus.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-statuses"] });
      setShowForm(false);
      setEditing(null);
      setForm(BLANK);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FieldStatus.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["field-statuses"] }),
  });

  // Quick status toggle directly from the card
  const quickStatusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      base44.entities.FieldStatus.update(id, {
        status,
        updated_at: new Date().toISOString(),
        updated_by_name: user?.full_name || user?.email || "Staff",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["field-statuses"] }),
  });

  const handleEdit = (field) => {
    setEditing(field);
    setForm({
      location_name: field.location_name || "",
      status: field.status || "open",
      alert_message: field.alert_message || "",
      is_active: field.is_active !== false,
    });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
      updated_at: new Date().toISOString(),
      updated_by_name: user?.full_name || user?.email || "Staff",
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Field & Facility Status
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Alerts appear instantly on the Parent Portal home feed.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setForm(BLANK); setShowForm(true); }} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Location
        </Button>
      </div>

      {/* Field cards */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : fields.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm bg-card rounded-2xl border border-border">
          No locations configured yet. Add your first field or facility.
        </div>
      ) : (
        <div className="space-y-3">
          {fields.map(field => {
            const cfg = STATUS_CONFIG[field.status] || STATUS_CONFIG.open;
            const Icon = cfg.icon;
            return (
              <div key={field.id} className={`rounded-2xl border p-4 ${field.status !== "open" ? cfg.cls : "bg-card border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.cls.split(" ")[0]}`} />
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{field.location_name}</p>
                      {field.alert_message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{field.alert_message}</p>
                      )}
                      {field.updated_at && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Updated {format(new Date(field.updated_at), "MMM d, h:mm a")}
                          {field.updated_by_name ? ` by ${field.updated_by_name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(field)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(field.id)} className="h-8 w-8 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Quick status toggles */}
                <div className="flex gap-1.5 mt-3">
                  {Object.entries(STATUS_CONFIG).map(([key, s]) => (
                    <button
                      key={key}
                      onClick={() => quickStatusMutation.mutate({ id: field.id, status: key })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        field.status === key
                          ? s.cls
                          : "bg-surface border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { setShowForm(o); if (!o) { setEditing(null); setForm(BLANK); } }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Location Name</Label>
              <Input
                value={form.location_name}
                onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))}
                placeholder="e.g. Main Field, Gym A, Stadium"
                className="bg-surface border-border mt-1"
                required
              />
            </div>
            <div>
              <Label>Status</Label>
              <div className="flex gap-2 mt-1">
                {Object.entries(STATUS_CONFIG).map(([key, s]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: key }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                      form.status === key ? s.cls : "bg-surface border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Alert Message <span className="text-muted-foreground font-normal">(shown to parents)</span></Label>
              <Input
                value={form.alert_message}
                onChange={e => setForm(f => ({ ...f, alert_message: e.target.value }))}
                placeholder="e.g. Field closed due to rain. Practice moved to Gym B."
                className="bg-surface border-border mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}