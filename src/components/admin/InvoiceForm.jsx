import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/lib/AuthContext";

const FEE_TYPES = ["registration", "uniforms", "tournament", "fundraising", "other"];
const emptyLine = { name: "", quantity: 1, unit_amount: "" };

export default function InvoiceForm({ players, teamName, editingInvoice, onClose, onSaved }) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();

  const [selectedPlayerIds, setSelectedPlayerIds] = useState(
    editingInvoice ? [editingInvoice.player_id] : []
  );

  const [form, setForm] = useState({
    description: editingInvoice?.description || "",
    fee_type: editingInvoice?.fee_type || "other",
    notes: editingInvoice?.notes || "",
    due_date: editingInvoice?.due_date || "",
    discount_amount: editingInvoice?.discount_amount ? (editingInvoice.discount_amount / 100).toString() : "",
    credit_amount: editingInvoice?.credit_amount ? (editingInvoice.credit_amount / 100).toString() : "",
    discount_note: editingInvoice?.discount_note || "",
  });

  const [lineItems, setLineItems] = useState(() => {
    if (editingInvoice?.line_items) {
      try {
        return JSON.parse(editingInvoice.line_items).map(li => ({
          ...li, unit_amount: (li.unit_amount / 100).toString()
        }));
      } catch {}
    }
    // If no line items, pre-fill from amount/description
    if (editingInvoice?.amount) {
      return [{ name: editingInvoice.description || "", quantity: 1, unit_amount: (editingInvoice.amount / 100).toString() }];
    }
    return [{ ...emptyLine }];
  });

  const lineTotal = lineItems.reduce((s, li) =>
    s + (parseFloat(li.unit_amount || 0) * (parseInt(li.quantity) || 1)), 0);
  const discount = parseFloat(form.discount_amount || 0);
  const credit = parseFloat(form.credit_amount || 0);
  const grandTotal = Math.max(0, lineTotal - discount - credit);

  const updateLine = (i, field, val) =>
    setLineItems(items => items.map((li, idx) => idx === i ? { ...li, [field]: val } : li));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const totalCents = Math.round(grandTotal * 100);
      const linesCents = lineItems
        .filter(li => li.name && li.unit_amount)
        .map(li => ({
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
        status: "pending",
        created_by_email: user?.email,
        created_by_name: user?.full_name || user?.email,
      };

      if (editingInvoice) {
        await base44.entities.Payment.update(editingInvoice.id, base);
        return [editingInvoice.id];
      }

      const created = await Promise.all(
        selectedPlayerIds.map(pid => {
          const player = players.find(p => p.id === pid);
          return base44.entities.Payment.create({
            ...base,
            player_id: pid,
            player_name: player ? `${player.first_name} ${player.last_name}` : "",
            team_name: teamName,
            parent_email: player?.parent_email || "",
            paid_amount: 0,
          });
        })
      );
      return created.map(c => c.id);
    },
    onSuccess: (ids) => {
      logAction({
        action: editingInvoice ? "invoice_updated" : "invoice_created",
        category: "payment",
        description: `${editingInvoice ? "Updated" : "Created"} invoice "${form.description}" for ${selectedPlayerIds.length} player(s)`,
        target_entity: "Payment",
        target_id: ids[0],
        target_name: form.description,
      });
      onSaved();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingInvoice && selectedPlayerIds.length === 0) return alert("Select at least one player.");
    if (!form.due_date) return alert("Due date is required.");
    if (lineItems.filter(li => li.name && li.unit_amount).length === 0) return alert("Add at least one line item.");
    saveMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingInvoice ? "Edit Invoice" : "New Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Player Selection */}
          <div className="space-y-1.5">
            <Label>{editingInvoice ? "Player" : "Players"}</Label>
            {editingInvoice ? (
              <div className="px-3 py-2 rounded-md bg-surface border border-border text-sm text-foreground">
                {players.find(p => p.id === selectedPlayerIds[0])?.first_name}{" "}
                {players.find(p => p.id === selectedPlayerIds[0])?.last_name}
              </div>
            ) : (
              <div className="rounded-lg border border-input bg-surface max-h-36 overflow-y-auto p-2 space-y-0.5">
                {players.map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-card cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(p.id)}
                      onChange={e => setSelectedPlayerIds(prev =>
                        e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                      )}
                    />
                    <span className="text-sm text-foreground">{p.first_name} {p.last_name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{p.team_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Description + Fee Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Description *</Label>
              <Input value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Spring Registration Fee" className="bg-surface border-border" required />
            </div>
            <div className="space-y-1.5">
              <Label>Fee Type</Label>
              <select value={form.fee_type}
                onChange={e => setForm(f => ({ ...f, fee_type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {FEE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date *</Label>
              <Input type="date" value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="bg-surface border-border" required />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items *</Label>
              <button type="button" onClick={() => setLineItems(li => [...li, { ...emptyLine }])}
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
                  <Input type="number" min="1" value={li.quantity}
                    onChange={e => updateLine(i, "quantity", e.target.value)}
                    className="bg-card border-border h-8 text-sm text-center" />
                  <Input type="number" step="0.01" min="0" value={li.unit_amount}
                    onChange={e => updateLine(i, "unit_amount", e.target.value)}
                    placeholder="0.00" className="bg-card border-border h-8 text-sm text-right" />
                  {lineItems.length > 1 ? (
                    <button type="button" onClick={() => setLineItems(li => li.filter((_, idx) => idx !== i))}
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
                onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))}
                placeholder="0.00" className="bg-surface border-border" />
            </div>
            <div className="space-y-1.5">
              <Label>Credit ($)</Label>
              <Input type="number" step="0.01" min="0" value={form.credit_amount}
                onChange={e => setForm(f => ({ ...f, credit_amount: e.target.value }))}
                placeholder="0.00" className="bg-surface border-border" />
            </div>
            {(discount > 0 || credit > 0) && (
              <div className="col-span-2 space-y-1.5">
                <Label>Credit / Discount Note</Label>
                <Input value={form.discount_note}
                  onChange={e => setForm(f => ({ ...f, discount_note: e.target.value }))}
                  placeholder="e.g. Volunteer hours, scholarship" className="bg-surface border-border" />
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm text-muted-foreground">
              Invoice Total{selectedPlayerIds.length > 1 ? ` × ${selectedPlayerIds.length} players` : ""}
            </span>
            <span className="text-lg font-bold text-primary">
              ${(grandTotal * (editingInvoice ? 1 : selectedPlayerIds.length || 1)).toFixed(2)}
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Parent-Visible Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Covers spring tournament at Riverside Park" className="bg-surface border-border" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-border">Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending} className="bg-primary text-primary-foreground">
              {saveMutation.isPending
                ? "Saving..."
                : editingInvoice
                  ? "Save Changes"
                  : `Create${selectedPlayerIds.length > 1 ? ` ${selectedPlayerIds.length} Invoices` : " Invoice"}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}