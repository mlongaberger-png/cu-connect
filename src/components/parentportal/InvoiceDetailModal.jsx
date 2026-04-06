import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Clock, AlertCircle, Calendar, FileText, DollarSign, Hash } from "lucide-react";
import { isPast, parseISO, format } from "date-fns";

function getEffectiveStatus(inv) {
  if (["paid", "voided", "refunded"].includes(inv.status)) return inv.status;
  if (inv.due_date && isPast(parseISO(inv.due_date + "T23:59:59"))) return "overdue";
  if ((inv.paid_amount || 0) > 0 && (inv.paid_amount || 0) < (inv.amount || 0)) return "partial";
  return inv.status || "pending";
}

const STATUS_CONFIG = {
  paid:     { label: "Paid",     color: "text-green-400",  bg: "bg-green-500/15 border-green-500/30" },
  partial:  { label: "Partial",  color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30" },
  overdue:  { label: "Past Due", color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30" },
  pending:  { label: "Unpaid",   color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  voided:   { label: "Voided",   color: "text-muted-foreground", bg: "bg-surface border-border" },
  refunded: { label: "Refunded", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
  draft:    { label: "Draft",    color: "text-muted-foreground", bg: "bg-surface border-border" },
};

export default function InvoiceDetailModal({ invoice, onClose }) {
  if (!invoice) return null;

  const eff = getEffectiveStatus(invoice);
  const cfg = STATUS_CONFIG[eff] || STATUS_CONFIG.pending;
  const balance = (invoice.amount || 0) - (invoice.paid_amount || 0);

  let lineItems = [];
  if (invoice.line_items) {
    try { lineItems = JSON.parse(invoice.line_items); } catch {}
  }

  return (
    <Dialog open={!!invoice} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Invoice Detail
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${cfg.bg}`}>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Invoice Total</p>
              <p className="text-xl font-bold text-primary">${((invoice.amount || 0) / 100).toFixed(2)}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2 text-muted-foreground">
              <Hash className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
              <div>
                <span className="text-xs uppercase tracking-wider font-medium">Description</span>
                <p className="text-foreground">{invoice.description}</p>
              </div>
            </div>

            {invoice.player_name && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <FileText className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="text-xs uppercase tracking-wider font-medium">Athlete</span>
                  <p className="text-foreground">{invoice.player_name}</p>
                </div>
              </div>
            )}

            {invoice.due_date && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <div>
                  <span className="text-xs uppercase tracking-wider font-medium">Due Date</span>
                  <p className={eff === "overdue" ? "text-red-400 font-medium" : "text-foreground"}>
                    {format(parseISO(invoice.due_date), "MMMM d, yyyy")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Items</p>
              </div>
              <div className="divide-y divide-border">
                {lineItems.map((li, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="text-foreground">{li.name}</p>
                      {li.quantity > 1 && <p className="text-xs text-muted-foreground">× {li.quantity}</p>}
                    </div>
                    <p className="text-foreground font-medium">${((li.unit_amount * (li.quantity || 1)) / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {/* Subtotals */}
              <div className="px-4 py-2 border-t border-border space-y-1">
                {(invoice.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Discount {invoice.discount_note ? `(${invoice.discount_note})` : ""}</span>
                    <span className="text-green-400">−${(invoice.discount_amount / 100).toFixed(2)}</span>
                  </div>
                )}
                {(invoice.credit_amount || 0) > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Credit {invoice.discount_note ? `(${invoice.discount_note})` : ""}</span>
                    <span className="text-green-400">−${(invoice.credit_amount / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border">
                  <span>Total</span>
                  <span>${((invoice.amount || 0) / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          {(invoice.paid_amount || 0) > 0 && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Paid</span>
                <span className="text-green-400 font-semibold">${((invoice.paid_amount || 0) / 100).toFixed(2)}</span>
              </div>
              {eff === "partial" && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <span className="text-yellow-400 font-semibold">${(balance / 100).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}

          {/* Created */}
          {invoice.created_date && (
            <p className="text-xs text-muted-foreground text-center">
              Invoice created {format(new Date(invoice.created_date), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}