import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useAdminGuard } from "@/hooks/useRoleGuard";
import { Shield, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import AuditLogRow from "@/components/audit/AuditLogRow";

const CATEGORIES = ["payment", "schedule", "volunteer", "document", "user", "roster", "other"];

export default function AuditLog({ embedded = false }) {
  useAdminGuard();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 200),
  });

  const filtered = logs.filter(log => {
    const matchCat = filterCat === "all" || log.category === filterCat;
    const matchSearch = !search ||
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.target_name?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className={embedded ? "space-y-6" : "p-4 md:p-6 max-w-7xl mx-auto space-y-6"}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Read-only log of all system activity</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by user, action, or record..."
            className="pl-9 bg-surface border-border"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 bg-surface border-border">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Log Table */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="space-y-px">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-14 bg-surface/50 animate-pulse border-b border-border last:border-0" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          <div>
            {filtered.map(log => <AuditLogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Showing {filtered.length} of {logs.length} total entries · Admin-only view
      </p>
    </div>
  );
}