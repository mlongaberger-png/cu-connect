import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, FileText, Send, Save, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";

const FEE_TYPES = ["registration", "uniforms", "tournament", "fundraising", "other"];
const emptyLine = { name: "", quantity: 1, unit_amount: "" };
const emptyForm = { description: "", fee_type: "other", notes: "", due_date: "", discount_amount: "", credit_amount: "", discount_note: "" };

export default function InvoiceDrawer({ open, onClose, onSaved, defaultTeamId = null, defaultPlayerId = null }) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();
  const isAdmin = ["admin", "athletic_director"].includes(user?.role);

  // ── Queries ──
  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["invoice-templates"], queryFn: () => base44.entities.InvoiceTemplate.filter({ is_active: true }) });

  const accessibleTeams = isAdmin ? allTeams : allTeams.filter(t => t.coach_email === user?.email);

  const [selectedTeamId, setSelectedTeamId] = useState(defaultTeamId || "");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(defaultPlayerId ? [defaultPlayerId] : []);
  const [sportId, setSportId] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [lineItems, setLineItems] = useState([{ ...emptyLine }]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: teamPlayers = [] } = useQuery({
    queryKey: ["players", "team", selectedTeamId],
    queryFn: () => base44.entities.Player.filter({ team_id: selectedTeamId, is_active: true }),
    enabled: !!selectedTeamId,
  });

  // Auto-set sport from team
  useEffect(() => {
    if (selectedTeamId) {
      const team = accessibleTeams.find(t => t.id === selectedTeamId);
      if (team?.sport_id) setSportId(team.sport_id);
    }
  }, [selectedTeamId]);

  // Reset when opened fresh
  useEffect(() => {
    if (open) {
      setSelectedTeamId(defaultTeamId || "");
      setSelectedPlayerIds(defaultPlayerId ? [defaultPlayerId] : []);
      setSportId("");
      setForm({ ...emptyForm });
      setLineItems([{ ...emptyLine }]);
      setHasChanges(false);
    }
  }, [open]);

  const markChanged = () => setHasChanges(true);

  const handleClose = () => {
    if (hasChanges && !window.confirm("You have unsaved changes. Close anyway?")) return;
    onClose();
  };

  const selectAllTeam = () => {
    setSelectedPlayerIds(teamPlayers.map(p => p.id));
    markChanged();
  };

  const togglePlayer = (pid) => {
    setSelectedPlayerIds(prev => prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]);
    markChanged();
  };

  const updateLine = (i, field, val) => {
    setLineItems(items => items.map((li, idx) => idx === i ? { ...li, [field]: val } : li));
    markChanged();
  };

  const loadTemplate = (tpl) => {
    setForm(f => ({
      ...f,
      description: tpl.description || f.description,
      fee_type: tpl.fee_type || f.fee_type,
      notes: tpl.notes || f.notes,
      discount_note: tpl.discount_note || f.discount_note,
    }));
    if (tpl.line_items) {
      try {
        const lines = JSON.parse(tpl.line_items).map(li => ({
          ...li, unit_amount: (li.unit_amount / 100).toString()
        }));
        setLineItems(lines.length > 0 ? lines : [{ ...emptyLine }]);
      } catch {}
    }
    if (tpl.sport_id && isAdmin) setSportId(tpl.sport_id);
    setShowTemplates(false);
    markChanged();
  };

  const lineTotal = lineItems.reduce((s, li) => s + (parseFloat(li.unit_amount || 0) * (parseInt(li.quantity) || 1)), 0);
  const discount = parseFloat(form.discount_amount || 0);
  const credit = parseFloat(form.credit_amount || 0);
  const grandTotal = Math.max(0, lineTotal - discount - credit);

  const selectedSport = sports.find(s => s.id === sportId);
  const selectedTeam = accessibleTeams.find(t => t.id === selectedTeamId);

  const saveMutation = useMutation({
    mutationFn: async ({ asDraft }) => {
      const sport = selectedSport;
      const accountingCode = sport?.name?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "";
      const totalCents = Math.round(grandTotal * 100);
      const linesCents = lineItems.filter(li => li.name && li.unit_amount).map(li => ({
        name: li.name,
        quantity: parseInt(li.quantity) || 1,
        unit_amount: Math.round(parseFloat(li.unit_amount) * 100),
      }));

      const base = {
        description: form.description,
        fee_type: form.fee_type,
        notes: form.notes,
        due_date: form.due_date,
        amount: totalCents,
        discount_amount: Math.round(parseFloat(form.discount_amount || 0) * 100),
        credit_amount: Math.round(parseFloat(form.credit_amount || 0) * 100),
        discount_note: form.discount_note,
        line_items: JSON.stringify(linesCents),
        sport_id: sportId,
        sport_name: sport?.name || "",
        accounting_code: accountingCode,
        team_name: selectedTeam?.name || "",
        status: asDraft ? "draft" : "pending",
        sent_at: asDraft ? null : new Date().toISOString(),
        paid_amount: 0,
        created_by_email: user?.email,
        created_by_name: user?.full_name || user?.email,
      };

      return Promise.all(selectedPlayerIds.map(pid => {
        const player = teamPlayers.find(p => p.id === pid);
        return base44.entities.Payment.create({
          ...base,
          player_id: pid,
          player_name: player ? `${player.first_name} ${player.last_name}` : "",
          parent_email: player?.parent_email || "",
        });
      }));
    },
    onSuccess: (_, { asDraft }) => {
      logAction({
        action: asDraft ? "invoice_draft_saved" : "invoice_created",
        category: "payment",
        description: `${asDraft ? "Saved draft" : "Created"} invoice "${form.description}" [${selectedSport?.name || ""}] for ${selectedPlayerIds.length} player(s)`,
        target_entity: "Payment",
        target_name: form.description,
        metadata: { sport_id: sportId, sport_name: selectedSport?.name, team: selectedTeam?.name },
      });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setHasChanges(false);
      onSaved();
    },
  });

  const handleSubmit = (asDraft) => {
    if (selectedPlayerIds.length === 0) return alert("Select at least one player.");
    if (!form.due_date) return alert("Due date is required.");
    if (!sportId) return alert("Please select a Deposit Account (sport).");
    if (lineItems.filter(li => li.name && li.unit_amount).length === 0) return alert("Add at least one line item.");
    saveMutation.mutate({ asDraft });
  };

  const selectableSports = isAdmin ? sports : sports.filter(s => s.id === selectedTeam?.sport_id);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl bg-card border-border text-foreground overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-xl">New Invoice</SheetTitle>
            {templates.length > 0 && (
              <button onClick={() => setShowTemplates(!showTemplates)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">
                <FileText className="w-3.5 h-3.5" /> Templates
                {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Template picker */}
          {showTemplates && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-2 space-y-1">
              {templates.map(tpl => (
                <button key={tpl.id} onClick={() => loadTemplate(tpl)}
                  className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-card text-left transition-colors group">
                  <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary">{tpl.name}</p>
                    {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Team Selection */}
          <div className="space-y-1.5">
            <Label>Team *</Label>
            <select value={selectedTeamId} onChange={e => { setSelectedTeamId(e.target.value); setSelectedPlayerIds([]); markChanged(); }} required
              className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Select a team…</option>
              {accessibleTeams.map(t => (
                <option key={t.id} value={t.id}>{t.sport_name ? `${t.sport_name} — ` : ""}{t.name}</option>
              ))}
            </select>
          </div>

          {/* Player Selection */}
          {selectedTeamId && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Players *</Label>
                {teamPlayers.length > 1 && (
                  <button type="button" onClick={selectAllTeam}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <Users className="w-3 h-3" /> Select All ({teamPlayers.length})
                  </button>
                )}
              </div>
              <div className="rounded-lg border border-input bg-surface max-h-40 overflow-y-auto p-2 space-y-0.5">
                {teamPlayers.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-2">No active players on this team.</p>
                ) : teamPlayers.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-card cursor-pointer">
                    <input type="checkbox" checked={selectedPlayerIds.includes(p.id)}
                      onChange={() => togglePlayer(p.id)} />
                    <span className="text-sm text-foreground">{p.first_name} {p.last_name}</span>
                    {p.jersey_number && <span className="text-xs text-muted-foreground ml-auto">#{p.jersey_number}</span>}
                  </label>
                ))}
              </div>
              {selectedPlayerIds.length > 0 && (
                <p className="text-xs text-primary">{selectedPlayerIds.length} player{selectedPlayerIds.length !== 1 ? "s" : ""} selected</p>
              )}
            </div>
          )}

          {/* Deposit Account */}
          <div className="space-y-1.5">
            <Label>Deposit Account (Sport) *
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">— internal only</span>
            </Label>
            <select value={sportId} onChange={e => { setSportId(e.target.value); markChanged(); }} required
              className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Select a sport / account…</option>
              {selectableSports.map(s => (
                <option key={s.id} value={s.id}>{s.icon ? `${s.icon} ` : ""}{s.name}</option>
              ))}
            </select>
          </div>

          {/* Description & Fee Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Description *</Label>
              <Input value={form.description}
                onChange={e => { setForm(f => ({ ...f, description: e.target.value })); markChanged(); }}
                placeholder="e.g. Spring Registration Fee" className="bg-surface border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label>Fee Type</Label>
              <select value={form.fee_type} onChange={e => { setForm(f => ({ ...f, fee_type: e.target.value })); markChanged(); }}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {FEE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={form.due_date}
                onChange={e => { setForm(f => ({ ...f, due_date: e.target.value })); markChanged(); }}
                className="bg-surface border-border" required />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <button type="button" onClick={() => { setLineItems(li => [...li, { ...emptyLine }]); markChanged(); }}
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2 space-y-2">
              <div className="grid grid-cols-[1fr_48px_80px_24px] gap-2 text-xs text-muted-foreground px-1 mb-1">
                <span>Name</span><span className="text-center">Qty</span><span className="text-right">Unit $</span><span />
              </div>
              {lineItems.map((li, i) => (
                <div key={i} className="grid grid-cols-[1fr_48px_80px_24px] gap-2 items-center">
                  <Input value={li.name} onChange={e => updateLine(i, "name", e.target.value)}
                    placeholder="Item name" className="bg-card border-border h-8 text-sm" />
                  <Input type="number" min="1" value={li.quantity} onChange={e => updateLine(i, "quantity", e.target.value)}
                    className="bg-card border-border h-8 text-sm text-center" />
                  <Input type="number" step="0.01" min="0" value={li.unit_amount}
                    onChange={e => updateLine(i, "unit_amount", e.target.value)}
                    placeholder="0.00" className="bg-card border-border h-8 text-sm text-right" />
                  {lineItems.length > 1 ? (
                    <button type="button" onClick={() => { setLineItems(li => li.filter((_, idx) => idx !== i)); markChanged(); }}
                      className="text-muted-foreground hover:text-red-400 flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>

          {/* Discounts & Credits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Discount ($)</Label>
              <Input type="number" step="0.01" min="0" value={form.discount_amount}
                onChange={e => { setForm(f => ({ ...f, discount_amount: e.target.value })); markChanged(); }}
                placeholder="0.00" className="bg-surface border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Credit ($)</Label>
              <Input type="number" step="0.01" min="0" value={form.credit_amount}
                onChange={e => { setForm(f => ({ ...f, credit_amount: e.target.value })); markChanged(); }}
                placeholder="0.00" className="bg-surface border-border" />
            </div>
            {(discount > 0 || credit > 0) && (
              <div className="col-span-2 space-y-1.5">
                <Label>Credit / Discount Note</Label>
                <Input value={form.discount_note}
                  onChange={e => { setForm(f => ({ ...f, discount_note: e.target.value })); markChanged(); }}
                  placeholder="e.g. Volunteer hours, scholarship" className="bg-surface border-border" />
              </div>
            )}
          </div>

          {/* Live Total */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
            <div>
              <span className="text-sm text-muted-foreground">
                Invoice Total{selectedPlayerIds.length > 1 ? ` × ${selectedPlayerIds.length} players` : ""}
              </span>
              {selectedSport && (
                <span className="ml-2 text-xs font-mono bg-surface px-1.5 py-0.5 rounded text-muted-foreground">
                  {selectedSport.name?.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)}
                </span>
              )}
            </div>
            <span className="text-2xl font-bold text-primary">
              ${(grandTotal * (selectedPlayerIds.length || 1)).toFixed(2)}
            </span>
          </div>

          {/* Parent Notes */}
          <div className="space-y-1.5">
            <Label>Parent-Visible Notes</Label>
            <Input value={form.notes}
              onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); markChanged(); }}
              placeholder="e.g. Covers spring tournament at Riverside Park" className="bg-surface border-border" />
          </div>

          <div className="h-4" />
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={handleClose} className="border-border">Cancel</Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleSubmit(true)}
              disabled={saveMutation.isPending}
              className="border-border text-muted-foreground hover:text-foreground gap-2">
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? "Saving…" : "Save Draft"}
            </Button>
            <Button onClick={() => handleSubmit(false)}
              disabled={saveMutation.isPending}
              className="bg-primary text-primary-foreground gap-2">
              <Send className="w-4 h-4" />
              {saveMutation.isPending ? "Sending…" : `Send${selectedPlayerIds.length > 1 ? ` (${selectedPlayerIds.length})` : ""}`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}