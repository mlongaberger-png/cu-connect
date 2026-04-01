import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, Clock, Download, TrendingUp, Send, FileText, Pencil } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { useAuth } from "@/lib/AuthContext";
import { useAuditLog } from "@/hooks/useAuditLog";
import InvoiceDrawer from "@/components/admin/InvoiceDrawer";
import InvoiceForm from "@/components/admin/InvoiceForm";
import InvoiceTemplateManager from "@/components/admin/InvoiceTemplateManager";

const STATUS_CONFIG = {
  draft:    { label: "Draft",    cls: "bg-surface text-muted-foreground border-border" },
  pending:  { label: "Pending",  cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  overdue:  { label: "Overdue",  cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  partial:  { label: "Partial",  cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  paid:     { label: "Paid",     cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  voided:   { label: "Voided",   cls: "bg-muted text-muted-foreground border-border" },
  refunded: { label: "Refunded", cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

function getEffectiveStatus(inv) {
  if (["draft","paid","voided","refunded"].includes(inv.status)) return inv.status;
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

const STATUS_TABS = ["all", "draft", "pending", "overdue", "partial", "paid", "voided", "refunded"];

export default function AdminFinanceConsole() {
  const { user } = useAuth();
  const { logAction } = useAuditLog();
  const queryClient = useQueryClient();
  const isAdmin = ["admin", "athletic_director"].includes(user?.role);

  const [showDrawer, setShowDrawer] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTeam, setFilterTeam] = useState("all");
  const [filterSport, setFilterSport] = useState("all");
  const [activeSubTab, setActiveSubTab] = useState("invoices");
  const [sendingReminder, setSendingReminder] = useState(null);
  const [sendingDraft, setSendingDraft] = useState(null);

  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ["payments", "finance-console"],
    queryFn: () => base44.entities.Payment.list("-created_date"),
  });

  const { data: allTeams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });

  // Scope: coaches only see their teams
  const accessibleTeams = isAdmin ? allTeams : allTeams.filter(t => t.coach_email === user?.email);
  const accessiblePlayerIds = new Set(allPlayers.filter(p => accessibleTeams.some(t => t.id === p.team_id)).map(p => p.id));
  const scopedPayments = isAdmin ? allPayments : allPayments.filter(p => accessiblePlayerIds.has(p.player_id));

  // Unique sports/teams in scope
  const presentSports = [...new Map(scopedPayments.filter(p => p.sport_id).map(p => [p.sport_id, { id: p.sport_id, name: p.sport_name }])).values()];
  const presentTeams = [...new Map(scopedPayments.filter(p => p.team_name).map(p => [p.team_name, p.team_name])).values()];

  const displayed = scopedPayments.filter(inv => {
    const statusMatch = filterStatus === "all" || getEffectiveStatus(inv) === filterStatus;
    const teamMatch   = filterTeam   === "all" || inv.team_name === filterTeam;
    const sportMatch  = filterSport  === "all" || inv.sport_id === filterSport;
    return statusMatch && teamMatch && sportMatch;
  });

  // Sport totals (exclude draft + voided)
  const sportTotals = {};
  scopedPayments.filter(p => !["draft","voided"].includes(p.status)).forEach(inv => {
    const key = inv.sport_name || "Unknown";
    if (!sportTotals[key]) sportTotals[key] = { invoiced: 0, collected: 0, outstanding: 0 };
    sportTotals[key].invoiced += inv.amount || 0;
    if (inv.status === "paid") sportTotals[key].collected += inv.amount || 0;
    else sportTotals[key].outstanding += ((inv.amount || 0) - (inv.paid_amount || 0));
  });

  const globalTotals = {
    invoiced:    scopedPayments.filter(i => !["draft","voided"].includes(i.status)).reduce((s, i) => s + (i.amount || 0), 0),
    collected:   scopedPayments.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0),
    outstanding: scopedPayments.filter(i => !["draft","paid","voided","refunded"].includes(i.status)).reduce((s, i) => s + ((i.amount || 0) - (i.paid_amount || 0)), 0),
    drafts:      scopedPayments.filter(i => i.status === "draft").length,
  };

  const voidMutation = useMutation({
    mutationFn: (inv) => base44.entities.Payment.update(inv.id, { status: "voided", voided_by: user?.email, voided_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const refundMutation = useMutation({
    mutationFn: (inv) => base44.entities.Payment.update(inv.id, { status: "refunded", refunded_by: user?.email, refunded_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Payment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  const handleSendDraft = async (inv) => {
    setSendingDraft(inv.id);
    await base44.entities.Payment.update(inv.id, { status: "pending", sent_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    setSendingDraft(null);
  };

  const handleReminder = async (inv) => {
    setSendingReminder(inv.id);
    await base44.functions.invoke("sendInvoiceReminder", { invoice_id: inv.id });
    setSendingReminder(null);
  };

  const handleExport = () => {
    const rows = displayed.map(inv => ({
      player_name: inv.player_name, team_name: inv.team_name, sport_name: inv.sport_name || "",
      accounting_code: inv.accounting_code || "", description: inv.description, fee_type: inv.fee_type || "",
      amount: `$${(inv.amount / 100).toFixed(2)}`, paid_amount: `$${((inv.paid_amount || 0) / 100).toFixed(2)}`,
      status: getEffectiveStatus(inv), due_date: inv.due_date || "", parent_email: inv.parent_email || "",
    }));
    downloadCSV(`invoices_all_${new Date().toISOString().split("T")[0]}.csv`, rows,
      ["player_name","team_name","sport_name","accounting_code","description","fee_type","amount","paid_amount","status","due_date","parent_email"]);
  };

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex gap-1 w-fit">
        {[
          { id: "invoices", label: "Invoices" },
          { id: "templates", label: "Templates" },
        ].map(sub => (
          <button key={sub.id} onClick={() => setActiveSubTab(sub.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeSubTab === sub.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
            {sub.label}
          </button>
        ))}
      </div>

      {activeSubTab === "templates" && <InvoiceTemplateManager />}

      {activeSubTab === "invoices" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">All Invoices</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Across all teams{!isAdmin ? " (your teams only)" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExport}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              <Button size="sm" onClick={() => setShowDrawer(true)} className="bg-primary text-primary-foreground gap-1.5">
                <Plus className="w-4 h-4" /> Create Invoice
              </Button>
            </div>
          </div>

          {/* Global summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Invoiced",    val: globalTotals.invoiced,    cls: "text-foreground",   icon: DollarSign },
              { label: "Collected",   val: globalTotals.collected,   cls: "text-green-400",    icon: TrendingUp },
              { label: "Outstanding", val: globalTotals.outstanding, cls: "text-primary",      icon: Clock },
              { label: "Drafts",      val: null,                     cls: "text-muted-foreground", icon: FileText, count: globalTotals.drafts },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${s.cls}`} />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  </div>
                  <p className={`text-xl font-bold ${s.cls}`}>
                    {s.count !== undefined ? s.count : `$${(s.val / 100).toFixed(2)}`}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Per-sport breakdown */}
          {Object.keys(sportTotals).length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">By Sport / Account</p>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(sportTotals).map(([sportName, st]) => (
                  <div key={sportName} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-foreground">{sportName}</span>
                    <div className="flex items-center gap-6 text-xs">
                      <span className="text-muted-foreground">Invoiced: <span className="text-foreground font-medium">${(st.invoiced / 100).toFixed(2)}</span></span>
                      <span className="text-muted-foreground">Collected: <span className="text-green-400 font-medium">${(st.collected / 100).toFixed(2)}</span></span>
                      <span className="text-muted-foreground">Outstanding: <span className="text-primary font-medium">${(st.outstanding / 100).toFixed(2)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {/* Team filter */}
            {presentTeams.length > 1 && (
              <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
                className="h-8 rounded-lg border border-input bg-surface px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="all">All Teams</option>
                {presentTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {/* Sport filter */}
            {presentSports.length > 1 && (
              <select value={filterSport} onChange={e => setFilterSport(e.target.value)}
                className="h-8 rounded-lg border border-input bg-surface px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="all">All Sports</option>
                {presentSports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}

            {/* Status tabs */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map(t => (
                <button key={t} onClick={() => setFilterStatus(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors capitalize ${filterStatus === t ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice list */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="p-10 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="p-10 text-center">
                <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No invoices found</p>
                <Button size="sm" onClick={() => setShowDrawer(true)} className="mt-4 bg-primary text-primary-foreground gap-1.5">
                  <Plus className="w-4 h-4" /> Create First Invoice
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {displayed.map(inv => {
                  const eff = getEffectiveStatus(inv);
                  const sc = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
                  const balance = (inv.amount || 0) - (inv.paid_amount || 0);
                  const lineItems = (() => { try { return JSON.parse(inv.line_items || "[]"); } catch { return []; } })();

                  return (
                    <div key={inv.id} className={`p-4 ${eff === "overdue" ? "bg-red-500/5" : eff === "draft" ? "bg-surface/50" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-medium text-foreground text-sm">{inv.description}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.cls}`}>{sc.label}</span>
                            {inv.sport_name && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-mono">
                                {inv.accounting_code || inv.sport_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium text-foreground/70">{inv.player_name}</span>
                            {inv.team_name && <span>· {inv.team_name}</span>}
                            {inv.due_date && (
                              <span className={`flex items-center gap-1 ${eff === "overdue" ? "text-red-400 font-semibold" : ""}`}>
                                <Clock className="w-3 h-3" />
                                Due {format(parseISO(inv.due_date + "T00:00:00"), "MMM d, yyyy")}
                                {eff === "overdue" && " · PAST DUE"}
                              </span>
                            )}
                          </div>

                          {lineItems.length > 0 && (
                            <div className="mt-2 bg-surface rounded-lg p-2 space-y-1">
                              {lineItems.map((li, i) => (
                                <div key={i} className="flex justify-between text-xs text-muted-foreground">
                                  <span>{li.name} × {li.quantity}</span>
                                  <span>${((li.unit_amount || 0) / 100).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right space-y-0.5">
                          <p className="text-sm font-bold text-primary">${(inv.amount / 100).toFixed(2)}</p>
                          {(inv.paid_amount || 0) > 0 && inv.status !== "paid" && (
                            <p className="text-xs text-green-400">Paid ${(inv.paid_amount / 100).toFixed(2)}</p>
                          )}
                          {balance > 0 && !["draft","paid","voided","refunded"].includes(inv.status) && (
                            <p className="text-xs text-red-400">Owed ${(balance / 100).toFixed(2)}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border/40">
                        {eff === "draft" && (
                          <button onClick={() => handleSendDraft(inv)} disabled={sendingDraft === inv.id}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors font-medium disabled:opacity-50">
                            <Send className="w-3 h-3" />
                            {sendingDraft === inv.id ? "Sending…" : "Send Invoice"}
                          </button>
                        )}
                        {inv.status !== "paid" && eff !== "voided" && eff !== "refunded" && (
                          <button onClick={() => setEditingInvoice(inv)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {!["voided","refunded"].includes(eff) && (
                          <button onClick={() => { if (confirm(`Void invoice "${inv.description}"?`)) voidMutation.mutate(inv); }}
                            className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors">
                            Void
                          </button>
                        )}
                        {inv.status === "paid" && (
                          <button onClick={() => { if (confirm(`Refund "${inv.description}"?`)) refundMutation.mutate(inv); }}
                            className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-colors">
                            Refund
                          </button>
                        )}
                        <button onClick={() => { if (confirm("Permanently delete?")) deleteMutation.mutate(inv.id); }}
                          className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          Delete
                        </button>
                        {!["draft","paid","voided"].includes(eff) && (
                          <button onClick={() => handleReminder(inv)} disabled={sendingReminder === inv.id}
                            className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors ml-auto disabled:opacity-50">
                            {sendingReminder === inv.id ? "Sending…" : "Send Reminder"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Invoice Creation Drawer */}
      <InvoiceDrawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onSaved={() => { setShowDrawer(false); queryClient.invalidateQueries({ queryKey: ["payments"] }); }}
      />

      {/* Edit existing invoice dialog */}
      {editingInvoice && (
        <InvoiceForm
          players={allPlayers}
          teamName={editingInvoice.team_name}
          teamSportId={editingInvoice.sport_id}
          teamSportName={editingInvoice.sport_name}
          editingInvoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSaved={() => { setEditingInvoice(null); queryClient.invalidateQueries({ queryKey: ["payments"] }); }}
        />
      )}
    </div>
  );
}