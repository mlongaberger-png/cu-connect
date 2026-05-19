import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Pencil, Star, Globe, Building2, Clock, CheckCircle2, XCircle, ShieldCheck, ImagePlus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { useRef } from "react";

const TIER_COLORS = {
  Gold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Silver: "bg-zinc-400/20 text-zinc-300 border-zinc-400/30",
  Bronze: "bg-orange-600/20 text-orange-400 border-orange-500/30",
};

const STATUS_BADGE = {
  pending:  { label: "⏳ Pending Admin Review", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved: { label: "✅ Live",                  cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  rejected: { label: "❌ Declined",              cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const emptyForm = { business_name: "", website_url: "", logo_url: "", tier: "Bronze" };

function urlValid(val) {
  if (!val) return true;
  try { const u = new URL(val); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}

function SponsorRow({ s, isAdmin, onEdit, onDelete, onToggle, onApprove, onDecline }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
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
          {s.submitted_by_email && <p className="text-xs text-muted-foreground">by {s.submitted_by_email}</p>}
        </div>
      </div>

      <Badge variant="outline" className={`shrink-0 text-xs ${TIER_COLORS[s.tier] || ""}`}>{s.tier}</Badge>
      <Badge variant="outline" className={`shrink-0 text-xs ${STATUS_BADGE[s.approval_status]?.cls || ""}`}>
        {STATUS_BADGE[s.approval_status]?.label || s.approval_status}
      </Badge>

      <div className="flex items-center gap-1 shrink-0">
        {isAdmin && s.approval_status === "approved" && (
          <Switch checked={s.is_active} onCheckedChange={v => onToggle(s.id, v)} className="scale-75" />
        )}
        {isAdmin && s.approval_status !== "pending" && (
          <>
            <button onClick={() => onEdit(s)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        {!isAdmin && (
          <button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function SponsorManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAD = user?.role === "athletic_director";

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [urlError, setUrlError] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef();

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
    onSuccess: () => { invalidateAll(); resetForm(); toast({ title: isAD ? "Prospect submitted for review" : "Sponsor added" }); },
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

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Sponsor.update(id, {
      approval_status: "approved",
      is_active: true,
      reviewed_by_email: user?.email || "",
      reviewed_at: new Date().toISOString(),
    }),
    onSuccess: () => { invalidateAll(); toast({ title: "Sponsor approved & activated" }); },
  });

  const declineMutation = useMutation({
    mutationFn: (id) => base44.entities.Sponsor.update(id, {
      approval_status: "rejected",
      is_active: false,
      reviewed_by_email: user?.email || "",
      reviewed_at: new Date().toISOString(),
    }),
    onSuccess: () => { invalidateAll(); toast({ title: "Prospect declined" }); },
  });

  const resetForm = () => { setForm(emptyForm); setEditing(null); setUrlError(false); setUploadingLogo(false); };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, logo_url: file_url }));
    setUploadingLogo(false);
    toast({ title: "Logo uploaded" });
  };

  const startEdit = (s) => {
    setEditing(s);
    setForm({ business_name: s.business_name, website_url: s.website_url || "", logo_url: s.logo_url || "", tier: s.tier });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.website_url && !urlValid(form.website_url)) { setUrlError(true); return; }
    setUrlError(false);

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      const payload = {
        ...form,
        approval_status: isAD ? "pending" : "approved",
        is_active: isAD ? false : true,
        submitted_by_email: user?.email || "",
      };
      createMutation.mutate(payload);
    }
  };

  const pendingSponsors = sponsors.filter(s => s.approval_status === "pending");
  const otherSponsors = sponsors.filter(s => s.approval_status !== "pending");
  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">

      {/* ── Admin: Pending Approval Queue ── */}
      {isAdmin && pendingSponsors.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-yellow-500/20 flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <h3 className="font-semibold text-yellow-400 text-sm">Pending Review ({pendingSponsors.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {pendingSponsors.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
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
                      <a href={s.website_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate flex items-center gap-1">
                        <Globe className="w-3 h-3 shrink-0" />{s.website_url}
                      </a>
                    )}
                    {s.submitted_by_email && <p className="text-xs text-muted-foreground">Submitted by {s.submitted_by_email}</p>}
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-xs ${TIER_COLORS[s.tier] || ""}`}>{s.tier}</Badge>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => approveMutation.mutate(s.id)} disabled={approveMutation.isPending} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => declineMutation.mutate(s.id)} disabled={declineMutation.isPending} className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs">
                    <XCircle className="w-3.5 h-3.5" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Form ── */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          {editing ? "Edit Sponsor" : isAD ? "Submit Sponsor Prospect" : "Add Sponsor"}
        </h3>
        {isAD && !editing && (
          <p className="text-xs text-muted-foreground">Prospects require Organization Admin approval before going live.</p>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Business Name *</Label>
            <Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} placeholder="Acme Sports Co." required className="bg-surface border-border" />
          </div>

          <div className="space-y-1.5">
            <Label>Website URL</Label>
            <Input value={form.website_url} onChange={e => { setForm(f => ({ ...f, website_url: e.target.value })); setUrlError(false); }} placeholder="https://example.com" className={`bg-surface border-border ${urlError ? "border-red-500/70" : ""}`} />
            {urlError && <p className="text-xs text-red-400">Must be a valid http/https URL</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex gap-2 items-center">
              <Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://cdn.example.com/logo.png" className="bg-surface border-border flex-1" />
              <button
                type="button"
                onClick={() => logoFileRef.current?.click()}
                disabled={uploadingLogo}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-sm text-muted-foreground hover:text-foreground transition-colors"
                title="Upload from gallery"
              >
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              </button>
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo preview" className="h-10 mt-1 object-contain rounded border border-border bg-surface p-1" />
            )}
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

          {/* Active toggle only for admins, not ADs */}
          {isAdmin && editing && (
            <div className="flex items-center gap-3 pt-1 sm:col-span-2">
              <Switch checked={form.is_active || false} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <span className="text-sm text-muted-foreground">Active (shows in live rotation)</span>
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isBusy} className="gap-2">
              <Plus className="w-4 h-4" />
              {editing ? "Save Changes" : isAD ? "Submit for Review" : "Add Sponsor"}
            </Button>
            {editing && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </form>
      </div>

      {/* ── Sponsors Table ── */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            {isAdmin ? <ShieldCheck className="w-4 h-4 text-primary" /> : <Star className="w-4 h-4 text-primary" />}
            {isAdmin ? "All Sponsors" : "My Submissions"}
          </h3>
          <span className="text-xs text-muted-foreground">{isAdmin ? otherSponsors.length : sponsors.length} records</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (isAdmin ? otherSponsors : sponsors).length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            {isAD ? "No submissions yet. Use the form above to submit a prospect." : "No sponsors yet."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(isAdmin ? otherSponsors : sponsors).map(s => (
              <SponsorRow
                key={s.id}
                s={s}
                isAdmin={isAdmin}
                onEdit={startEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onToggle={(id, v) => toggleMutation.mutate({ id, is_active: v })}
                onApprove={(id) => approveMutation.mutate(id)}
                onDecline={(id) => declineMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}