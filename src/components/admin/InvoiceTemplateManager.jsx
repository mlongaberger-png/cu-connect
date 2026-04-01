import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const FEE_TYPES = ["registration", "uniforms", "tournament", "fundraising", "other"];
const emptyLine = { name: "", quantity: 1, unit_amount: "" };
const emptyForm = { name: "", description: "", fee_type: "other", notes: "", discount_note: "" };

export default function InvoiceTemplateManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [lineItems, setLineItems] = useState([{ ...emptyLine }]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: () => base44.entities.InvoiceTemplate.list("-created_date"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const linesCents = lineItems.filter(li => li.name && li.unit_amount).map(li => ({
        name: li.name,
        quantity: parseInt(li.quantity) || 1,
        unit_amount: Math.round(parseFloat(li.unit_amount) * 100),
      }));
      const payload = {
        ...form,
        line_items: JSON.stringify(linesCents),
        created_by_email: user?.email,
        created_by_name: user?.full_name || user?.email,
        is_active: true,
      };
      if (editing) return base44.entities.InvoiceTemplate.update(editing.id, payload);
      return base44.entities.InvoiceTemplate.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InvoiceTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice-templates"] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setLineItems([{ ...emptyLine }]);
    setShowForm(true);
  };

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({ name: tpl.name, description: tpl.description || "", fee_type: tpl.fee_type || "other", notes: tpl.notes || "", discount_note: tpl.discount_note || "" });
    try {
      const lines = JSON.parse(tpl.line_items || "[]").map(li => ({ ...li, unit_amount: (li.unit_amount / 100).toString() }));
      setLineItems(lines.length > 0 ? lines : [{ ...emptyLine }]);
    } catch { setLineItems([{ ...emptyLine }]); }
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const updateLine = (i, field, val) =>
    setLineItems(items => items.map((li, idx) => idx === i ? { ...li, [field]: val } : li));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Invoice Templates</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Reusable templates to speed up invoice creation</p>
        </div>
        <Button size="sm" onClick={openCreate} className="bg-primary text-primary-foreground gap-1.5">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-xl border border-border">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No templates yet. Create one to speed up invoice creation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => {
            const lines = (() => { try { return JSON.parse(tpl.line_items || "[]"); } catch { return []; } })();
            const total = lines.reduce((s, li) => s + (li.unit_amount || 0) * (li.quantity || 1), 0);
            return (
              <div key={tpl.id} className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{tpl.name}</p>
                      {tpl.fee_type && <p className="text-xs text-muted-foreground capitalize">{tpl.fee_type}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(tpl)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete template "${tpl.name}"?`)) deleteMutation.mutate(tpl.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
                {lines.length > 0 && (
                  <div className="space-y-1">
                    {lines.slice(0, 3).map((li, i) => (
                      <div key={i} className="flex justify-between text-xs text-muted-foreground">
                        <span>{li.name} × {li.quantity}</span>
                        <span>${(li.unit_amount / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    {lines.length > 3 && <p className="text-xs text-muted-foreground">+{lines.length - 3} more items</p>}
                    <div className="pt-1 border-t border-border/50 flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Default Total</span>
                      <span className="text-primary">${(total / 100).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => { if (!o) closeForm(); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Spring Registration" className="bg-surface border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label>Default Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Spring Season Registration Fee" className="bg-surface border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Fee Type</Label>
              <select value={form.fee_type} onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {FEE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Default Line Items</Label>
                <button type="button" onClick={() => setLineItems(li => [...li, { ...emptyLine }])}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2 space-y-2">
                <div className="grid grid-cols-[1fr_48px_80px_24px] gap-2 text-xs text-muted-foreground px-1 mb-1">
                  <span>Name</span><span className="text-center">Qty</span><span className="text-right">Unit $</span><span />
                </div>
                {lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-[1fr_48px_80px_24px] gap-2 items-center">
                    <Input value={li.name} onChange={e => updateLine(i, "name", e.target.value)}
                      placeholder="Item" className="bg-card border-border h-8 text-sm" />
                    <Input type="number" min="1" value={li.quantity} onChange={e => updateLine(i, "quantity", e.target.value)}
                      className="bg-card border-border h-8 text-sm text-center" />
                    <Input type="number" step="0.01" min="0" value={li.unit_amount}
                      onChange={e => updateLine(i, "unit_amount", e.target.value)}
                      placeholder="0.00" className="bg-card border-border h-8 text-sm text-right" />
                    {lineItems.length > 1 ? (
                      <button type="button" onClick={() => setLineItems(li => li.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    ) : <span />}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Default Notes (parent-visible)</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Covers spring tournament entry" className="bg-surface border-border" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancel</Button>
              <Button onClick={() => { if (!form.name) return alert("Template name is required."); saveMutation.mutate(); }}
                disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}