import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import InvoiceDetailModal from "@/components/parentportal/InvoiceDetailModal";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, DollarSign, Calendar, FileText, CreditCard, AlertCircle } from "lucide-react";
import PlayerAvatar from "@/components/ui/PlayerAvatar";
import { Button } from "@/components/ui/button";
import { isPast, parseISO } from "date-fns";

function getEffectiveStatus(inv) {
  if (["paid","voided","refunded"].includes(inv.status)) return inv.status;
  if (inv.due_date && isPast(parseISO(inv.due_date + "T23:59:59"))) return "overdue";
  if ((inv.paid_amount || 0) > 0 && (inv.paid_amount || 0) < (inv.amount || 0)) return "partial";
  return inv.status || "pending";
}

function InvoiceRow({ inv, onClick }) {
  const eff = getEffectiveStatus(inv);
  const isOverdue = eff === "overdue";
  const balance = (inv.amount || 0) - (inv.paid_amount || 0);
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all hover:opacity-80 ${
        eff === "paid" ? "border-green-500/30 bg-green-500/5" :
        isOverdue ? "border-red-500/30 bg-red-500/5" :
        "border-border bg-surface"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-medium text-foreground">{inv.description}</p>
          {isOverdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold">PAST DUE</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {inv.due_date && (
            <span className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
              <Calendar className="w-3 h-3" /> Due {new Date(inv.due_date + "T00:00:00").toLocaleDateString("en-US", {month:"short",day:"numeric",year:"numeric"})}
            </span>
          )}
          {inv.notes && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="w-3 h-3" /> {inv.notes}
            </span>
          )}
        </div>
        {eff === "partial" && (
          <div className="mt-1.5">
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, ((inv.paid_amount||0)/(inv.amount||1))*100)}%` }} />
            </div>
            <p className="text-xs text-blue-400 mt-0.5">${(inv.paid_amount/100).toFixed(2)} paid of ${(inv.amount/100).toFixed(2)}</p>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-primary">${((inv.amount||0) / 100).toFixed(2)}</span>
        {eff === "paid" ? (
          <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3 h-3" /> Paid</span>
        ) : eff === "partial" ? (
          <span className="text-xs text-blue-400">Owed ${(balance/100).toFixed(2)}</span>
        ) : isOverdue ? (
          <span className="flex items-center gap-1 text-xs text-red-400"><AlertCircle className="w-3 h-3" /> Overdue</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> Unpaid</span>
        )}
        <span className="text-[10px] text-muted-foreground">View details →</span>
      </div>
    </button>
  );
}

export function PlayerPaymentCard({ player, onPay, loadingFor }) {
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", player.id],
    queryFn: () => base44.entities.Payment.filter({ player_id: player.id }),
  });

  const visible = payments.filter(p => p.status !== "draft");
  const unpaid = visible.filter(p => !["paid","draft","voided","refunded"].includes(p.status));
  const totalOwed = unpaid.reduce((sum, p) => sum + (p.amount || 0), 0);
  const allPaid = visible.length > 0 && unpaid.length === 0;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border p-5 animate-pulse">
        <div className="h-4 bg-surface rounded w-1/3 mb-4" />
        <div className="h-12 bg-surface rounded" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Player Header */}
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <PlayerAvatar player={player} size="lg" />
          <div>
            <h3 className="font-semibold text-foreground">{player.first_name} {player.last_name}</h3>
            <p className="text-xs text-muted-foreground">{player.sport_name} · {player.team_name}</p>
          </div>
        </div>
        {totalOwed > 0 ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Balance Due</p>
            <p className="text-lg font-bold text-primary">${(totalOwed / 100).toFixed(2)}</p>
          </div>
        ) : allPaid ? (
          <span className="flex items-center gap-1 text-xs text-green-400 font-medium"><CheckCircle className="w-4 h-4" /> All Paid</span>
        ) : null}
      </div>

      {/* Invoices */}
      <div className="p-5">
        {payments.length === 0 ? (
          <div className="text-center py-4">
            <DollarSign className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {visible.map(inv => <InvoiceRow key={inv.id} inv={inv} onClick={() => setSelectedInvoice(inv)} />)}
          </div>
        )}

        {unpaid.length > 0 && (
          <div className="pt-3 border-t border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{unpaid.length} unpaid invoice{unpaid.length !== 1 ? "s" : ""}</p>
              <p className="text-sm font-bold text-foreground">Total: ${(totalOwed / 100).toFixed(2)}</p>
            </div>
            <Button
              onClick={() => onPay(player, unpaid)}
              disabled={loadingFor === player.id}
              className="bg-primary text-primary-foreground"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {loadingFor === player.id ? "Redirecting..." : `Pay for ${player.first_name}`}
            </Button>
          </div>
        )}
      </div>
      <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
    </div>
  );
}

// Legacy default export kept for any existing imports
export default function PlayerPayments({ player }) {
  const [loading, setLoading] = useState(null);

  const handlePay = async (p, unpaidInvoices) => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert("Payments can only be processed from the published app. Please open the app in a new tab.");
      return;
    }
    setLoading(p.id);
    const totalAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const descriptions = unpaidInvoices.map(i => i.description).join(", ");
    const res = await base44.functions.invoke("createCheckout", {
      amount: totalAmount,
      description: `${descriptions} - ${p.first_name} ${p.last_name} (${p.team_name})`,
      player_id: p.id,
      player_name: `${p.first_name} ${p.last_name}`,
      team_name: p.team_name,
    });
    setLoading(null);
    if (res.data?.url) window.location.href = res.data.url;
  };

  return <PlayerPaymentCard player={player} onPay={handlePay} loadingFor={loading} />;
}