import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Clock, Download } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import InvoiceForm from "@/components/admin/InvoiceForm";

const STATUS_CONFIG = {
  pending:  { label: "Pending",  cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  overdue:  { label: "Overdue",  cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  partial:  { label: "Partial",  cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  paid:     { label: "Paid",     cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  voided:   { label: "Voided",   cls: "bg-muted text-muted-foreground border-border" },
  refunded: { label: "Refunded", cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

function getEffectiveStatus(inv) {
  if (["paid","voided","refunded"].includes(inv.status)) return inv.status;
  if (inv.due_date && isPast(parseISO(inv.due_date + "T23:59:59"))) return "overdue";
  if ((inv.paid_amount || 0) > 0 && (inv.paid_amount || 0) < (inv.amount || 0)) return "partial";
  return inv.status || "pending";
}

function downloadCSV(filename, rows, headers) {
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_TABS = ["all","pending","overdue","partial","paid","voided","refunded"];

export default function AdminInvoiceManager({ players, teamName, teamSportId, teamSportName }) {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSport, setFilterSport] = useState("all");
  const [sendingReminder, setSendingReminder] = useState(null);

  const canEdit   = ["admin","athletic_director"].includes(user?.role);
  const canCreate = ["admin","athletic_director","coach"].includes(user?.role);

  const playerIds = players.map(p => p.id);

  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ["payments", "admin", teamName],
    queryFn: () => base44.entities.Payment.list("-created_date"),
    enabled: players.length > 0,
  });

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const teamPayments = allPayments.filter(p => playerIds.includes(p.player_id));

  // Unique sports present in this team's invoices
  const invoiceSports = [...new Map(
    teamPayments.filter(p => p.sport_id).map(p => [p.sport_id, { id: p.sport_id, name: p.sport_name }])
  ).values()];

  const displayed = teamPayments.filter(inv => {
    const statusMatch = filterStatus === "all" || getEffectiveStatus(inv) === filterStatus;
    const sportMatch  = filterSport  === "all" || inv.sport_id === filterSport;
    return statusMatch && sportMatch;
  });

  // Per-sport totals
  const sportTotals = {};
  teamPayments.filter(p => p.status !== "voided").forEach(inv => {
    const key = inv.sport_name || "Unknown";
    if (!sportTotals[key]) sportTotals[key] = { invoiced: 0, collected: 0 };
    sportTotals[key].invoiced += inv.amount || 0;
    if (inv.status === "paid") sportTotals[key].collected += inv.amount || 0;
  });

  const totals = {
    invoiced:    teamPayments.filter(i => i.status !== "voided").reduce((s, i) => s + (i.amount || 0), 0),
    collected:   teamPayments.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
    outstanding: teamPayments.filter(i => !["paid","voided","refunded"].includes(i.status))
                             .reduce((s, i) => s + ((i.amount || 0) - (i.paid_amount || 0)), 0),
  };

  const voidMutation = useMutation({
    mutationFn: (inv) => base44.entities.Payment.update(inv.id, {
      status: "voided", voided_by: user?.email, voided_at: new Date().toISOString(),
    }),
    onSuccess: (_, inv) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      logAction({ action: "invoice_voided", category: "payment", description: `Voided: ${inv.description}`, target_entity: "Payment", target_id: inv.id, target_name: inv.description });
    },
  });

  const refundMutation = useMutation({
    mutationFn: (inv) => base44.entities.Payment.update(inv.id, {
      status: "refunded", refunded_by: user?.email, refunded_at: new Date().toISOString(),
    }),
    onSuccess: (_, inv) => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      logAction({ action: "invoice_refunded", category: "payment", description: `Refunded: ${inv.description}`, target_entity: "Payment", target_id: inv.id, target_name: inv.description });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const handleReminder = async (inv) => {
    setSendingReminder(inv.id);
    await base44.functions.invoke("sendInvoiceReminder", { invoice_id: inv.id });
    setSendingReminder(null);
  };

  const handleExport = () => {
    const rows = displayed.map(inv => ({
      player_name:      inv.player_name,
      team_name:        inv.team_name,
      sport_name:       inv.sport_name || "",
      accounting_code:  inv.accounting_code || "",
      description:      inv.description,
      fee_type:         inv.fee_type || "",
      amount:           `$${(inv.amount / 100).toFixed(2)}`,
      paid_amount:      `$${((inv.paid_amount || 0) / 100).toFixed(2)}`,
      status:           getEffectiveStatus(inv),
      due_date:         inv.due_date || "",
      parent_email:     inv.parent_email || "",
      created_by:       inv.created_by_email || "",
    }));
    downloadCSV(
      `invoices_${teamName}_${new Date().toISOString().split("T")[0]}.csv`,
      rows,
      ["player_name","team_name","sport_name","accounting_code","description","fee_type","amount","paid_amount","status","due_date","parent_email","created_by"]
    );
  };

  const openEdit = (inv) => { setEditingInvoice(inv); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingInvoice(null); };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Invoices</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            {canCreate && (
              <Button size="sm" onClick={() => { setEditingInvoice(null); setShowForm(true); }}
                className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> New Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Summary totals */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Invoiced",    val: totals.invoiced,    cls: "text-foreground" },
            { label: "Collected",   val: totals.collected,   cls: "text-green-400" },
            { label: "Outstanding", val: totals.outstanding, cls: "text-primary" },
          ].map(s => (
            <div key={s.label} className="bg-surface rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">{s.label}</p>
              <p className={`text-sm font-bold ${s.cls}`}>${(s.val / 100).toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Per-sport totals */}
        {Object.keys(sportTotals).length > 1 && (
          <div className="mb-4 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Sport / Account</p>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(sportTotals).map(([sportName, st]) => (
                <div key={sportName} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-foreground font-medium">{sportName}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">Invoiced: <span className="text-foreground">${(st.invoiced / 100).toFixed(2)}</span></span>
                    <span className="text-muted-foreground">Collected: <span className="text-green-400">${(st.collected / 100).toFixed(2)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {/* Sport filter */}
          {invoiceSports.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              <button onClick={() => setFilterSport("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterSport === "all" ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                All Sports
              </button>
              {invoiceSports.map(s => (
                <button key={s.id} onClick={() => setFilterSport(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${filterSport === s.id ? "bg-primary/20 text-primary" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Status filter */}
          <div className="flex gap-1 overflow-x-auto">
            {STATUS_TABS.map(t => (
              <button key={t} onClick={() => setFilterStatus(t)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${filterStatus === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice list */}
      {isLoading ? (
        <div className="p-10 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="p-10 text-center">
          <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {displayed.map(inv => {
            const eff = getEffectiveStatus(inv);
            const sc = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
            const balance = (inv.amount || 0) - (inv.paid_amount || 0);
            const isOverdue = eff === "overdue";
            const lineItems = (() => { try { return JSON.parse(inv.line_items || "[]"); } catch { return []; } })();

            return (
              <div key={inv.id} className={`p-4 ${isOverdue ? "bg-red-500/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-foreground text-sm">{inv.description}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.cls}`}>{sc.label}</span>
                      {inv.fee_type && inv.fee_type !== "other" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground capitalize">{inv.fee_type}</span>
                      )}
                      {/* Sport / accounting badge — admin-only */}
                      {inv.sport_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">
                          {inv.accounting_code || inv.sport_name}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mb-1.5">{inv.player_name}</p>
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      {inv.due_date && (
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400 font-semibold" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          Due {format(parseISO(inv.due_date + "T00:00:00"), "MMM d, yyyy")}
                          {isOverdue && " · PAST DUE"}
                        </span>
                      )}
                      {inv.notes && <span className="text-muted-foreground">{inv.notes}</span>}
                    </div>

                    {lineItems.length > 0 && (
                      <div className="mt-2 bg-surface rounded-lg p-2 space-y-1">
                        {lineItems.map((li, i) => (
                          <div key={i} className="flex justify-between text-xs text-muted-foreground">
                            <span>{li.name} × {li.quantity}</span>
                            <span>${((li.unit_amount || 0) / 100).toFixed(2)}</span>
                          </div>
                        ))}
                        {(inv.discount_amount > 0 || inv.credit_amount > 0) && (
                          <div className="border-t border-border/50 pt-1 mt-1 space-y-0.5">
                            {inv.discount_amount > 0 && (
                              <div className="flex justify-between text-xs text-green-400">
                                <span>Discount{inv.discount_note ? ` (${inv.discount_note})` : ""}</span>
                                <span>-${(inv.discount_amount / 100).toFixed(2)}</span>
                              </div>
                            )}
                            {inv.credit_amount > 0 && (
                              <div className="flex justify-between text-xs text-blue-400">
                                <span>Credit</span>
                                <span>-${(inv.credit_amount / 100).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-sm font-bold text-primary">${(inv.amount / 100).toFixed(2)}</p>
                    {(inv.paid_amount || 0) > 0 && inv.status !== "paid" && (
                      <p className="text-xs text-green-400">Paid ${(inv.paid_amount / 100).toFixed(2)}</p>
                    )}
                    {balance > 0 && !["paid","voided","refunded"].includes(inv.status) && (
                      <p className="text-xs text-red-400">Owed ${(balance / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>

                {canEdit && !["voided","refunded"].includes(inv.status) && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/40">
                    {inv.status !== "paid" && (
                      <button onClick={() => openEdit(inv)}
                        className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        Edit
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Void invoice "${inv.description}"?`)) voidMutation.mutate(inv); }}
                      className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                      Void
                    </button>
                    {inv.status === "paid" && (
                      <button onClick={() => { if (confirm(`Refund "${inv.description}"?`)) refundMutation.mutate(inv); }}
                        className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-colors">
                        Refund
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Permanently delete this invoice?`)) deleteMutation.mutate(inv.id); }}
                      className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                    {!["paid","voided"].includes(inv.status) && (
                      <button onClick={() => handleReminder(inv)} disabled={sendingReminder === inv.id}
                        className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors ml-auto disabled:opacity-50">
                        {sendingReminder === inv.id ? "Sending…" : "Send Reminder"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <InvoiceForm
          players={players}
          teamName={teamName}
          teamSportId={teamSportId}
          teamSportName={teamSportName}
          editingInvoice={editingInvoice}
          onClose={closeForm}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["payments"] });
            closeForm();
          }}
        />
      )}
    </div>
  );
}