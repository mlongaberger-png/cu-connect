import React from "react";
import { format } from "date-fns";
import { DollarSign, Calendar, Users, FileText, UserCog, ClipboardList, MoreHorizontal } from "lucide-react";

const categoryConfig = {
  payment:   { icon: DollarSign, color: "text-green-400",  bg: "bg-green-500/10" },
  schedule:  { icon: Calendar,   color: "text-blue-400",   bg: "bg-blue-500/10" },
  volunteer: { icon: Users,      color: "text-purple-400", bg: "bg-purple-500/10" },
  document:  { icon: FileText,   color: "text-orange-400", bg: "bg-orange-500/10" },
  user:      { icon: UserCog,    color: "text-yellow-400", bg: "bg-yellow-500/10" },
  roster:    { icon: ClipboardList, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  other:     { icon: MoreHorizontal, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function AuditLogRow({ log }) {
  const cfg = categoryConfig[log.category] || categoryConfig.other;
  const Icon = cfg.icon;

  return (
    <div className="px-4 py-4 border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
      {/* Mobile card layout */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-foreground leading-snug flex-1">{log.description}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
              {log.category}
            </span>
          </div>
          {log.target_name && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.target_entity}: {log.target_name}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-primary">
                  {(log.actor_name || log.actor_email || "?")[0].toUpperCase()}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{log.actor_name || log.actor_email}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {log.created_date ? format(new Date(log.created_date), "MMM d, h:mm a") : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}