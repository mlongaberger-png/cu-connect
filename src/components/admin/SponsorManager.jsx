import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Pencil, Star, Globe, Building2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TIER_COLORS = {
  Gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Silver: "bg-zinc-400/20 text-zinc-300 border-zinc-400/30",
  Bronze: "bg-orange-600/20 text-orange-400 border-orange-500/30",
};

const emptyForm = { business_name: "", website_url: "", logo_url: "", tier: "Bronze", is_active: true };

function urlValid(val) {
  if (!val) return true;
  try { const u = new URL(val); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

export default function SponsorManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [urlError, setUrlError] = useState(false);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ["sponsors"],
    queryFn: () => base44.entities.Sponsor.list("-created_date"),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["sponsors"] });
    queryClient.invalidateQueries({ queryKey: ["layout-sponsors"] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Sponsor.create(data),
    onSuccess: () => { invalidateAll(); resetForm(); toast({ title: "Sponsor added" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sponsor.update(id, data),
    onSuccess: () => { invalidateAll(); resetForm(); toast({ title: "Sponsor updated" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Sponsor.delete(id),
    onSuccess: () => { invalidateAll(); toast({ title: "Sponsor removed" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.Sponsor.update(id, { is_active }),
    onSuccess: () => invalidateAll(),
  });

  const resetForm = () => { setForm(emptyForm); setEditing(null); setUrlError(false); };

  const startEdit = (s) => { setEditing(s); setForm({ business_name: s.business_name, website_url: s.website_url || "", logo_url: s.logo_url || "", tier: s.tier, is_active: s.is_active }); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.website_url && !urlValid(form.website_url)) { setUrlError(true); return; }
    setUrlError(false);
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* ── Form ── */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          {editing ? "Edit Sponsor" : "Add Sponsor"}
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Name *</Label>
            <Input
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder="Acme Sports Co."
              required
              className="bg-surface border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Website URL</Label>
            <Input
              value={form.website_url}
              onChange={e => { setForm(f => ({ ...f, website_url: e.target.value })); setUrlError(false); }}
              placeholder="https://example.com"
              className={`bg-surface border-border ${urlError ? "border-red-500/70" : ""}`}
            />
            {urlError && <p className="text-xs text-red-400">Must be a valid http/https URL</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input
              value={form.logo_url}
              onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://cdn.example.com/logo.png"
              className="bg-surface border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Sponsorship Tier</Label>
            <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v }))}>
              <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Gold">🥇 Gold</SelectItem>
                <SelectItem value="Silver">🥈 Silver</SelectItem>
                <SelectItem value="Bronze">🥉 Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-1 sm:col-span-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
            />
            <span className="text-sm text-muted-foreground">Active (shows in live rotation)</span>
          </div>

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isBusy} className="gap-2">
              <Plus className="w-4 h-4" />
              {editing ? "Save Changes" : "Add Sponsor"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </form>
      </div>

      {/* ── Table ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Current Sponsors</h3>
          <span className="text-xs text-muted-foreground">{sponsors.length} total</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : sponsors.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No sponsors yet. Add one above.</div>
        ) : (
          <div className="divide-y divide-border">
            {sponsors.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                {/* Logo / Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.business_name} className="w-8 h-8 rounded object-contain bg-surface shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-surface flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{s.business_name}</p>
                    {s.website_url && (
                      <a href={s.website_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline truncate">
                        <Globe className="w-3 h-3 shrink-0" />{s.website_url}
                      </a>
                    )}
                  </div>
                </div>

                {/* Tier Badge */}
                <Badge variant="outline" className={`shrink-0 text-xs ${TIER_COLORS[s.tier]}`}>{s.tier}</Badge>

                {/* Status Badge */}
                <Badge variant="outline" className={`shrink-0 text-xs ${s.is_active ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                  {s.is_active ? "Active" : "Inactive"}
                </Badge>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={v => toggleMutation.mutate({ id: s.id, is_active: v })}
                    className="scale-75"
                  />
                  <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}