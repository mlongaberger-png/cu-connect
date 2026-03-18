import React from "react";
import { Megaphone, Pin, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const priorityStyles = {
  normal: "border-border",
  important: "border-primary/40",
  urgent: "border-red-500/40",
};

export default function RecentAnnouncements({ announcements }) {
  if (!announcements || announcements.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Announcements</h3>
        <p className="text-muted-foreground text-sm text-center py-8">No announcements yet</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Announcements</h3>
      <div className="space-y-3">
        {announcements.slice(0, 4).map((ann) => (
          <div 
            key={ann.id} 
            className={`p-4 rounded-xl bg-surface border ${priorityStyles[ann.priority] || priorityStyles.normal}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {ann.priority === "urgent" && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  {ann.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                  <h4 className="text-sm font-semibold text-foreground truncate">{ann.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{ann.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  {ann.target_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {ann.target_name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ann.created_date ? format(new Date(ann.created_date), "MMM d") : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}