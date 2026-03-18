import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, DollarSign, Calendar, FileText, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

function InvoiceRow({ inv }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${inv.status === "paid" ? "border-green-500/30 bg-green-500/5" : "border-border bg-surface"}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{inv.description}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
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
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-primary">${(inv.amount / 100).toFixed(2)}</span>
        {inv.status === "paid" ? (
          <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3 h-3" /> Paid</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> Unpaid</span>
        )}
      </div>
    </div>
  );
}

export function PlayerPaymentCard({ player, onPay, loadingFor }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", player.id],
    queryFn: () => base44.entities.Payment.filter({ player_id: player.id }),
  });

  const unpaid = payments.filter(p => p.status !== "paid");
  const totalOwed = unpaid.reduce((sum, p) => sum + (p.amount || 0), 0);
  const allPaid = payments.length > 0 && unpaid.length === 0;

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
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{player.first_name[0]}{player.last_name[0]}</span>
          </div>
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
            {payments.map(inv => <InvoiceRow key={inv.id} inv={inv} />)}
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