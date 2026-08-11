import React from "react";
// New page (Aug 11, 2026, Phase 13 testing): FieldStatusManager previously only
// lived inside AthleticDirectors.jsx, which is gated admin-only (useAdminGuard).
// But FieldStatus.jsonc's own RLS has always allowed athletic_director on
// create/delete and coach on update too -- the UI just never exposed that
// access anywhere. Matthew confirmed directly (Aug 11, 2026): "ADs and coaches
// should be able to post field alerts." This page gives them a route to do so
// without touching AthleticDirectors.jsx's other, genuinely admin-only tabs
// (Staff Accounts, Parent Accounts, Finance, Settings/Audit Log).
import { useScheduleGuard } from "@/hooks/useRoleGuard";
import FieldStatusManager from "@/components/admin/FieldStatusManager";

export default function FieldStatus() {
  useScheduleGuard(); // admin, athletic_director, or coach -- matches FieldStatus.jsonc's RLS

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Field Status</h1>
        <p className="text-sm text-muted-foreground mt-1">Post field & facility closures or delays -- alerts appear instantly on the Parent Portal home feed.</p>
      </div>
      <FieldStatusManager />
    </div>
  );
}
