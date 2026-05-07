import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, CheckCircle2, XCircle, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddChildForm from "./AddChildForm";

const STATUS_CONFIG = {
  pending:  { label: "Pending Review", icon: Clock,         color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  approved: { label: "Approved",       icon: CheckCircle2,  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  matched:  { label: "Linked",         icon: CheckCircle2,  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  rejected: { label: "Not Approved",   icon: XCircle,       color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
};

export default function MyChildrenPanel({ userEmail, userName, linkedPlayers = [] }) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: pendingChildren = [] } = useQuery({
    queryKey: ["my-pending-children", userEmail],
    queryFn: () => base44.entities.PendingChild.filter({ parent_email: userEmail }),
    enabled: !!userEmail,
  });

  const handleChildAdded = () => {
    queryClient.invalidateQueries({ queryKey: ["my-pending-children", userEmail] });
    setShowAddForm(false);
  };

  const allChildren = [
    ...linkedPlayers.map(p => ({ ...p, _type: "linked", _displayStatus: "approved" })),
    ...pendingChildren
      .filter(pc => !linkedPlayers.some(lp => lp.id === pc.matched_player_id))
      .map(pc => ({ ...pc, _type: "pending", _displayStatus: pc.status })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> My Children</h3>
          <p className="text-xs text-muted-foreground mt-0.5">View status and manage your children's profiles</p>
        </div>
        {!showAddForm && (
          <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)} className="gap-1.5 border-border">
            <Plus className="w-3.5 h-3.5" /> Add Child
          </Button>
        )}
      </div>

      {allChildren.length === 0 && !showAddForm && (
        <div className="text-center py-8 bg-card rounded-2xl border border-border">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">No children added yet.</p>
          <Button size="sm" className="mt-3" onClick={() => setShowAddForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Your First Child
          </Button>
        </div>
      )}

      {allChildren.length > 0 && (
        <div className="space-y-3">
          {allChildren.map((child, i) => {
            const statusKey = child._displayStatus || "pending";
            const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            const name = child._type === "linked"
              ? `${child.first_name} ${child.last_name}`
              : `${child.first_name} ${child.last_name}`;

            return (
              <div key={child.id || i} className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.bg}`}>
                <div className={`w-9 h-9 rounded-full overflow-hidden bg-background/40 flex items-center justify-center shrink-0 font-bold text-sm ${cfg.color}`}>
                  {child.photo_url
                    ? <img src={child.photo_url} alt={child.first_name} className="w-full h-full object-cover object-top" />
                    : <>{child.first_name?.[0]}{child.last_name?.[0]}</>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm">{name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                    {child._type === "linked" && child.team_name && (
                      <span className="text-xs text-muted-foreground">· {child.team_name}</span>
                    )}
                    {child._type === "pending" && child.sport_interest && (
                      <span className="text-xs text-muted-foreground">· {child.sport_interest}</span>
                    )}
                  </div>
                  {statusKey === "pending" && (
                    <p className="text-xs text-muted-foreground mt-0.5">An admin will review and connect your child to their team.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="font-semibold text-foreground mb-4">Add a Child</h4>
          <AddChildForm
            parentEmail={userEmail}
            parentName={userName}
            onChildAdded={handleChildAdded}
            onSkip={() => setShowAddForm(false)}
            showSkip={true}
          />
        </div>
      )}
    </div>
  );
}