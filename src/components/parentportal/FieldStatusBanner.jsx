import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, XCircle, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function FieldStatusBanner() {
  const { data: fields = [] } = useQuery({
    queryKey: ["field-statuses"],
    queryFn: () => base44.entities.FieldStatus.list("-updated_at"),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const activeAlerts = fields.filter(
    f => f.is_active !== false && (f.status === "delayed" || f.status === "closed")
  );

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-1">
      {activeAlerts.map(field => {
        const isClosed = field.status === "closed";
        return (
          <div
            key={field.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              isClosed
                ? "bg-red-500/10 border-red-500/40"
                : "bg-amber-500/10 border-amber-500/40"
            }`}
          >
            {isClosed
              ? <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isClosed ? "text-red-300" : "text-amber-300"}`}>
                {isClosed ? "⛔ Field Closed" : "⚠️ Delayed"} — {field.location_name}
              </p>
              {field.alert_message && (
                <p className="text-xs text-foreground/80 mt-0.5">{field.alert_message}</p>
              )}
              {field.updated_at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Updated {formatDistanceToNow(new Date(field.updated_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}