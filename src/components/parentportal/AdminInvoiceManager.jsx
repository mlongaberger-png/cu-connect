import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, DollarSign, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

const emptyForm = { description: "", notes: "", amount: "", due_date: "" };

export default function AdminInvoiceManager({ players, teamName }) {
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const queryClient = useQueryClient();

  const playerIds = players.map(p => p.id);

  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments", "admin", teamName],
    queryFn: () => base44.entities.Payment.list(),
    enabled: players.length > 0,
  });

  const teamPayments = allPayments.filter(p => playerIds.includes(p.player_id));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Payment.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["payments"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Payment.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["payments"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingInvoice(null);
    setForm(emptyForm);
    setSelectedPlayerId("");
  };

  const handleEdit = (invoice) => {
    setEditingInvoice(invoice);
    setSelectedPlayerId(invoice.player_id);
    setForm({
      description: invoice.description || "",
      notes: invoice.notes || "",
      amount: invoice.amount ? (invoice.amount / 100).toString() : "",
      due_date: invoice.due_date || "",
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const player = players.find(p => p.id === selectedPlayerId);
    const payload = {
      player_id: selectedPlayerId,
      player_name: player ? `${player.first_name} ${player.last_name}` : "",
      team_name: teamName,
      parent_email: player?.parent_email || "",
      description: form.description,
      notes: form.notes,
      amount: Math.round(parseFloat(form.amount) * 100),
      due_date: form.due_date,
      status: "pending",
    };
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Invoices</h3>
        <Button size="sm" onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-1" /> Add Invoice
        </Button>
      </div>

      {teamPayments.length === 0 ? (
        <div className="p-8 text-center">
          <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">No invoices created yet</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {teamPayments.map(inv => (
            <div key={inv.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{inv.description}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground">{inv.player_name}</span>
                  {inv.due_date && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" /> Due {format(new Date(inv.due_date + "T00:00:00"), "MMM d, yyyy")}
                    </span>
                  )}
                  {inv.notes && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="w-3 h-3" /> {inv.notes}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-primary font-bold">${(inv.amount / 100).toFixed(2)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${inv.status === "paid" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{inv.status}</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(inv)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => deleteMutation.mutate(inv.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>{editingInvoice ? "Edit Invoice" : "Add Invoice"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Player</Label>
              <select
                value={selectedPlayerId}
                onChange={e => setSelectedPlayerId(e.target.value)}
                required
                disabled={!!editingInvoice}
                className="flex h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Select a player...</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Description (Why)</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Registration Fee, Tournament Entry..." className="bg-surface border-border" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="bg-surface border-border" required />
              </div>
              <div>
                <Label>Due Date (When)</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="bg-surface border-border" />
              </div>
            </div>
            <div>
              <Label>Notes (Where / Additional Context)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Spring tournament at City Park..." className="bg-surface border-border" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">{editingInvoice ? "Save Changes" : "Add Invoice"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}