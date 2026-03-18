import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, DollarSign, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";

export default function PlayerPayments({ player }) {
  const [loading, setLoading] = useState(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", player.id],
    queryFn: () => base44.entities.Payment.filter({ player_id: player.id }),
  });

  const handlePay = async (invoice) => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert("Payments can only be processed from the published app. Please open the app in a new tab.");
      return;
    }
    setLoading(invoice.id);
    const res = await base44.functions.invoke("createCheckout", {
      amount: invoice.amount,
      description: `${invoice.description} - ${player.first_name} ${player.last_name} (${player.team_name})`,
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      team_name: player.team_name,
    });
    setLoading(null);
    if (res.data?.url) window.location.href = res.data.url;
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{player.first_name[0]}{player.last_name[0]}</span>
        </div>
        <h3 className="font-semibold text-foreground">{player.first_name} {player.last_name}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{player.team_name}</span>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-6">
          <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map(inv => (
            <div key={inv.id} className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${inv.status === "paid" ? "border-green-500/30 bg-green-500/5" : "border-border bg-surface hover:border-primary/50 hover:bg-primary/5 cursor-pointer"}`}
              onClick={() => inv.status !== "paid" && handlePay(inv)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{inv.description}</p>
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
              <span className="text-primary font-bold">${(inv.amount / 100).toFixed(2)}</span>
              {inv.status === "paid" ? (
                <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" /> Paid</span>
              ) : (
                <span className="text-xs text-muted-foreground">{loading === inv.id ? "Redirecting..." : "Click to pay"}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}