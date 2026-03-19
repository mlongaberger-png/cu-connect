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
    <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_180px_120px] gap-2 md:gap-4 px-5 py-4 border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
      {/* Time */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground">
          {log.created_date ? format(new Date(log.created_date), "MMM d, h:mm a") : "—"}
        </span>
      </div>

      {/* Description */}
      <div className="flex items-start gap-3">
        <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-foreground leading-snug">{log.description}</p>
          {log.target_name && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.target_entity}: {log.target_name}</p>
          )}
        </div>
      </div>

      {/* Actor */}
      <div className="flex items-center gap-2 md:col-auto col-span-1">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-primary">
            {(log.actor_name || log.actor_email || "?")[0].toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-foreground truncate">{log.actor_name || log.actor_email}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{log.actor_role}</p>
        </div>
      </div>

      {/* Category badge */}
      <div className="flex items-center">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cfg.bg} ${cfg.color}`}>
          {log.category}
        </span>
      </div>
    </div>
  );
}