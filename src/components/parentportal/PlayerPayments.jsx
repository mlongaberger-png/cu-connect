import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const FEE_OPTIONS = [
  { label: "Registration Fee", amount: 7500 },
  { label: "Uniform Fee", amount: 5000 },
  { label: "Tournament Entry", amount: 10000 },
  { label: "Equipment Deposit", amount: 3000 },
];

export default function PlayerPayments({ player }) {
  const [loading, setLoading] = useState(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", player.id],
    queryFn: () => base44.entities.Payment.filter({ player_id: player.id }),
  });

  const handlePay = async (fee) => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert("Payments can only be processed from the published app. Please open the app in a new tab.");
      return;
    }
    setLoading(fee.label);
    const res = await base44.functions.invoke("createCheckout", {
      amount: fee.amount,
      description: `${fee.label} - ${player.first_name} ${player.last_name} (${player.team_name})`,
      player_id: player.id,
      player_name: `${player.first_name} ${player.last_name}`,
      team_name: player.team_name,
    });
    setLoading(null);
    if (res.data?.url) window.location.href = res.data.url;
  };

  const paidLabels = new Set(payments.filter(p => p.status === "paid").map(p => p.description.split(" - ")[0]));

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-bold text-primary">{player.first_name[0]}{player.last_name[0]}</span>
        </div>
        <h3 className="font-semibold text-foreground">{player.first_name} {player.last_name}</h3>
        <span className="text-xs text-muted-foreground ml-auto">{player.team_name}</span>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="space-y-2 mb-4">
          {payments.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface text-sm">
              {p.status === "paid" ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> : <Clock className="w-4 h-4 text-yellow-400 shrink-0" />}
              <span className="flex-1 truncate text-foreground">{p.description.split(" - ")[0]}</span>
              <span className="text-primary font-medium">${(p.amount / 100).toFixed(2)}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === "paid" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>{p.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fee Options */}
      <div className="grid grid-cols-2 gap-2">
        {FEE_OPTIONS.map(fee => {
          const isPaid = paidLabels.has(fee.label);
          return (
            <button
              key={fee.label}
              onClick={() => !isPaid && handlePay(fee)}
              disabled={isPaid || loading === fee.label}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${isPaid ? "border-green-500/30 bg-green-500/5 cursor-default" : "border-border bg-surface hover:border-primary/50 hover:bg-primary/5 cursor-pointer"}`}
            >
              <div className="flex items-center gap-1 mb-1">
                {isPaid ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <DollarSign className="w-3.5 h-3.5 text-primary" />}
                <span className="text-xs font-medium text-foreground">{fee.label}</span>
              </div>
              <span className="text-lg font-bold text-primary">${(fee.amount / 100).toFixed(0)}</span>
              {isPaid ? (
                <span className="text-xs text-green-400 mt-1">Paid</span>
              ) : (
                <span className="text-xs text-muted-foreground mt-1">{loading === fee.label ? "Redirecting..." : "Click to pay"}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}